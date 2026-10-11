from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, time

from app import schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

def ensure_initial_data(db: Session):
    """Ensures inventory types exist with 0.0 tons initialized if missing, and purges auto-seeded mock data."""
    for inv_type in ["unseparated", "white", "mixed"]:
        inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == inv_type).first()
        if not inv:
            inv = models.GlassInventory(type=inv_type, tons=0.0)
            db.add(inv)
            db.commit()

    # Automatically clean up legacy auto-seeded mock entries if present
    demo_props = ["Sunshine Resort", "Tech Park Horizon", "Grand Ocean Hotel"]
    demo_colls = db.query(models.GlassCollection).filter(models.GlassCollection.property.in_(demo_props)).all()
    if demo_colls:
        for dc in demo_colls:
            db.delete(dc)
        db.commit()

    demo_vendors = ["EcoRecycle Mills Pvt Ltd", "Maharashtra Cullet Processors"]
    demo_pickups = db.query(models.GlassVendorPickup).filter(models.GlassVendorPickup.vendor_name.in_(demo_vendors)).all()
    if demo_pickups:
        for dp in demo_pickups:
            db.delete(dp)
        db.commit()

    # If all remaining collections and pickups are 0, reset any legacy mock inventory balances to 0.0
    remaining_colls = db.query(models.GlassCollection).count()
    remaining_pickups = db.query(models.GlassVendorPickup).count()
    if remaining_colls == 0 and remaining_pickups == 0:
        for inv in db.query(models.GlassInventory).all():
            if inv.tons in [6.7, 8.5, 12.0, 27.2]:
                inv.tons = 0.0
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


# --- Dashboard Stats ---

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

    # Query Collections
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
            "location": c.location,
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
        "recentPickups": recent_pickups,
        "recent_pickups": recent_pickups,
        "recentCollections": recent_collections,
        "recent_collections": recent_collections
    }


# --- Collections Endpoints ---

@router.post("/collect", response_model=schemas.GlassCollectionResponse)
def log_collection(
    collection: schemas.GlassCollectionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(deps.get_optional_current_user)
):
    ensure_initial_data(db)
    coll_data = collection.model_dump()
    
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
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    ensure_initial_data(db)
    query = db.query(models.GlassCollection)
    if status:
        query = query.filter(models.GlassCollection.status == status)
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
            "location": c.location,
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
