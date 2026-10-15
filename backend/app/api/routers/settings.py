import hmac
import hashlib
import re
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app import models
from app.api import deps
from app.core import security

router = APIRouter()

DEFAULT_SETTINGS = {
    "company_name": "",
    "gstin": "",
    "support_email": "",
    "dispatch_hotline": "",
    "central_address": "",
    "gst_enabled": "true",
    "loyalty_rate": "0.50",
    "upi_id": "",
    "upi_id_hmac": ""
}

# Standard NPCI UPI VPA regex: username@psp (e.g., flyera@okhdfcbank, business.water@icici)
UPI_VPA_REGEX = re.compile(r"^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z]{2,64}$")

def compute_upi_hmac(upi_id: str) -> str:
    """Computes a cryptographically secure HMAC-SHA256 signature for the UPI VPA."""
    if not upi_id:
        return ""
    key = security.SECRET_KEY.encode("utf-8")
    return hmac.new(key, upi_id.strip().lower().encode("utf-8"), hashlib.sha256).hexdigest()

def verify_upi_integrity(upi_id: str, stored_hmac: Optional[str]) -> bool:
    """Verifies that the UPI ID in database has not been tampered with or modified via raw SQL."""
    if not upi_id:
        return True
    if not stored_hmac:
        return False
    expected = compute_upi_hmac(upi_id)
    return hmac.compare_digest(expected, stored_hmac)


class SecureUpiUpdateRequest(BaseModel):
    upi_id: str = Field(..., min_length=4, max_length=120)
    admin_password: str = Field(..., min_length=4)


@router.get("", include_in_schema=False)
@router.get("/")
def get_settings(db: Session = Depends(get_db)) -> Dict[str, Any]:
    records = db.query(models.SystemSetting).all()
    result = dict(DEFAULT_SETTINGS)
    for r in records:
        result[r.key] = r.value

    # Cryptographic integrity check: detect any offline database tampering
    raw_upi = (result.get("upi_id") or "").strip()
    stored_hmac = result.get("upi_id_hmac")

    if raw_upi:
        is_authentic = verify_upi_integrity(raw_upi, stored_hmac)
        result["upi_verified"] = is_authentic
        if not is_authentic:
            # Alert: HMAC seal failed!
            result["upi_security_alert"] = "WARNING: Database integrity seal mismatch! UPI ID may have been tampered with."
            print(f"[SECURITY ALERT] Tamper detection: Stored UPI '{raw_upi}' does not match HMAC seal!")
    else:
        result["upi_verified"] = True

    return result


@router.post("/secure-upi")
def update_secure_upi(
    payload: SecureUpiUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
) -> Dict[str, Any]:
    """
    Sudo-mode protected endpoint to modify company merchant receiving UPI ID.
    Requires:
    1. SuperAdmin / Owner privilege.
    2. Re-authentication via SuperAdmin current account password.
    3. Strict NPCI VPA format validation.
    4. Generation of HMAC-SHA256 tamper-evident seal.
    5. Immutable payment audit log entry.
    """
    # 1. Sudo re-authentication: verify admin password
    if not current_user.hashed_password or not security.verify_password(payload.admin_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication failed. You must provide your correct Administrator password to change the merchant payout UPI ID."
        )

    # 2. Strict NPCI VPA format check
    clean_upi = payload.upi_id.strip()
    if not UPI_VPA_REGEX.match(clean_upi):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UPI ID format. Expected standard NPCI VPA (e.g. business@okhdfcbank or merchant@icici)."
        )

    # 3. Compute cryptographic HMAC-SHA256 seal
    new_hmac = compute_upi_hmac(clean_upi)

    # 4. Save to database
    for k, v in [("upi_id", clean_upi), ("upi_id_hmac", new_hmac)]:
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == k).first()
        if setting:
            setting.value = v
        else:
            db.add(models.SystemSetting(key=k, value=v))
            
    # 5. Record in immutable payment audit logs
    try:
        db.execute(text("""
            INSERT INTO payment_audit_logs (id, delivery_id, action, amount, payment_mode, upi_reference, verified_by, notes, created_at)
            VALUES (:id, NULL, :action, 0.0, 'UPI_CONFIG', :upi_reference, :verified_by, :notes, :created_at)
        """), {
            "id": str(uuid.uuid4()),
            "action": "UPDATE_MERCHANT_UPI",
            "upi_reference": clean_upi,
            "verified_by": f"{current_user.name} ({current_user.username})",
            "notes": f"Merchant UPI ID updated with HMAC seal: {new_hmac[:12]}...",
            "created_at": datetime.utcnow()
        })
    except Exception as log_err:
        print("Audit log note:", log_err)

    db.commit()
    return get_settings(db)


@router.post("", include_in_schema=False)
@router.post("/")
def update_settings(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
) -> Dict[str, Any]:
    # Security guard: Prevent modifying 'upi_id' or 'upi_id_hmac' via standard unverified batch update
    for k, v in data.items():
        if k in ["upi_id", "upi_id_hmac"]:
            continue  # Must use /api/settings/secure-upi with password confirmation
        val_str = str(v) if v is not None else ""
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == k).first()
        if setting:
            setting.value = val_str
        else:
            db.add(models.SystemSetting(key=k, value=val_str))
    db.commit()
    return get_settings(db)


@router.get("/signed-upi-qr")
def get_signed_upi_qr(
    amount: float,
    note: Optional[str] = "Water Supply Payment",
    delivery_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    """
    Server-side generation of authenticated UPI Payment URI.
    Validates the HMAC cryptographic seal before building payment intent string.
    """
    settings = get_settings(db)
    raw_upi = settings.get("upi_id") or "flyera@okhdfcbank"
    
    if not settings.get("upi_verified", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Merchant UPI integrity check failed. Please re-verify UPI ID in Admin Settings."
        )

    company_name = settings.get("company_name") or "Flyera Water Supply"
    safe_company = re.sub(r'[^a-zA-Z0-9\s]', '', company_name).strip().replace(" ", "%20")
    safe_note = re.sub(r'[^a-zA-Z0-9\s\-#]', '', note or "Payment").strip().replace(" ", "%20")
    
    # UPI standard deep link
    upi_uri = f"upi://pay?pa={raw_upi}&pn={safe_company}&am={amount:.2f}&tn={safe_note}&cu=INR"
    
    return {
        "upi_uri": upi_uri,
        "upi_id": raw_upi,
        "amount": amount,
        "company_name": company_name,
        "is_verified": True
    }
