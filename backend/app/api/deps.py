from typing import Generator, List, Tuple
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.database import SessionLocal
from app import models, schemas
from app.core import security

# --- Role groups ---
ADMIN_ROLES: Tuple[str, ...] = ("ADMIN", "Owner")
WATER_OFFICE: List[str] = ["WATER_STAFF"]
WATER_FIELD: List[str] = ["DRIVER", "HELPER"]
WATER_ALL: List[str] = WATER_OFFICE + WATER_FIELD
GLASS_OFFICE: List[str] = ["GLASS_STAFF"]
GLASS_FIELD: List[str] = ["GLASS_DRIVER"]
GLASS_ALL: List[str] = GLASS_OFFICE + GLASS_FIELD

# Note: The tokenUrl matches the OAuth2 standard endpoint
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
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
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = security.decode_token(token)
        token_data = schemas.TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise credentials_error

    # Verify this is strictly an access token (not a refresh token)
    if token_data.token_type != "access":
        raise credentials_error

    user = db.query(models.User).filter(models.User.id == token_data.sub).first()
    if not user or user.is_active is False:
        raise credentials_error

    # Instant revocation check: if token version is older than DB version, reject immediately
    if (user.token_version or 1) > (token_data.token_version or 1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    return current_user

def is_admin(user: models.User) -> bool:
    return user.role in ADMIN_ROLES

def require_roles(allowed_roles: List[str]):
    """Role-based access control dependency guard. Administrators are always allowed."""
    def role_checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        if is_admin(current_user) or current_user.role in allowed_roles:
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to do this.")
    return role_checker

def is_assigned(user: models.User, assignment: models.Assignment) -> bool:
    return user.id in (assignment.driver_id, assignment.helper_id)

def can_manage_assignment(user: models.User, assignment: models.Assignment) -> bool:
    """Office staff and administrators of the business that owns this assignment."""
    if is_admin(user):
        return True
    office = GLASS_OFFICE if assignment.business_type == "GLASS" else WATER_OFFICE
    return user.role in office

def ensure_assignment_access(user: models.User, assignment: models.Assignment) -> None:
    if not (can_manage_assignment(user, assignment) or is_assigned(user, assignment)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This route is not assigned to you.")
