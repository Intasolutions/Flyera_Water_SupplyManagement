from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_

from app import models
from app.core.timeutils import local_day_bounds, local_range, local_today, utc_iso
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(deps.WATER_OFFICE)),
):
    period_start, period_end = local_range(start_date, end_date)
    has_period = bool(period_start and period_end)
    if not has_period:
        period_start, period_end = local_day_bounds(local_today())

    # 1. Fast scalar counts
    total_clients = db.query(models.Client).count()
    total_vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_active == True).count()

    # 2. Active Assignments count
    active_assignments_query = db.query(models.Assignment).filter(
        models.Assignment.status.in_(["PENDING", "ACTIVE"]),
        or_(models.Assignment.business_type == "WATER", models.Assignment.business_type.is_(None)),
    )
    if has_period:
        active_assignments_query = active_assignments_query.filter(
            models.Assignment.date >= period_start,
            models.Assignment.date <= period_end
        )
    active_assignments = active_assignments_query.count()

    # 3. Direct SQL SUM aggregate for revenue (avoids loading thousands of objects into RAM)
    period_revenue = db.query(
        func.coalesce(func.sum(models.Delivery.total_amount), 0.0)
    ).filter(
        models.Delivery.created_at >= period_start,
        models.Delivery.created_at <= period_end
    ).scalar() or 0.0

    # 4. Fetch route client counts in a SINGLE grouped query
    route_client_counts = dict(
        db.query(models.Client.route_id, func.count(models.Client.id))
        .filter(models.Client.route_id != None)
        .group_by(models.Client.route_id)
        .all()
    )

    # 5. Eager-load active assignments relations
    active_routes_data = (
        active_assignments_query
        .options(
            joinedload(models.Assignment.vehicle),
            joinedload(models.Assignment.driver),
            selectinload(models.Assignment.deliveries)
        )
        .all()
    )

    active_routes = []
    for a in active_routes_data:
        v_plate = a.vehicle.plate_number if a.vehicle else "Unknown"
        d_name = a.driver.name if a.driver else "Unknown"
        total_route_clients = route_client_counts.get(a.route_id, 0)
        delivered_count = len(a.deliveries)
        progress = int((delivered_count / total_route_clients * 100)) if total_route_clients > 0 else 0

        active_routes.append({
            "vehicle": v_plate,
            "driver": d_name,
            "progress": progress,
            "deliveries": f"{delivered_count}/{total_route_clients}"
        })

    # 6. Eager-load recent deliveries with client and assignment driver
    recent_deliveries = (
        db.query(models.Delivery)
        .options(
            joinedload(models.Delivery.client),
            joinedload(models.Delivery.assignment).joinedload(models.Assignment.driver)
        )
        .order_by(models.Delivery.created_at.desc())
        .limit(5)
        .all()
    )

    recent_activity = []
    for d in recent_deliveries:
        c_name = d.client.name if d.client else "Unknown"
        driver_obj = d.assignment.driver if d.assignment else None
        driver_name = driver_obj.name if driver_obj else "Driver"

        if d.status == "COMPLETED":
            if d.total_amount and d.total_amount > 0:
                text = f"{driver_name} collected ₹{d.total_amount} from {c_name}"
            else:
                text = f"{driver_name} delivered to {c_name}"
        else:
            text = f"{driver_name} marked {c_name} as {d.status}"

        recent_activity.append({
            "text": text,
            "time": utc_iso(d.created_at)
        })

    return {
        "totalClients": total_clients,
        "totalVehicles": total_vehicles,
        "activeAssignments": active_assignments,
        "todayRevenue": round(period_revenue, 2),
        "activeRoutes": active_routes,
        "recentActivity": recent_activity
    }
