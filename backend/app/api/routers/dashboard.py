from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from datetime import datetime, time

from app import models
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    if start_date and end_date:
        today_start = datetime.strptime(start_date, "%Y-%m-%d")
        today_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    else:
        # Calculate today's start and end
        today_start = datetime.combine(datetime.utcnow().date(), time.min)
        today_end = datetime.combine(datetime.utcnow().date(), time.max)
    
    # 1. Fast scalar counts
    total_clients = db.query(models.Client).count()
    total_vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_active == True).count()
    
    # 2. Active Assignments count
    active_assignments_query = db.query(models.Assignment).filter(
        models.Assignment.status.in_(["PENDING", "ACTIVE"])
    )
    if start_date and end_date:
        active_assignments_query = active_assignments_query.filter(
            models.Assignment.date >= today_start,
            models.Assignment.date <= today_end
        )
    active_assignments = active_assignments_query.count()
    
    # 3. Direct SQL SUM aggregate for revenue (avoids loading thousands of objects into RAM)
    today_revenue = db.query(
        func.coalesce(func.sum(models.Delivery.total_amount), 0.0)
    ).filter(
        models.Delivery.created_at >= today_start,
        models.Delivery.created_at <= today_end
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
            "time": d.created_at.isoformat()
        })
    
    return {
        "totalClients": total_clients,
        "totalVehicles": total_vehicles,
        "activeAssignments": active_assignments,
        "todayRevenue": round(today_revenue, 2),
        "activeRoutes": active_routes,
        "recentActivity": recent_activity
    }
