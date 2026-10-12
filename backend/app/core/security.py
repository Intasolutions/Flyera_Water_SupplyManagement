from datetime import datetime, timedelta
from typing import Optional, Any, Union, Dict
from jose import jwt
import os
import bcrypt

# Cryptographically strong secret key configurable via environment variable
SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY", "aqua_glass_super_secret_key_change_in_production")
ALGORITHM = "HS256"

# Professional token lifespan: 30-min access token + 30-day sliding refresh token
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", 30))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(
    subject: Union[str, Any],
    role: Optional[str] = None,
    name: Optional[str] = None,
    token_version: int = 1,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create short-lived signed JWT access token with enriched claims."""
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "token_type": "access",
        "token_version": token_version,
        "exp": expire,
        "iat": now,
    }
    if role:
        to_encode["role"] = role
    if name:
        to_encode["name"] = name

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(
    subject: Union[str, Any],
    token_version: int = 1,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create long-lived signed JWT refresh token for silent rotation."""
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "token_type": "refresh",
        "token_version": token_version,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    """Decode and cryptographically verify a JWT signature."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
