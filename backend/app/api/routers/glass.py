from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

# --- Collections ---

@router.post("/collect", response_model=schemas.GlassCollectionResponse)
def log_collection(
    collection: schemas.GlassCollectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_collection = models.GlassCollection(**collection.model_dump())
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection

@router.get("/collections", response_model=List[schemas.GlassCollectionResponse])
def get_collections(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    query = db.query(models.GlassCollection)
    if status:
        query = query.filter(models.GlassCollection.status == status)
    return query.all()

@router.post("/dropoff/{collection_id}", response_model=schemas.GlassCollectionResponse)
def dropoff_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_collection = db.query(models.GlassCollection).filter(models.GlassCollection.id == collection_id).first()
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection not found")
        
    if db_collection.status != "collected":
        raise HTTPException(status_code=400, detail="Collection is not in 'collected' state")
        
    db_collection.status = "dropped_at_godown"
    
    # Increase unseparated inventory
    unseparated_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if not unseparated_inv:
        unseparated_inv = models.GlassInventory(type="unseparated", tons=0)
        db.add(unseparated_inv)
        
    unseparated_inv.tons += db_collection.tons_collected
    
    db.commit()
    db.refresh(db_collection)
    return db_collection

# --- Segregation ---

@router.post("/separate", response_model=schemas.GlassSeparationResponse)
def separate_glass(
    separation: schemas.GlassSeparationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    # Verify we have enough unseparated inventory
    unseparated_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "unseparated").first()
    if not unseparated_inv or unseparated_inv.tons < separation.tons_separated:
        raise HTTPException(status_code=400, detail="Not enough unseparated glass in inventory")
        
    # Create separation record
    db_separation = models.GlassSeparation(**separation.model_dump())
    db.add(db_separation)
    
    # Deduct from unseparated
    unseparated_inv.tons -= separation.tons_separated
    
    # Add to white and mixed
    white_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "white").first()
    if not white_inv:
        white_inv = models.GlassInventory(type="white", tons=0)
        db.add(white_inv)
    white_inv.tons += separation.white_tons
    
    mixed_inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == "mixed").first()
    if not mixed_inv:
        mixed_inv = models.GlassInventory(type="mixed", tons=0)
        db.add(mixed_inv)
    mixed_inv.tons += separation.mixed_tons
    
    # If this separation was tied to a specific collection, update its status
    if separation.collection_id:
        db_collection = db.query(models.GlassCollection).filter(models.GlassCollection.id == separation.collection_id).first()
        if db_collection:
            db_collection.status = "separated"
            
    db.commit()
    db.refresh(db_separation)
    return db_separation

# --- Vendor Pickups ---

@router.post("/vendor-pickup", response_model=schemas.GlassVendorPickupResponse)
def vendor_pickup(
    pickup: schemas.GlassVendorPickupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    # Verify stock
    inv = db.query(models.GlassInventory).filter(models.GlassInventory.type == pickup.type).first()
    if not inv or inv.tons < pickup.tons:
        raise HTTPException(status_code=400, detail=f"Not enough {pickup.type} glass in inventory")
        
    # Record pickup
    db_pickup = models.GlassVendorPickup(**pickup.model_dump())
    db.add(db_pickup)
    
    # Deduct stock
    inv.tons -= pickup.tons
    
    db.commit()
    db.refresh(db_pickup)
    return db_pickup

@router.get("/inventory", response_model=List[schemas.GlassInventoryResponse])
def get_glass_inventory(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    return db.query(models.GlassInventory).all()
