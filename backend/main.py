import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app import models
from app.api.routers import users, clients, vehicles, inventory, routes, auth, assignments, deliveries, dashboard, glass

# Create all tables in the database (simple alternative to migrations for now)
Base.metadata.create_all(bind=engine)

# Auto-migrate any new columns safely for SQLite / Postgres
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        for col in ["latitude REAL", "longitude REAL"]:
            try:
                conn.execute(text(f"ALTER TABLE glass_collections ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
except Exception as e:
    print("Database migration check note:", e)

app = FastAPI(title="Water Supply API", redirect_slashes=False)

# Configure CORS so the frontend can communicate with the backend
cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins, # Allow configured origins
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

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend is running!"}






