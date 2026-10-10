from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
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
    
    # Total Clients
    total_clients = db.query(models.Client).count()
    
    # Total Vehicles
    total_vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_active == True).count()
    
    # Active Assignments (PENDING or ACTIVE) in the date range if provided, else all active
    active_assignments_query = db.query(models.Assignment).filter(
        models.Assignment.status.in_(["PENDING", "ACTIVE"])
    )
    if start_date and end_date:
        active_assignments_query = active_assignments_query.filter(
            models.Assignment.date >= today_start,
            models.Assignment.date <= today_end
        )
    active_assignments = active_assignments_query.count()
    
    # Revenue in date range
    today_deliveries = db.query(models.Delivery).filter(
        models.Delivery.created_at >= today_start,
        models.Delivery.created_at <= today_end
    ).all()
    
    today_revenue = sum(d.total_amount for d in today_deliveries)
    
    # Fetch all active/pending routes regardless of creation date
    active_routes_data = active_assignments_query.all()
    
    active_routes = []
    for a in active_routes_data:
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == a.vehicle_id).first()
        driver = db.query(models.User).filter(models.User.id == a.driver_id).first()
        total_route_clients = db.query(models.Client).filter(models.Client.route_id == a.route_id).count()
        delivered_count = len(a.deliveries)
        
        progress = int((delivered_count / total_route_clients * 100)) if total_route_clients > 0 else 0
        
        active_routes.append({
            "vehicle": vehicle.plate_number if vehicle else "Unknown",
            "driver": driver.name if driver else "Unknown",
            "progress": progress,
            "deliveries": f"{delivered_count}/{total_route_clients}"
        })
        
    recent_deliveries = db.query(models.Delivery).order_by(models.Delivery.created_at.desc()).limit(5).all()
    recent_activity = []
    for d in recent_deliveries:
        client = db.query(models.Client).filter(models.Client.id == d.client_id).first()
        assignment = db.query(models.Assignment).filter(models.Assignment.id == d.assignment_id).first()
        driver = db.query(models.User).filter(models.User.id == assignment.driver_id).first() if assignment else None
        
        text = ""
        if d.status == "COMPLETED":
            if d.total_amount and d.total_amount > 0:
                text = f"{driver.name if driver else 'Someone'} collected ₹{d.total_amount} from {client.name if client else 'Unknown'}"
            else:
                text = f"{driver.name if driver else 'Someone'} delivered to {client.name if client else 'Unknown'}"
        else:
            text = f"{driver.name if driver else 'Someone'} skipped {client.name if client else 'Unknown'}"
            
        recent_activity.append({
            "text": text,
            "time": d.created_at.isoformat()
        })
    
    return {
        "totalClients": total_clients,
        "totalVehicles": total_vehicles,
        "activeAssignments": active_assignments,
        "todayRevenue": today_revenue,
        "activeRoutes": active_routes,
        "recentActivity": recent_activity
    }
