import hmac
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app import crud, models
from app.core import security
from app.core.config import IS_PRODUCTION
from app.database import get_db

router = APIRouter()

class ProductionSetupRequest(BaseModel):
    master_key: Optional[str] = None
    confirm_wipe: str
    name: str = Field(..., min_length=2)
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    phone: Optional[str] = None
    company_name: Optional[str] = None
    dispatch_hotline: Optional[str] = None
    upi_id: Optional[str] = None

def _master_key_required(existing_users: int, configured_key: Optional[str]) -> bool:
    return existing_users > 0 or bool(configured_key) or IS_PRODUCTION

@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    """Public: says only whether first-time setup is still open, never how much data exists."""
    existing_users = db.query(models.User).count()
    return {
        "is_clean": existing_users == 0,
        "master_key_required": _master_key_required(existing_users, os.environ.get("SETUP_MASTER_KEY")),
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
    env_master_key = (os.environ.get("SETUP_MASTER_KEY") or "").strip()

    if _master_key_required(existing_users, env_master_key):
        if not env_master_key:
            raise HTTPException(
                status_code=403,
                detail="Production database wipe is disabled. SETUP_MASTER_KEY environment variable is not configured on this server."
            )
        if not hmac.compare_digest((payload.master_key or "").strip().encode(), env_master_key.encode()):
            raise HTTPException(
                status_code=403,
                detail="Invalid master authorization key. Complete database wipe unauthorized."
            )

    try:
        # 1. Delete every table, children before parents
        crud.wipe_all_data(db)

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

        # 3. Optional system settings
        if payload.company_name:
            db.add(models.SystemSetting(key="company_name", value=payload.company_name.strip()))

        if payload.dispatch_hotline:
            db.add(models.SystemSetting(key="dispatch_hotline", value=payload.dispatch_hotline.strip()))

        if payload.upi_id:
            from app.api.routers.settings import compute_upi_hmac
            clean_upi = payload.upi_id.strip()
            db.add(models.SystemSetting(key="upi_id", value=clean_upi))
            db.add(models.SystemSetting(key="upi_id_hmac", value=compute_upi_hmac(clean_upi)))

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
