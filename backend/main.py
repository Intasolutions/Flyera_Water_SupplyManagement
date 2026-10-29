import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app import models
from app.api.routers import users, clients, vehicles, inventory, routes, auth, assignments, deliveries, dashboard, glass, settings, setup, expenses, reports

# Create all tables in the database (simple alternative to migrations for now)
Base.metadata.create_all(bind=engine)

# Auto-migrate any new columns safely for SQLite / Postgres
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        for col in ["latitude REAL", "longitude REAL", "property_id VARCHAR", "assignment_id VARCHAR"]:
            try:
                conn.execute(text(f"ALTER TABLE glass_collections ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        for col in ["business_type VARCHAR DEFAULT 'WATER'"]:
            try:
                conn.execute(text(f"ALTER TABLE routes ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        for col in ["business_type VARCHAR DEFAULT 'WATER'", "target_capacity_tons REAL DEFAULT 0.0"]:
            try:
                conn.execute(text(f"ALTER TABLE assignments ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        # Glass Properties table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS glass_properties (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    category VARCHAR DEFAULT 'Hotel & Resort',
                    contact_person VARCHAR,
                    phone VARCHAR,
                    address VARCHAR,
                    latitude REAL,
                    longitude REAL,
                    route_id VARCHAR REFERENCES routes(id) ON DELETE SET NULL,
                    pickup_frequency VARCHAR DEFAULT 'Daily',
                    notes VARCHAR,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
        except Exception:
            pass
        for col in ["is_active BOOLEAN DEFAULT 1", "token_version INTEGER DEFAULT 1", "driving_license VARCHAR"]:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        for col in ["petty_cash REAL DEFAULT 0.0"]:
            try:
                conn.execute(text(f"ALTER TABLE assignments ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        for col in ["credit_amount REAL DEFAULT 0.0"]:
            try:
                conn.execute(text(f"ALTER TABLE clients ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        for col in ["upi_reference VARCHAR", "verified_at TIMESTAMP", "verified_by VARCHAR", "notes VARCHAR", "paid_amount REAL DEFAULT 0.0"]:
            try:
                conn.execute(text(f"ALTER TABLE deliveries ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        # Trip Expenses table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS trip_expenses (
                    id VARCHAR PRIMARY KEY,
                    assignment_id VARCHAR REFERENCES assignments(id) ON DELETE CASCADE,
                    reported_by VARCHAR REFERENCES users(id),
                    category VARCHAR NOT NULL DEFAULT 'OTHER',
                    amount REAL NOT NULL,
                    paid_from_inhand BOOLEAN DEFAULT 1,
                    inhand_amount REAL DEFAULT 0.0,
                    description VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
        except Exception:
            pass
        for col in ["paid_from_inhand BOOLEAN DEFAULT 1", "inhand_amount REAL DEFAULT 0.0"]:
            try:
                conn.execute(text(f"ALTER TABLE trip_expenses ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass
        # Bottle Credit Ledger table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS bottle_credit_ledger (
                    id VARCHAR PRIMARY KEY,
                    client_id VARCHAR REFERENCES clients(id) ON DELETE CASCADE,
                    assignment_id VARCHAR REFERENCES assignments(id) ON DELETE SET NULL,
                    inventory_type_id VARCHAR REFERENCES inventory_types(id),
                    quantity INTEGER NOT NULL,
                    notes VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
        except Exception:
            pass

        # Payment Audit Logs table for tamper-evident tracking
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS payment_audit_logs (
                    id VARCHAR PRIMARY KEY,
                    delivery_id VARCHAR REFERENCES deliveries(id) ON DELETE SET NULL,
                    action VARCHAR NOT NULL,
                    amount REAL NOT NULL,
                    payment_mode VARCHAR,
                    upi_reference VARCHAR,
                    verified_by VARCHAR,
                    ip_address VARCHAR,
                    notes VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
        except Exception:
            pass

        # High-performance database indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_deliveries_assignment ON deliveries(assignment_id)",
            "CREATE INDEX IF NOT EXISTS idx_deliveries_client ON deliveries(client_id)",
            "CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)",
            "CREATE INDEX IF NOT EXISTS idx_deliveries_upi ON deliveries(upi_reference)",
            "CREATE INDEX IF NOT EXISTS idx_deliveries_created ON deliveries(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_assignments_driver ON assignments(driver_id)",
            "CREATE INDEX IF NOT EXISTS idx_assignments_helper ON assignments(helper_id)",
            "CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status)",
            "CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date)",
            "CREATE INDEX IF NOT EXISTS idx_clients_route ON clients(route_id)",
            "CREATE INDEX IF NOT EXISTS idx_allocations_assignment ON allocations(assignment_id)",
            "CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id)",
        ]
        for idx in indexes:
            try:
                conn.execute(text(idx))
                conn.commit()
            except Exception:
                pass
except Exception as e:
    print("Database migration check note:", e)

# Demo staff seeding only if explicitly enabled via environment variable
if os.environ.get("ENABLE_DEMO_SEED", "false").lower() == "true":
    try:
        from app.database import SessionLocal
        from app.core import security
        _db = SessionLocal()
        _ws = _db.query(models.User).filter(models.User.username == "water_staff").first()
        if not _ws:
            _ws_user = models.User(
                name="Priya Sharma (Water Staff)",
                username="water_staff",
                phone="9123456780",
                role="WATER_STAFF",
                hashed_password=security.get_password_hash("password123"),
                is_active=True,
                token_version=1
            )
            _db.add(_ws_user)
            _db.commit()
        _db.close()
    except Exception as e:
        print("Staff seed check note:", e)

app = FastAPI(title="Water Supply API", redirect_slashes=False)

# Configure CORS so the frontend can communicate with the backend
cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_origin_regex=".*",
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
    import time
    from app.database import SessionLocal
    start = time.perf_counter()
    db = SessionLocal()
    db_ok = False
    counts = {}
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
        client_cnt = db.query(models.Client).count()
        assign_cnt = db.query(models.Assignment).count()
        vehicle_cnt = db.query(models.Vehicle).count()
        counts = {
            "clients": client_cnt,
            "assignments": assign_cnt,
            "vehicles": vehicle_cnt
        }
    except Exception as e:
        print("Health check DB error:", e)
    finally:
        db.close()

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "db_latency_ms": elapsed_ms,
        "metrics": counts,
        "timestamp": time.time()
    }







