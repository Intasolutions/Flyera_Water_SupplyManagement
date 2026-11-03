import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import IS_PRODUCTION, cors_origins
from app.database import engine, SessionLocal
from app.schema_sync import sync_schema
from app.api.routers import users, clients, vehicles, inventory, routes, auth, assignments, deliveries, dashboard, glass, settings, setup, expenses, reports

logging.basicConfig(level=logging.INFO)

# Create missing tables and columns. Additive only: existing data is never changed here.
sync_schema(engine)

app = FastAPI(
    title="Water Supply API",
    redirect_slashes=False,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Browsers normally use the Next.js proxy. This covers any origin listed for direct calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(vehicles.router, prefix="/api/vehicles", tags=["vehicles"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(routes.router, prefix="/api/routes", tags=["routes"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])
app.include_router(deliveries.router, prefix="/api/deliveries", tags=["deliveries"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(glass.router, prefix="/api/glass", tags=["glass"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(setup.router, prefix="/api/setup", tags=["setup"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend is running!"}


@app.get("/api/health")
@app.get("/api/health/")
def health_check():
    """Public uptime check. It reports no business data."""
    start = time.perf_counter()
    db = SessionLocal()
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        logging.getLogger("flyera.health").exception("Health check could not reach the database")
    finally:
        db.close()

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "db_latency_ms": round((time.perf_counter() - start) * 1000, 2),
        "timestamp": time.time()
    }
