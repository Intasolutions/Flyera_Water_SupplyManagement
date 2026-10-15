import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app import models
from app.database import get_db
from app.core import security

router = APIRouter()

class ProductionSetupRequest(BaseModel):
    master_key: Optional[str] = None
    confirm_wipe: str
    name: str = Field(..., min_length=2)
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)
    phone: Optional[str] = None
    company_name: Optional[str] = None
    dispatch_hotline: Optional[str] = None
    upi_id: Optional[str] = None

@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    """Returns the current counts of records across database tables."""
    user_count = db.query(models.User).count()
    client_count = db.query(models.Client).count()
    vehicle_count = db.query(models.Vehicle).count()
    route_count = db.query(models.Route).count()
    assignment_count = db.query(models.Assignment).count()
    delivery_count = db.query(models.Delivery).count()
    inv_type_count = db.query(models.InventoryType).count()
    glass_col_count = db.query(models.GlassCollection).count()
    
    return {
        "is_clean": user_count == 0,
        "total_users": user_count,
        "total_clients": client_count,
        "total_vehicles": vehicle_count,
        "total_routes": route_count,
        "total_assignments": assignment_count,
        "total_deliveries": delivery_count,
        "total_inventory_types": inv_type_count,
        "total_glass_collections": glass_col_count
    }

@router.post("/reset-and-create-superuser")
def reset_and_create_superuser(
    payload: ProductionSetupRequest,
    db: Session = Depends(get_db)
):
    """
    Wipes all existing database records 100% clean and initializes a single
    production Superuser (ADMIN role).
    """
    if payload.confirm_wipe != "WIPE_ALL_DATA":
        raise HTTPException(
            status_code=400,
            detail="Confirmation string must be 'WIPE_ALL_DATA' to authorize complete database wipe."
        )

    # Master key verification
    existing_users = db.query(models.User).count()
    env_master_key = os.environ.get("SETUP_MASTER_KEY")

    if existing_users > 0:
        if not env_master_key:
            raise HTTPException(
                status_code=403,
                detail="Production database wipe is disabled. SETUP_MASTER_KEY environment variable is not configured on this server."
            )
        if not payload.master_key or payload.master_key.strip() != env_master_key.strip():
            raise HTTPException(
                status_code=403,
                detail="Invalid master authorization key. Complete database wipe unauthorized."
            )

    try:
        # 1. Delete all relational child tables first to respect foreign keys
        db.query(models.DeliveryItem).delete()
        db.query(models.Delivery).delete()
        db.query(models.Allocation).delete()
        db.query(models.Assignment).delete()
        db.query(models.Stock).delete()
        db.query(models.InventoryType).delete()
        db.query(models.Client).delete()
        db.query(models.Vehicle).delete()
        db.query(models.Route).delete()
        db.query(models.GlassCollection).delete()
        db.query(models.GlassSeparation).delete()
        db.query(models.GlassVendorPickup).delete()
        db.query(models.GlassInventory).delete()
        db.query(models.User).delete()

        # 2. Create the clean production Superuser
        superuser = models.User(
            name=payload.name.strip(),
            username=payload.username.strip(),
            role="ADMIN",
            phone=payload.phone.strip() if payload.phone else None,
            hashed_password=security.get_password_hash(payload.password),
            is_active=True,
            token_version=1
        )
        db.add(superuser)

        # 3. Optional update of system settings if provided
        if payload.company_name:
            c_name = db.query(models.SystemSetting).filter(models.SystemSetting.key == "company_name").first()
            if c_name:
                c_name.value = payload.company_name.strip()
            else:
                db.add(models.SystemSetting(key="company_name", value=payload.company_name.strip()))

        if payload.dispatch_hotline:
            d_hotline = db.query(models.SystemSetting).filter(models.SystemSetting.key == "dispatch_hotline").first()
            if d_hotline:
                d_hotline.value = payload.dispatch_hotline.strip()
            else:
                db.add(models.SystemSetting(key="dispatch_hotline", value=payload.dispatch_hotline.strip()))

        if payload.upi_id:
            from app.api.routers.settings import compute_upi_hmac
            clean_upi = payload.upi_id.strip()
            hmac_seal = compute_upi_hmac(clean_upi)
            for k, v in [("upi_id", clean_upi), ("upi_id_hmac", hmac_seal)]:
                row = db.query(models.SystemSetting).filter(models.SystemSetting.key == k).first()
                if row:
                    row.value = v
                else:
                    db.add(models.SystemSetting(key=k, value=v))

        db.commit()
        db.refresh(superuser)

        return {
            "status": "success",
            "message": "All software data wiped 100% clean. Production Superuser created successfully.",
            "user": {
                "id": superuser.id,
                "name": superuser.name,
                "username": superuser.username,
                "role": superuser.role,
                "phone": superuser.phone
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database wipe and superuser creation failed: {str(e)}"
        )
