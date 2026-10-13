from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.database import get_db
from app import models
from app.api import deps

router = APIRouter()

DEFAULT_SETTINGS = {
    "company_name": "",
    "gstin": "",
    "support_email": "",
    "dispatch_hotline": "",
    "central_address": "",
    "gst_enabled": "true",
    "loyalty_rate": "0.50",
    "upi_id": ""
}

@router.get("", include_in_schema=False)
@router.get("/")
def get_settings(db: Session = Depends(get_db)) -> Dict[str, Any]:
    records = db.query(models.SystemSetting).all()
    result = dict(DEFAULT_SETTINGS)
    for r in records:
        result[r.key] = r.value
    return result

@router.post("", include_in_schema=False)
@router.post("/")
def update_settings(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN"]))
) -> Dict[str, Any]:
    for k, v in data.items():
        val_str = str(v) if v is not None else ""
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == k).first()
        if setting:
            setting.value = val_str
        else:
            db.add(models.SystemSetting(key=k, value=val_str))
    db.commit()
    return get_settings(db)
