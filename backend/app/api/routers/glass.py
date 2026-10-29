from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
import io
import csv
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, time, timedelta

from app import schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

def ensure_initial_data(db: Session):
    """Ensures inventory types exist with 0.0 tons initialized if missing."""
    for inv_type in ["unseparated", "white", "mixed"]:
        inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == inv_type).first()
        if not inv:
            inv = models.GlassInventory(type=inv_type, tons=0.0)
            db.add(inv)
            db.commit()


@router.post("/reset-data")
def reset_glass_data(db: Session = Depends(get_db)):
    """Utility endpoint to wipe test/mock glass data and reset inventory to 0.0."""
    db.query(models.GlassCollection).delete()
    db.query(models.GlassVendorPickup).delete()
    db.query(models.GlassSeparation).delete()
    for inv in db.query(models.GlassInventory).all():
        inv.tons = 0.0
    db.commit()
    return {"status": "success", "message": "All glass data reset to 0.0"}


# --- Dashboard Stats with Daily Profit ---

@router.get("/stats")
def get_glass_dashboard_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)

    # Date range parsing
    filter_by_date = False
    start_dt = None
    end_dt = None
    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            filter_by_date = True
        except ValueError:
            pass

    # Query Collections in date filter
    coll_query = db.query(models.GlassCollection)
    if filter_by_date:
        coll_query = coll_query.filter(
            models.GlassCollection.date >= start_dt,
            models.GlassCollection.date <= end_dt
        )
    collections = coll_query.all()

    total_collected_tons = sum(c.tons_collected for c in collections)
    total_paid = sum(c.payment_amount for c in collections)
    
    # Ready to separate (status == dropped_at_godown)
    godown_collections = db.query(models.GlassCollection).filter(
        models.GlassCollection.status == "dropped_at_godown"
    ).all()
    unseparated_tons = sum(c.tons_collected for c in godown_collections)

    # In-transit collections
    in_transit_collections = [c for c in collections if c.status == "collected"]
    in_transit_tons = sum(c.tons_collected for c in in_transit_collections)
    in_transit_count = len(in_transit_collections)

    # Inventory stocks
    white_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "white").first()
    mixed_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "mixed").first()
    white_tons = white_inv.tons if white_inv else 0.0
    mixed_tons = mixed_inv.tons if mixed_inv else 0.0

    # Vendor pickups query
    pickup_query = db.query(models.GlassVendorPickup)
    if filter_by_date:
        pickup_query = pickup_query.filter(
            models.GlassVendorPickup.date >= start_dt,
            models.GlassVendorPickup.date <= end_dt
        )
    pickups = pickup_query.all()
    total_pickup_tons = sum(p.tons for p in pickups)
    total_pickup_revenue = sum(p.tons * p.price_per_ton for p in pickups)

    # Trip expenses for glass assignments
    glass_assignment_ids = [
        a.id for a in db.query(models.Assignment.id).filter(models.Assignment.business_type == "GLASS").all()
    ]
    expense_query = db.query(models.TripExpense).filter(models.TripExpense.assignment_id.in_(glass_assignment_ids))
    if filter_by_date:
        expense_query = expense_query.filter(
            models.TripExpense.created_at >= start_dt,
            models.TripExpense.created_at <= end_dt
        )
    period_trip_expenses = sum(e.amount for e in expense_query.all()) if glass_assignment_ids else 0.0
    period_expenses = total_paid + period_trip_expenses
    period_profit = total_pickup_revenue - period_expenses
    profit_margin = round((period_profit / total_pickup_revenue * 100), 1) if total_pickup_revenue > 0 else 0.0

    # TODAY Specific Financial Metrics
    today_start = datetime.combine(datetime.utcnow().date(), time.min)
    today_end = datetime.combine(datetime.utcnow().date(), time.max)

    today_pickups = db.query(models.GlassVendorPickup).filter(
        models.GlassVendorPickup.date >= today_start,
        models.GlassVendorPickup.date <= today_end
    ).all()
    today_revenue = sum(p.tons * p.price_per_ton for p in today_pickups)

    today_colls = db.query(models.GlassCollection).filter(
        models.GlassCollection.date >= today_start,
        models.GlassCollection.date <= today_end
    ).all()
    today_collected_tons = sum(c.tons_collected for c in today_colls)
    today_cullet_cost = sum(c.payment_amount for c in today_colls)

    today_expenses_list = db.query(models.TripExpense).filter(
        models.TripExpense.assignment_id.in_(glass_assignment_ids),
        models.TripExpense.created_at >= today_start,
        models.TripExpense.created_at <= today_end
    ).all() if glass_assignment_ids else []
    today_trip_expenses = sum(e.amount for e in today_expenses_list)
    today_total_expenses = today_cullet_cost + today_trip_expenses
    today_profit = today_revenue - today_total_expenses

    # Counts
    total_properties_count = db.query(models.GlassProperty).count()
    active_assignments_count = db.query(models.Assignment).filter(
        models.Assignment.business_type == "GLASS",
        models.Assignment.status.in_(["PENDING", "ACTIVE"])
    ).count()

    # Recent Vendor Pickups (last 6)
    recent_pickups_models = db.query(models.GlassVendorPickup).order_by(
        models.GlassVendorPickup.date.desc()
    ).limit(6).all()

    recent_pickups = [
        {
            "id": p.id,
            "vendorName": p.vendor_name,
            "vendor_name": p.vendor_name,
            "type": p.type,
            "tons": p.tons,
            "pricePerTon": p.price_per_ton,
            "price_per_ton": p.price_per_ton,
            "date": p.date.isoformat() if p.date else datetime.utcnow().isoformat()
        }
        for p in recent_pickups_models
    ]

    # Recent Collections (last 8)
    recent_colls_models = db.query(models.GlassCollection).order_by(
        models.GlassCollection.date.desc()
    ).limit(8).all()

    recent_collections = [
        {
            "id": c.id,
            "driverId": c.driver_id,
            "driver_id": c.driver_id,
            "driverName": c.driver.name if c.driver else "Assigned Driver",
            "driver_name": c.driver.name if c.driver else "Assigned Driver",
            "vehicle": c.vehicle,
            "property": c.property,
            "property_id": c.property_id,
            "assignment_id": c.assignment_id,
            "location": c.location,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "phone": c.phone,
            "tonsCollected": c.tons_collected,
            "tons_collected": c.tons_collected,
            "paymentAmount": c.payment_amount,
            "payment_amount": c.payment_amount,
            "status": c.status,
            "date": c.date.isoformat() if c.date else datetime.utcnow().isoformat()
        }
        for c in recent_colls_models
    ]

    return {
        "todayRevenue": round(today_revenue, 2),
        "today_revenue": round(today_revenue, 2),
        "todayExpenses": round(today_total_expenses, 2),
        "today_expenses": round(today_total_expenses, 2),
        "todayCulletCost": round(today_cullet_cost, 2),
        "today_cullet_cost": round(today_cullet_cost, 2),
        "todayTripExpenses": round(today_trip_expenses, 2),
        "today_trip_expenses": round(today_trip_expenses, 2),
        "todayProfit": round(today_profit, 2),
        "today_profit": round(today_profit, 2),
        "todayCollectedTons": round(today_collected_tons, 2),
        "today_collected_tons": round(today_collected_tons, 2),
        
        "periodRevenue": round(total_pickup_revenue, 2),
        "period_revenue": round(total_pickup_revenue, 2),
        "periodExpenses": round(period_expenses, 2),
        "period_expenses": round(period_expenses, 2),
        "periodCulletCost": round(total_paid, 2),
        "period_cullet_cost": round(total_paid, 2),
        "periodTripExpenses": round(period_trip_expenses, 2),
        "period_trip_expenses": round(period_trip_expenses, 2),
        "netProfit": round(period_profit, 2),
        "net_profit": round(period_profit, 2),
        "profitMarginPercent": profit_margin,
        "profit_margin_percent": profit_margin,

        "totalCollectedTons": round(total_collected_tons, 2),
        "total_collected_tons": round(total_collected_tons, 2),
        "totalPaid": round(total_paid, 2),
        "total_paid": round(total_paid, 2),
        "unseparatedTons": round(unseparated_tons, 2),
        "unseparated_tons": round(unseparated_tons, 2),
        "whiteTons": round(white_tons, 2),
        "white_tons": round(white_tons, 2),
        "mixedTons": round(mixed_tons, 2),
        "mixed_tons": round(mixed_tons, 2),
        "totalPickupTons": round(total_pickup_tons, 2),
        "total_pickup_tons": round(total_pickup_tons, 2),
        "totalPickupRevenue": round(total_pickup_revenue, 2),
        "total_pickup_revenue": round(total_pickup_revenue, 2),
        "inTransitTons": round(in_transit_tons, 2),
        "in_transit_tons": round(in_transit_tons, 2),
        "inTransitCount": in_transit_count,
        "totalPropertiesCount": total_properties_count,
        "activeAssignmentsCount": active_assignments_count,
        "recentPickups": recent_pickups,
        "recent_pickups": recent_pickups,
        "recentCollections": recent_collections,
        "recent_collections": recent_collections
    }


# --- Dedicated Glass Properties Endpoints ---

@router.get("/properties")
def get_glass_properties(
    route_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.GlassProperty)
    if route_id:
        q = q.filter(models.GlassProperty.route_id == route_id)
    if category and category != "all":
        q = q.filter(models.GlassProperty.category == category)
    if search:
        s = f"%{search.lower()}%"
        q = q.filter(
            (func.lower(models.GlassProperty.name).like(s)) |
            (func.lower(models.GlassProperty.address).like(s)) |
            (models.GlassProperty.phone.like(s))
        )
    props = q.order_by(models.GlassProperty.name.asc()).all()
    
    result = []
    for p in props:
        total_tons = db.query(func.coalesce(func.sum(models.GlassCollection.tons_collected), 0.0)).filter(
            models.GlassCollection.property_id == p.id
        ).scalar() or 0.0
        
        result.append({
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "contact_person": p.contact_person,
            "contactPerson": p.contact_person,
            "phone": p.phone,
            "address": p.address,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "route_id": p.route_id,
            "routeId": p.route_id,
            "route_name": p.route.name if p.route else None,
            "routeName": p.route.name if p.route else None,
            "pickup_frequency": p.pickup_frequency,
            "pickupFrequency": p.pickup_frequency,
            "notes": p.notes,
            "is_active": p.is_active,
            "isActive": p.is_active,
            "total_tons_collected": round(total_tons, 2),
            "totalTonsCollected": round(total_tons, 2),
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return result

@router.post("/properties", response_model=schemas.GlassPropertyResponse)
def create_glass_property(
    prop_in: schemas.GlassPropertyCreate,
    db: Session = Depends(get_db)
):
    new_p = models.GlassProperty(**prop_in.model_dump())
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    resp = schemas.GlassPropertyResponse.model_validate(new_p)
    if new_p.route:
        resp.route_name = new_p.route.name
    return resp

@router.get("/properties/{property_id}", response_model=schemas.GlassPropertyResponse)
def get_glass_property(property_id: str, db: Session = Depends(get_db)):
    p = db.query(models.GlassProperty).filter(models.GlassProperty.id == property_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Glass property not found")
    resp = schemas.GlassPropertyResponse.model_validate(p)
    if p.route:
        resp.route_name = p.route.name
    total_tons = db.query(func.coalesce(func.sum(models.GlassCollection.tons_collected), 0.0)).filter(
        models.GlassCollection.property_id == p.id
    ).scalar() or 0.0
    resp.total_tons_collected = round(total_tons, 2)
    return resp

@router.put("/properties/{property_id}", response_model=schemas.GlassPropertyResponse)
def update_glass_property(
    property_id: str,
    prop_in: schemas.GlassPropertyUpdate,
    db: Session = Depends(get_db)
):
    p = db.query(models.GlassProperty).filter(models.GlassProperty.id == property_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Glass property not found")
    
    update_data = prop_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(p, field, val)
    
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    
    resp = schemas.GlassPropertyResponse.model_validate(p)
    if p.route:
        resp.route_name = p.route.name
    return resp

@router.delete("/properties/{property_id}")
def delete_glass_property(property_id: str, db: Session = Depends(get_db)):
    p = db.query(models.GlassProperty).filter(models.GlassProperty.id == property_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Glass property not found")
    
    # Detach any collections from this property without deleting the collection history
    db.query(models.GlassCollection).filter(models.GlassCollection.property_id == property_id).update({"property_id": None})
    db.delete(p)
    db.commit()
    return {"message": "Glass property deleted successfully"}


# --- Glass Routes Endpoints ---

@router.get("/routes")
def get_glass_routes(db: Session = Depends(get_db)):
    routes = db.query(models.Route).filter(models.Route.business_type == "GLASS").order_by(models.Route.name.asc()).all()
    res = []
    for r in routes:
        prop_count = db.query(models.GlassProperty).filter(models.GlassProperty.route_id == r.id).count()
        res.append({
            "id": r.id,
            "name": r.name,
            "area": r.area,
            "business_type": r.business_type,
            "businessType": r.business_type,
            "properties_count": prop_count,
            "propertiesCount": prop_count,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return res

@router.post("/routes", response_model=schemas.RouteResponse)
def create_glass_route(
    route_in: schemas.RouteCreate,
    db: Session = Depends(get_db)
):
    db_r = models.Route(
        name=route_in.name,
        area=route_in.area,
        business_type="GLASS"
    )
    db.add(db_r)
    db.commit()
    db.refresh(db_r)
    return db_r

@router.put("/routes/{route_id}", response_model=schemas.RouteResponse)
def update_glass_route(
    route_id: str,
    route_in: schemas.RouteUpdate,
    db: Session = Depends(get_db)
):
    r = db.query(models.Route).filter(models.Route.id == route_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Route not found")
    if route_in.name:
        r.name = route_in.name
    if route_in.area is not None:
        r.area = route_in.area
    r.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return r

@router.delete("/routes/{route_id}")
def delete_glass_route(route_id: str, db: Session = Depends(get_db)):
    r = db.query(models.Route).filter(models.Route.id == route_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Route not found")
    # Unassign properties from this route
    db.query(models.GlassProperty).filter(models.GlassProperty.route_id == route_id).update({"route_id": None})
    db.delete(r)
    db.commit()
    return {"message": "Glass route deleted successfully"}

@router.post("/routes/{route_id}/assign-properties")
def assign_properties_to_glass_route(
    route_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    r = db.query(models.Route).filter(models.Route.id == route_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Route not found")
    property_ids = payload.get("property_ids", [])
    # Clear current
    db.query(models.GlassProperty).filter(models.GlassProperty.route_id == route_id).update({"route_id": None})
    if property_ids:
        db.query(models.GlassProperty).filter(models.GlassProperty.id.in_(property_ids)).update({"route_id": route_id}, synchronize_session=False)
    db.commit()
    return {"message": "Properties assigned to route successfully"}


# --- Glass Fleet Assignments (Daily Collection Runs) ---

@router.get("/assignments")
def get_glass_assignments(
    status: Optional[str] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Assignment).filter(models.Assignment.business_type == "GLASS")
    if status and status != "ALL":
        q = q.filter(models.Assignment.status == status)
    if date:
        try:
            d = datetime.strptime(date[:10], "%Y-%m-%d")
            q = q.filter(models.Assignment.date >= d, models.Assignment.date < d + timedelta(days=1))
        except Exception:
            pass

    from sqlalchemy import case
    status_order = case(
        (models.Assignment.status == "ACTIVE", 0),
        (models.Assignment.status == "PENDING", 1),
        else_=2
    )
    assignments = q.order_by(status_order, models.Assignment.date.desc(), models.Assignment.created_at.desc()).all()

    res = []
    for a in assignments:
        route_props = db.query(models.GlassProperty).filter(models.GlassProperty.route_id == a.route_id).all() if a.route_id else []
        colls = db.query(models.GlassCollection).filter(models.GlassCollection.assignment_id == a.id).all()
        total_tons = sum(c.tons_collected for c in colls)
        total_paid_run = sum(c.payment_amount for c in colls)
        
        expenses = db.query(models.TripExpense).filter(models.TripExpense.assignment_id == a.id).all()
        total_exp = sum(e.amount for e in expenses)

        res.append({
            "id": a.id,
            "date": a.date.isoformat() if a.date else None,
            "vehicle_id": a.vehicle_id,
            "vehicleId": a.vehicle_id,
            "vehicle_plate": a.vehicle.plate_number if a.vehicle else "Vehicle",
            "vehiclePlate": a.vehicle.plate_number if a.vehicle else "Vehicle",
            "vehicle_model": a.vehicle.model if a.vehicle else "",
            "driver_id": a.driver_id,
            "driverId": a.driver_id,
            "driver_name": a.driver.name if a.driver else "Driver",
            "driverName": a.driver.name if a.driver else "Driver",
            "helper_id": a.helper_id,
            "helperId": a.helper_id,
            "helper_name": a.helper.name if a.helper else None,
            "helperName": a.helper.name if a.helper else None,
            "route_id": a.route_id,
            "routeId": a.route_id,
            "route_name": a.route.name if a.route else "Unassigned Route",
            "routeName": a.route.name if a.route else "Unassigned Route",
            "route_area": a.route.area if a.route else "",
            "status": a.status,
            "target_capacity_tons": a.target_capacity_tons or 0.0,
            "targetCapacityTons": a.target_capacity_tons or 0.0,
            "collected_tons": round(total_tons, 2),
            "collectedTons": round(total_tons, 2),
            "total_paid": round(total_paid_run, 2),
            "totalPaid": round(total_paid_run, 2),
            "stops_total": len(route_props),
            "stopsTotal": len(route_props),
            "stops_completed": len(colls),
            "stopsCompleted": len(colls),
            "total_expense": round(total_exp, 2),
            "totalExpense": round(total_exp, 2),
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return res

@router.post("/assignments")
def create_glass_assignment(
    assignment_in: schemas.AssignmentCreate,
    db: Session = Depends(get_db)
):
    v = db.query(models.Vehicle).filter(models.Vehicle.id == assignment_in.vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db_a = models.Assignment(
        date=assignment_in.date,
        vehicle_id=assignment_in.vehicle_id,
        driver_id=assignment_in.driver_id,
        helper_id=assignment_in.helper_id if assignment_in.helper_id else None,
        route_id=assignment_in.route_id if assignment_in.route_id else None,
        status=assignment_in.status or "PENDING",
        business_type="GLASS",
        target_capacity_tons=assignment_in.target_capacity_tons or 0.0
    )
    db.add(db_a)
    db.commit()
    db.refresh(db_a)
    return db_a

@router.put("/assignments/{assignment_id}")
def update_glass_assignment(
    assignment_id: str,
    assignment_in: schemas.AssignmentUpdate,
    db: Session = Depends(get_db)
):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment_in.vehicle_id:
        a.vehicle_id = assignment_in.vehicle_id
    if assignment_in.driver_id:
        a.driver_id = assignment_in.driver_id
    if assignment_in.helper_id is not None:
        a.helper_id = assignment_in.helper_id if assignment_in.helper_id != "" else None
    if assignment_in.route_id is not None:
        a.route_id = assignment_in.route_id if assignment_in.route_id != "" else None
    if assignment_in.date:
        a.date = assignment_in.date
    if assignment_in.status:
        a.status = assignment_in.status
    if assignment_in.target_capacity_tons is not None:
        a.target_capacity_tons = assignment_in.target_capacity_tons

    a.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return a

@router.post("/assignments/{assignment_id}/complete")
def complete_glass_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    """End of Run Drop-off: Automatically marks all active collections from this run as dropped_at_godown and credits unseparated inventory."""
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if a.status == "COMPLETED":
        return {"id": a.id, "status": a.status, "message": "Assignment already completed"}

    # Find active collections for this run
    colls = db.query(models.GlassCollection).filter(
        models.GlassCollection.assignment_id == assignment_id,
        models.GlassCollection.status == "collected"
    ).all()

    total_tons_dropped = sum(c.tons_collected for c in colls)
    for c in colls:
        c.status = "dropped_at_godown"

    # Credit to Unseparated Godown inventory
    unsep = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if not unsep:
        unsep = models.GlassInventory(type="unseparated", tons=0.0)
        db.add(unsep)
    unsep.tons += total_tons_dropped

    a.status = "COMPLETED"
    a.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(a)

    return {
        "id": a.id,
        "status": a.status,
        "tons_dropped": round(total_tons_dropped, 2),
        "message": f"Successfully dropped {round(total_tons_dropped, 2)} Tons into Godown and completed shift!"
    }

@router.put("/assignments/{assignment_id}/reopen")
def reopen_glass_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status != "COMPLETED":
        return a

    # Revert unseparated inventory additions
    colls = db.query(models.GlassCollection).filter(
        models.GlassCollection.assignment_id == assignment_id,
        models.GlassCollection.status == "dropped_at_godown"
    ).all()
    total_tons = sum(c.tons_collected for c in colls)

    for c in colls:
        c.status = "collected"

    unsep = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if unsep:
        unsep.tons = max(0.0, unsep.tons - total_tons)

    a.status = "ACTIVE"
    a.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return a

@router.delete("/assignments/{assignment_id}")
def delete_glass_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Detach collections from this assignment
    for c in list(a.glass_collections):
        c.assignment_id = None
        
    db.delete(a)
    db.commit()
    return {"message": "Glass assignment deleted successfully"}


# --- Collections Endpoints ---

@router.post("/collect", response_model=schemas.GlassCollectionResponse)
def log_collection(
    collection: schemas.GlassCollectionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(deps.get_optional_current_user)
):
    ensure_initial_data(db)
    coll_data = collection.model_dump()
    
    # If property_id is provided, pull info from property if blank
    if coll_data.get("property_id"):
        prop = db.query(models.GlassProperty).filter(models.GlassProperty.id == coll_data["property_id"]).first()
        if prop:
            if not coll_data.get("property"):
                coll_data["property"] = prop.name
            if not coll_data.get("location") and prop.address:
                coll_data["location"] = prop.address
            if not coll_data.get("phone") and prop.phone:
                coll_data["phone"] = prop.phone
            if coll_data.get("latitude") is None and prop.latitude:
                coll_data["latitude"] = prop.latitude
            if coll_data.get("longitude") is None and prop.longitude:
                coll_data["longitude"] = prop.longitude

    # Assign driver_id if missing
    if not coll_data.get("driver_id"):
        if current_user:
            coll_data["driver_id"] = current_user.id
        else:
            first_user = db.query(models.User).first()
            coll_data["driver_id"] = first_user.id if first_user else None

    # Remove driver_name if present in dict since it's not a column
    driver_name = coll_data.pop("driver_name", None)

    db_collection = models.GlassCollection(**coll_data)
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    
    # Attach driver_name for response
    driver = db.query(models.User).filter(models.User.id == db_collection.driver_id).first() if db_collection.driver_id else None
    response = schemas.GlassCollectionResponse.model_validate(db_collection)
    response.driver_name = driver.name if driver else (driver_name or "Driver")
    return response

@router.get("/collections")
def get_collections(
    status: Optional[str] = None,
    assignment_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    query = db.query(models.GlassCollection)
    if status:
        query = query.filter(models.GlassCollection.status == status)
    if assignment_id:
        query = query.filter(models.GlassCollection.assignment_id == assignment_id)
    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(
                models.GlassCollection.date >= start_dt,
                models.GlassCollection.date <= end_dt
            )
        except ValueError:
            pass
            
    colls = query.order_by(models.GlassCollection.date.desc()).all()
    result = []
    for c in colls:
        result.append({
            "id": c.id,
            "driverId": c.driver_id,
            "driver_id": c.driver_id,
            "driverName": c.driver.name if c.driver else "Assigned Driver",
            "driver_name": c.driver.name if c.driver else "Assigned Driver",
            "vehicle": c.vehicle,
            "property": c.property,
            "property_id": c.property_id,
            "propertyId": c.property_id,
            "assignment_id": c.assignment_id,
            "assignmentId": c.assignment_id,
            "location": c.location,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "phone": c.phone,
            "tonsCollected": c.tons_collected,
            "tons_collected": c.tons_collected,
            "paymentAmount": c.payment_amount,
            "payment_amount": c.payment_amount,
            "status": c.status,
            "date": c.date.isoformat() if c.date else datetime.utcnow().isoformat()
        })
    return result

@router.post("/dropoff/{collection_id}")
def dropoff_collection(
    collection_id: str,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    db_collection = db.query(models.GlassCollection).filter(models.GlassCollection.id == collection_id).first()
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    db_collection.status = "dropped_at_godown"
    
    # Increase unseparated inventory
    unseparated_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if not unseparated_inv:
        unseparated_inv = models.GlassInventory(type="unseparated", tons=0.0)
        db.add(unseparated_inv)
        
    unseparated_inv.tons += db_collection.tons_collected
    db.commit()
    db.refresh(db_collection)
    
    driver = db.query(models.User).filter(models.User.id == db_collection.driver_id).first() if db_collection.driver_id else None
    return {
        "id": db_collection.id,
        "driverId": db_collection.driver_id,
        "driver_id": db_collection.driver_id,
        "driverName": driver.name if driver else "Driver",
        "vehicle": db_collection.vehicle,
        "property": db_collection.property,
        "location": db_collection.location,
        "phone": db_collection.phone,
        "tonsCollected": db_collection.tons_collected,
        "tons_collected": db_collection.tons_collected,
        "paymentAmount": db_collection.payment_amount,
        "payment_amount": db_collection.payment_amount,
        "status": db_collection.status,
        "date": db_collection.date.isoformat() if db_collection.date else datetime.utcnow().isoformat()
    }

@router.post("/dropoff-all")
def dropoff_all_collections(
    req: Optional[schemas.GlassDropoffAllRequest] = None,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    query = db.query(models.GlassCollection).filter(models.GlassCollection.status == "collected")
    if req and req.driver_id:
        query = query.filter(models.GlassCollection.driver_id == req.driver_id)
        
    active_colls = query.all()
    total_dropped_tons = sum(c.tons_collected for c in active_colls)
    
    for c in active_colls:
        c.status = "dropped_at_godown"
        
    unseparated_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if not unseparated_inv:
        unseparated_inv = models.GlassInventory(type="unseparated", tons=0.0)
        db.add(unseparated_inv)
        
    unseparated_inv.tons += total_dropped_tons
    db.commit()
    
    return {
        "message": f"Successfully dropped {len(active_colls)} collections at godown",
        "count": len(active_colls),
        "totalTons": total_dropped_tons
    }


# --- Segregation ---

@router.post("/separate", response_model=schemas.GlassSeparationResponse)
def separate_glass(
    separation: schemas.GlassSeparationCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(deps.get_optional_current_user)
):
    ensure_initial_data(db)
    sep_data = separation.model_dump()
    
    if not sep_data.get("staff_id"):
        if current_user:
            sep_data["staff_id"] = current_user.id
        else:
            first_user = db.query(models.User).first()
            sep_data["staff_id"] = first_user.id if first_user else None

    # Deduct unseparated inventory
    unseparated_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if unseparated_inv:
        unseparated_inv.tons = max(0.0, unseparated_inv.tons - separation.tons_separated)
        
    # Add to white and mixed
    white_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "white").first()
    if not white_inv:
        white_inv = models.GlassInventory(type="white", tons=0.0)
        db.add(white_inv)
    white_inv.tons += separation.white_tons
    
    mixed_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "mixed").first()
    if not mixed_inv:
        mixed_inv = models.GlassInventory(type="mixed", tons=0.0)
        db.add(mixed_inv)
    mixed_inv.tons += separation.mixed_tons
    
    # Mark tied collection as separated if given
    if separation.collection_id:
        db_collection = db.query(models.GlassCollection).filter(models.GlassCollection.id == separation.collection_id).first()
        if db_collection:
            db_collection.status = "separated"
            
    db_separation = models.GlassSeparation(**sep_data)
    db.add(db_separation)
    db.commit()
    db.refresh(db_separation)
    return db_separation


# --- Vendor Pickups ---

@router.post("/vendor-pickup", response_model=schemas.GlassVendorPickupResponse)
def vendor_pickup(
    pickup: schemas.GlassVendorPickupCreate,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    # Check inventory
    inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == pickup.type).first()
    if not inv or inv.tons < pickup.tons:
        available = inv.tons if inv else 0.0
        raise HTTPException(status_code=400, detail=f"Not enough {pickup.type} glass in inventory (Available: {available} T)")
        
    # Record pickup
    db_pickup = models.GlassVendorPickup(**pickup.model_dump())
    db.add(db_pickup)
    
    # Deduct stock
    inv.tons = max(0.0, inv.tons - pickup.tons)
    
    db.commit()
    db.refresh(db_pickup)
    return db_pickup

@router.get("/vendor-pickups")
def get_vendor_pickups(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    pickups = db.query(models.GlassVendorPickup).order_by(
        models.GlassVendorPickup.date.desc()
    ).limit(limit).all()
    
    return [
        {
            "id": p.id,
            "vendorName": p.vendor_name,
            "vendor_name": p.vendor_name,
            "type": p.type,
            "tons": p.tons,
            "pricePerTon": p.price_per_ton,
            "price_per_ton": p.price_per_ton,
            "date": p.date.isoformat() if p.date else datetime.utcnow().isoformat()
        }
        for p in pickups
    ]

@router.get("/inventory")
def get_glass_inventory(
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    inv_list = db.query(models.GlassInventory).all()
    return [
        {
            "id": i.id,
            "type": i.type,
            "tons": i.tons,
            "updated_at": i.updated_at.isoformat() if i.updated_at else datetime.utcnow().isoformat()
        }
        for i in inv_list
    ]


# --- CA Accountant Financial Reports & Audit Ledgers ---

@router.get("/reports")
def get_glass_ca_financial_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Generates formal CA-compliant financial statements (P&L, Sales Register, Purchases Register, Expenses, Closing Stock)."""
    ensure_initial_data(db)
    now = datetime.utcnow()
    current_year = now.year

    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date[:10], "%Y-%m-%d")
            end_dt = datetime.strptime(end_date[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            start_dt = datetime(current_year, 1, 1, 0, 0, 0)
            end_dt = datetime(current_year, 12, 31, 23, 59, 59)
    else:
        # Default to Current Calendar Year (Jan 1 to Dec 31)
        start_dt = datetime(current_year, 1, 1, 0, 0, 0)
        end_dt = datetime(current_year, 12, 31, 23, 59, 59)

    # 1. Sales Register (Recycling Mills Sales)
    pickups = db.query(models.GlassVendorPickup).filter(
        models.GlassVendorPickup.date >= start_dt,
        models.GlassVendorPickup.date <= end_dt
    ).order_by(models.GlassVendorPickup.date.desc()).all()

    sales_ledger = []
    white_sales_tons = 0.0
    white_sales_rev = 0.0
    mixed_sales_tons = 0.0
    mixed_sales_rev = 0.0

    for idx, p in enumerate(pickups):
        rate = p.price_per_ton if p.price_per_ton and p.price_per_ton > 0 else (5500.0 if p.type == "white" else 3800.0)
        bill_amt = round(p.tons * rate, 2)
        if p.type == "white":
            white_sales_tons += p.tons
            white_sales_rev += bill_amt
        else:
            mixed_sales_tons += p.tons
            mixed_sales_rev += bill_amt

        sales_ledger.append({
            "id": p.id,
            "invoice_no": f"FL-SLS-{p.date.strftime('%Y%m')}-{str(idx + 1).zfill(3)}" if p.date else f"FL-SLS-{str(idx + 1).zfill(3)}",
            "date": p.date.strftime("%Y-%m-%d") if p.date else "",
            "vendor_name": p.vendor_name,
            "type": "Flint White Glass" if p.type == "white" else "Mixed Container Glass",
            "tons": round(p.tons, 2),
            "price_per_ton": round(rate, 2),
            "total_amount": bill_amt
        })

    total_sales_revenue = round(white_sales_rev + mixed_sales_rev, 2)
    total_sales_tons = round(white_sales_tons + mixed_sales_tons, 2)

    # 2. Purchases Register (Cullet Intake from Hotels & Bars)
    colls = db.query(models.GlassCollection).filter(
        models.GlassCollection.date >= start_dt,
        models.GlassCollection.date <= end_dt
    ).order_by(models.GlassCollection.date.desc()).all()

    purchases_ledger = []
    total_cullet_cost = 0.0
    total_collected_tons = 0.0

    for idx, c in enumerate(colls):
        total_cullet_cost += (c.payment_amount or 0.0)
        total_collected_tons += c.tons_collected

        driver_name = c.driver.name if c.driver else "Assigned Driver"
        category = c.property_rel.category if c.property_rel else "Commercial / Hotel"

        purchases_ledger.append({
            "id": c.id,
            "voucher_no": f"FL-PUR-{c.date.strftime('%Y%m')}-{str(idx + 1).zfill(3)}" if c.date else f"FL-PUR-{str(idx + 1).zfill(3)}",
            "date": c.date.strftime("%Y-%m-%d") if c.date else "",
            "property_name": c.property,
            "category": category,
            "location": c.location or "",
            "phone": c.phone or "",
            "tons_collected": round(c.tons_collected, 2),
            "payment_amount": round(c.payment_amount or 0.0, 2),
            "driver_name": driver_name,
            "vehicle": c.vehicle,
            "status": c.status
        })

    total_cullet_cost = round(total_cullet_cost, 2)
    total_collected_tons = round(total_collected_tons, 2)

    # 3. Trip & Logistics Expenses (Fuel, Tolls, Repairs for Glass Fleet)
    glass_assignment_ids = [
        a.id for a in db.query(models.Assignment.id).filter(models.Assignment.business_type == "GLASS").all()
    ]
    expenses = db.query(models.TripExpense).filter(
        models.TripExpense.assignment_id.in_(glass_assignment_ids),
        models.TripExpense.created_at >= start_dt,
        models.TripExpense.created_at <= end_dt
    ).order_by(models.TripExpense.created_at.desc()).all() if glass_assignment_ids else []

    expenses_ledger = []
    fuel_exp = 0.0
    toll_exp = 0.0
    maint_exp = 0.0
    other_exp = 0.0

    for idx, e in enumerate(expenses):
        amt = round(e.amount, 2)
        cat = (e.category or "OTHER").upper()
        if cat == "FUEL":
            fuel_exp += amt
        elif cat == "TOLL":
            toll_exp += amt
        elif cat == "MAINTENANCE":
            maint_exp += amt
        else:
            other_exp += amt

        assign = e.assignment
        v_plate = assign.vehicle.plate_number if assign and assign.vehicle else "Fleet Vehicle"
        d_name = e.reporter.name if e.reporter else (assign.driver.name if assign and assign.driver else "Staff")

        expenses_ledger.append({
            "id": e.id,
            "voucher_no": f"FL-EXP-{e.created_at.strftime('%Y%m')}-{str(idx + 1).zfill(3)}" if e.created_at else f"FL-EXP-{str(idx + 1).zfill(3)}",
            "date": e.created_at.strftime("%Y-%m-%d") if e.created_at else "",
            "category": cat,
            "amount": amt,
            "vehicle": v_plate,
            "reported_by": d_name,
            "description": e.description or ""
        })

    total_trip_expenses = round(fuel_exp + toll_exp + maint_exp + other_exp, 2)

    # 4. P&L Statement Math
    gross_profit = round(total_sales_revenue - total_cullet_cost, 2)
    net_profit = round(gross_profit - total_trip_expenses, 2)
    gross_margin_percent = round((gross_profit / total_sales_revenue * 100), 1) if total_sales_revenue > 0 else 0.0
    net_margin_percent = round((net_profit / total_sales_revenue * 100), 1) if total_sales_revenue > 0 else 0.0

    # 5. Closing Stock Inventory Valuation
    inv_white = db.query(models.GlassInventory).filter(models.GlassInventory.type == "white").first()
    inv_mixed = db.query(models.GlassInventory).filter(models.GlassInventory.type == "mixed").first()
    inv_unsep = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()

    w_tons = inv_white.tons if inv_white else 0.0
    m_tons = inv_mixed.tons if inv_mixed else 0.0
    u_tons = inv_unsep.tons if inv_unsep else 0.0

    # Benchmark average market rates per ton for valuation
    avg_white_rate = round(white_sales_rev / white_sales_tons, 2) if white_sales_tons > 0 else 5500.0
    avg_mixed_rate = round(mixed_sales_rev / mixed_sales_tons, 2) if mixed_sales_tons > 0 else 3800.0
    avg_unsep_rate = 2500.0

    closing_inventory = [
        {
            "category": "Flint White Glass (Segregated)",
            "type": "white",
            "quantity_tons": round(w_tons, 2),
            "benchmark_rate_per_ton": avg_white_rate,
            "valuation_amount": round(w_tons * avg_white_rate, 2)
        },
        {
            "category": "Mixed Color Glass (Segregated)",
            "type": "mixed",
            "quantity_tons": round(m_tons, 2),
            "benchmark_rate_per_ton": avg_mixed_rate,
            "valuation_amount": round(m_tons * avg_mixed_rate, 2)
        },
        {
            "category": "Unseparated Cullet (Godown Intake)",
            "type": "unseparated",
            "quantity_tons": round(u_tons, 2),
            "benchmark_rate_per_ton": avg_unsep_rate,
            "valuation_amount": round(u_tons * avg_unsep_rate, 2)
        }
    ]

    total_closing_tons = round(w_tons + m_tons + u_tons, 2)
    total_stock_valuation = round(sum(i["valuation_amount"] for i in closing_inventory), 2)

    return {
        "company_name": "Flyera Traders",
        "division": "Glass Logistics & Circular Cullet Recycling Division",
        "fiscal_calendar": "Calendar Year (January 1 - December 31)",
        "generated_at": now.strftime("%d-%b-%Y %I:%M %p"),
        "period": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "label": f"{start_dt.strftime('%d-%b-%Y')} to {end_dt.strftime('%d-%b-%Y')}"
        },
        "pl_statement": {
            "gross_sales_revenue": total_sales_revenue,
            "white_sales_revenue": round(white_sales_rev, 2),
            "white_sales_tons": round(white_sales_tons, 2),
            "mixed_sales_revenue": round(mixed_sales_rev, 2),
            "mixed_sales_tons": round(mixed_sales_tons, 2),
            "total_sales_tons": total_sales_tons,

            "cost_of_materials_purchased": total_cullet_cost,
            "total_purchased_tons": total_collected_tons,

            "gross_profit": gross_profit,
            "gross_margin_percent": gross_margin_percent,

            "operating_expenses": {
                "fuel_and_diesel": round(fuel_exp, 2),
                "highway_tolls": round(toll_exp, 2),
                "vehicle_maintenance": round(maint_exp, 2),
                "other_logistics": round(other_exp, 2),
                "total_operating_expenses": total_trip_expenses
            },

            "net_operating_profit": net_profit,
            "net_margin_percent": net_margin_percent
        },
        "sales_ledger": sales_ledger,
        "purchases_ledger": purchases_ledger,
        "expenses_ledger": expenses_ledger,
        "closing_inventory": closing_inventory,
        "inventory_summary": {
            "total_stock_tons": total_closing_tons,
            "total_stock_valuation": total_stock_valuation
        }
    }

