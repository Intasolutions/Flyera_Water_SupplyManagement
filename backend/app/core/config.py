"""Environment settings shared by the server, maintenance scripts and tests."""
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]

# Real environment variables win over the .env file.
load_dotenv(BACKEND_DIR / ".env")

APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

UPLOADS_DIR = BACKEND_DIR / "uploads"

# Daily figures follow the business time zone. India has no daylight saving, so a fixed offset is enough.
UTC_OFFSET_MINUTES = int(os.environ.get("APP_UTC_OFFSET_MINUTES", "330"))


def _resolve_database_url(url: str) -> str:
    """Anchors relative SQLite paths to the backend folder and selects the installed PostgreSQL driver."""
    sqlite_prefix = "sqlite:///"
    if url.startswith(sqlite_prefix):
        path = url[len(sqlite_prefix):]
        if path and path != ":memory:" and not os.path.isabs(path):
            return sqlite_prefix + (BACKEND_DIR / path).resolve().as_posix()
        return url
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _resolve_database_url(os.environ.get("DATABASE_URL", "sqlite:///./water_supply.db"))


def cors_origins() -> List[str]:
    """Browsers normally reach the API through the Next.js proxy, so only list origins that call it directly."""
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if IS_PRODUCTION and "*" in origins:
        raise RuntimeError("CORS_ORIGINS must list exact origins in production, not '*'.")
    return origins
