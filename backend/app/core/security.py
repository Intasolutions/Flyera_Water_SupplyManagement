from datetime import datetime, timedelta
from typing import Optional, Any, Union, Dict
from jose import jwt
import logging
import os
import secrets
import bcrypt

from app.core.config import IS_PRODUCTION

logger = logging.getLogger("flyera.security")

# Publicly known keys from earlier versions of this repository. They must never sign tokens.
_KNOWN_WEAK_KEYS = {"", "aqua_glass_super_secret_key_change_in_production"}
_MIN_KEY_LENGTH = 32


def _load_secret_key() -> str:
    key = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY") or ""
    if key not in _KNOWN_WEAK_KEYS and len(key) >= _MIN_KEY_LENGTH:
        return key
    if IS_PRODUCTION:
        raise RuntimeError(f"Set SECRET_KEY to a private random value of at least {_MIN_KEY_LENGTH} characters.")
    logger.warning("SECRET_KEY is missing or weak: using a temporary key. Sessions and the UPI seal reset on every restart.")
    return secrets.token_urlsafe(48)


SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"

# Professional token lifespan: 30-min access token + 30-day sliding refresh token
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", 30))

# Compared against when a username does not exist, so both cases take the same time.
_DUMMY_HASH = bcrypt.hashpw(secrets.token_bytes(16), bcrypt.gensalt())


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    try:
        if not hashed_password:
            bcrypt.checkpw(plain_password.encode("utf-8"), _DUMMY_HASH)
            return False
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
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
    jti: str,
    token_version: int = 1,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create long-lived signed JWT refresh token. The jti links it to its database record for rotation."""
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "token_type": "refresh",
        "token_version": token_version,
        "jti": jti,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and cryptographically verify a JWT signature."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
