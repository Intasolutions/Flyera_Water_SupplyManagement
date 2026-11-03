import threading
import time
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError

from app import models, schemas
from app.api import deps
from app.core import security
from app.core.timeutils import utcnow

router = APIRouter()

# Sign-in throttle, counted per login name. It lives in this process, so each server worker counts separately.
MAX_FAILED_LOGINS = 10
FAILED_LOGIN_WINDOW_SECONDS = 15 * 60
_failed_logins: Dict[str, List[float]] = {}
_failed_logins_lock = threading.Lock()

# Two browser tabs can refresh at the same moment, so a just-rotated token stays usable very briefly.
ROTATION_GRACE_SECONDS = 30


def _recent_failures(key: str) -> int:
    cutoff = time.monotonic() - FAILED_LOGIN_WINDOW_SECONDS
    with _failed_logins_lock:
        recent = [moment for moment in _failed_logins.get(key, []) if moment > cutoff]
        if recent:
            _failed_logins[key] = recent
        else:
            _failed_logins.pop(key, None)
        return len(recent)


def _record_failure(key: str) -> None:
    with _failed_logins_lock:
        _failed_logins.setdefault(key, []).append(time.monotonic())


def _clear_failures(key: str) -> None:
    with _failed_logins_lock:
        _failed_logins.pop(key, None)


def _issue_tokens(db: Session, user: models.User) -> Dict[str, Any]:
    token_version = user.token_version or 1
    jti = uuid.uuid4().hex
    now = utcnow()
    db.query(models.RefreshToken).filter(
        models.RefreshToken.user_id == user.id,
        models.RefreshToken.expires_at < now,
    ).delete(synchronize_session=False)
    db.add(models.RefreshToken(
        jti=jti,
        user_id=user.id,
        expires_at=now + timedelta(days=security.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    return {
        "access_token": security.create_access_token(
            subject=user.id,
            role=user.role,
            name=user.name,
            token_version=token_version,
        ),
        "refresh_token": security.create_refresh_token(subject=user.id, jti=jti, token_version=token_version),
        "token_type": "bearer",
        "expires_in": security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/login", response_model=schemas.Token)
def login_access_token(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, returns short-lived access token + long-lived refresh token
    """
    throttle_key = form_data.username.strip().lower()
    if _recent_failures(throttle_key) >= MAX_FAILED_LOGINS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Please wait 15 minutes and try again.",
        )

    # Try finding user by username first, if not found, try by phone
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user:
        user = db.query(models.User).filter(models.User.phone == form_data.username).first()

    # The same answer for a wrong name and a wrong password, so accounts cannot be discovered.
    if not security.verify_password(form_data.password, user.hashed_password if user else None):
        _record_failure(throttle_key)
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    if user.is_active is False:
        raise HTTPException(status_code=403, detail="User account is deactivated. Contact admin.")

    _clear_failures(throttle_key)
    tokens = _issue_tokens(db, user)
    db.commit()
    tokens["user"] = schemas.UserResponse.model_validate(user).model_dump(mode="json")
    return tokens


@router.post("/refresh", response_model=schemas.Token)
def refresh_access_token(
    request: schemas.RefreshTokenRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Token rotation: exchanges a valid refresh token for a new pair. The old one then stops working.
    Using an old token again after the grace period is treated as theft and ends all of that user's sessions.
    """
    invalid_token = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token"
    )
    try:
        payload = security.decode_token(request.refresh_token)
    except JWTError:
        raise invalid_token
    jti: Optional[str] = payload.get("jti")
    if payload.get("token_type") != "refresh" or not jti:
        raise invalid_token

    record = db.query(models.RefreshToken).filter(models.RefreshToken.jti == jti).first()
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not record or record.revoked_at or not user or user.is_active is False:
        raise invalid_token
    if (user.token_version or 1) > payload.get("token_version", 1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked. Please log in again.")

    now = utcnow()
    if record.rotated_at and (now - record.rotated_at).total_seconds() > ROTATION_GRACE_SECONDS:
        user.token_version = (user.token_version or 1) + 1
        db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user.id).update(
            {models.RefreshToken.revoked_at: now}, synchronize_session=False
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked. Please log in again.")

    record.rotated_at = record.rotated_at or now
    tokens = _issue_tokens(db, user)
    db.commit()
    return tokens


@router.post("/logout")
def logout(
    request: schemas.RefreshTokenRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """Ends this device's session. Always answers success, so it reveals nothing about the token."""
    try:
        jti = security.decode_token(request.refresh_token).get("jti")
    except JWTError:
        jti = None
    if jti:
        db.query(models.RefreshToken).filter(models.RefreshToken.jti == jti).update(
            {models.RefreshToken.revoked_at: utcnow()}, synchronize_session=False
        )
        db.commit()
    return {"message": "Signed out"}


@router.post("/revoke-tokens")
def revoke_all_user_sessions(
    user_id: Optional[str] = None,
    current_user: models.User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Security kill-switch: ends all sessions for this user, or for another user when an administrator asks.
    """
    target = current_user
    if user_id and user_id != current_user.id:
        if not deps.is_admin(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to do this.")
        target = db.query(models.User).filter(models.User.id == user_id).first()
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target.token_version = (target.token_version or 1) + 1
    db.commit()
    return {"message": "All active sessions have been revoked successfully", "token_version": target.token_version}


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
    return current_user
