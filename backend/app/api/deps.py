from typing import Generator, Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.database import SessionLocal
from app import models, schemas
from app.core import security

# Note: The tokenUrl matches the OAuth2 standard endpoint
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)
reusable_oauth2_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False
)

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    try:
        payload = security.decode_token(token)
        token_data = schemas.TokenPayload(**payload)
        
        # Verify this is strictly an access token (not a refresh token)
        if token_data.token_type and token_data.token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type: access token required",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except (JWTError, ValidationError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(models.User).filter(models.User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    # Check if user account has been disabled
    if hasattr(user, "is_active") and user.is_active is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")
        
    # Instant revocation check: if token version is older than DB version, reject immediately
    if hasattr(user, "token_version") and token_data.token_version:
        if user.token_version > token_data.token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    return user

def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if hasattr(current_user, "is_active") and current_user.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role != "ADMIN" and current_user.role != "Owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Administrator privileges required"
        )
    return current_user

def require_roles(allowed_roles: List[str]):
    """Role-based access control dependency guard."""
    def role_checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        user_role = getattr(current_user, "role", "")
        # Owner has superadmin privileges across all scopes
        if user_role == "Owner" or user_role in allowed_roles:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Requires one of roles: {allowed_roles}"
        )
    return role_checker

def get_optional_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2_optional)
) -> Optional[models.User]:
    if not token:
        return None
    try:
        payload = security.decode_token(token)
        token_data = schemas.TokenPayload(**payload)
        user = db.query(models.User).filter(models.User.id == token_data.sub).first()
        if user and getattr(user, "is_active", True) is not False:
            return user
        return None
    except Exception:
        return None
