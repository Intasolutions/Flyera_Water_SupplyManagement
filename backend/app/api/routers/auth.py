from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError
from pydantic import ValidationError

from app import models, schemas
from app.api import deps
from app.core import security

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
def login_access_token(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, returns short-lived access token + long-lived refresh token
    """
    # Try finding user by username first, if not found, try by phone
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user:
        user = db.query(models.User).filter(models.User.phone == form_data.username).first()
        
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if hasattr(user, "is_active") and user.is_active is False:
        raise HTTPException(status_code=403, detail="User account is deactivated. Contact admin.")
    
    if not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    user_token_version = getattr(user, "token_version", 1) or 1
    
    access_token = security.create_access_token(
        subject=user.id,
        role=user.role,
        name=user.name,
        token_version=user_token_version,
    )
    refresh_token = security.create_refresh_token(
        subject=user.id,
        token_version=user_token_version,
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": str(user.id),
            "name": str(user.name or ""),
            "username": user.username,
            "role": user.role,
            "phone": user.phone,
            "address": user.address,
            "id_proof_url": user.id_proof_url,
            "assigned_vehicle_id": user.assigned_vehicle_id,
            "is_active": bool(getattr(user, "is_active", True)),
            "token_version": user_token_version,
            "created_at": user.created_at.isoformat() if hasattr(user.created_at, "isoformat") else str(user.created_at or ""),
            "updated_at": user.updated_at.isoformat() if hasattr(user.updated_at, "isoformat") else str(user.updated_at or ""),
        }
    }

@router.post("/refresh", response_model=schemas.Token)
def refresh_access_token(
    request: schemas.RefreshTokenRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Silent token rotation: Exchange a valid refresh token for a fresh short-lived access token
    and a new rotating refresh token.
    """
    try:
        payload = security.decode_token(request.refresh_token)
        if payload.get("token_type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type: refresh token expected"
            )
        user_id = payload.get("sub")
        token_version = payload.get("token_version", 1)
    except (JWTError, ValidationError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account no longer exists")
        
    if hasattr(user, "is_active") and user.is_active is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")
        
    user_token_version = getattr(user, "token_version", 1) or 1
    if user_token_version > token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please log in again."
        )
        
    # Generate fresh access token and rotated refresh token
    new_access_token = security.create_access_token(
        subject=user.id,
        role=user.role,
        name=user.name,
        token_version=user_token_version,
    )
    new_refresh_token = security.create_refresh_token(
        subject=user.id,
        token_version=user_token_version,
    )
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }

@router.post("/revoke-tokens")
def revoke_all_user_sessions(
    current_user: models.User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Security kill-switch: Revoke all active access and refresh tokens for this user across all devices.
    """
    current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
    db.commit()
    return {"message": "All active sessions have been revoked successfully"}

@router.post("/test-token", response_model=schemas.UserResponse)
def test_token(current_user: models.User = Depends(deps.get_current_user)) -> Any:
    """
    Test access token validity
    """
    return current_user

@router.get("/me", response_model=schemas.UserResponse)
@router.get("/me/", response_model=schemas.UserResponse, include_in_schema=False)
def read_current_user(
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current logged in user profile.
    """
    return {
        "id": str(current_user.id),
        "name": str(current_user.name or ""),
        "username": current_user.username,
        "role": current_user.role,
        "phone": current_user.phone,
        "address": current_user.address,
        "id_proof_url": current_user.id_proof_url,
        "assigned_vehicle_id": current_user.assigned_vehicle_id,
        "is_active": bool(getattr(current_user, "is_active", True)),
        "token_version": getattr(current_user, "token_version", 1) or 1,
        "created_at": current_user.created_at.isoformat() if hasattr(current_user.created_at, "isoformat") else str(current_user.created_at or ""),
        "updated_at": current_user.updated_at.isoformat() if hasattr(current_user.updated_at, "isoformat") else str(current_user.updated_at or ""),
    }
