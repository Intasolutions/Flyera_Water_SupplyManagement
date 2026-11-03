"""Test setup. Runs against a throwaway database and uploads folder, never the real ones."""
import os
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

_TEMP_DIR = Path(tempfile.mkdtemp(prefix="flyera-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEMP_DIR / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "test-only-signing-key-" + "x" * 32
os.environ["APP_ENV"] = "development"
os.environ.pop("JWT_SECRET_KEY", None)
os.environ.pop("SETUP_MASTER_KEY", None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from app import crud, models  # noqa: E402
from app.api.routers import auth as auth_router, users as users_router  # noqa: E402
from app.core import security  # noqa: E402
from app.database import SessionLocal  # noqa: E402

PASSWORD = "correct-horse-1"
ROLES = {
    "admin": "ADMIN",
    "owner": "Owner",
    "water_staff": "WATER_STAFF",
    "glass_staff": "GLASS_STAFF",
    "driver": "DRIVER",
    "other_driver": "DRIVER",
    "helper": "HELPER",
    "glass_driver": "GLASS_DRIVER",
    "other_glass_driver": "GLASS_DRIVER",
}


@dataclass
class World:
    client: TestClient
    user_ids: Dict[str, str] = field(default_factory=dict)
    vehicle: str = ""
    route: str = ""
    glass_route: str = ""
    customer: str = ""
    wholesale_customer: str = ""
    jar: str = ""
    bottle: str = ""

    def auth(self, who: str) -> Dict[str, str]:
        token = security.create_access_token(self.user_ids[who], role=ROLES[who])
        return {"Authorization": f"Bearer {token}"}

    def stock(self, product: str) -> Dict[str, int]:
        item = next(i for i in self.client.get("/api/inventory", headers=self.auth("admin")).json() if i["id"] == product)
        return {"full": item["full"], "empty": item["empty"], "damaged": item["damaged"]}

    def dues(self, customer: str = "") -> float:
        return self.client.get(f"/api/clients/{customer or self.customer}", headers=self.auth("admin")).json()["credit_amount"]

    def new_route(self, driver: str = "driver", loads: Dict[str, int] = None) -> str:
        """Creates an active water assignment and returns its id."""
        allocations = [{"inventory_type_id": k, "allocated_count": v} for k, v in (loads if loads is not None else {self.jar: 20}).items()]
        response = self.client.post("/api/assignments", headers=self.auth("water_staff"), json={
            "date": datetime.now(timezone.utc).isoformat(),
            "vehicle_id": self.vehicle,
            "driver_id": self.user_ids[driver],
            "route_id": self.route,
            "status": "ACTIVE",
            "allocations": allocations,
        })
        assert response.status_code == 200, response.text
        return response.json()["id"]

    def deliver(self, assignment: str, method: str = "Cash", customer: str = "", items=None, who: str = "driver", **extra):
        """Saves one stop. By default 2 full jars delivered and 1 empty collected."""
        if items is None:
            items = [{"inventory_type_id": self.jar, "delivered_full": 2, "collected_empty": 1}]
        return self.client.post("/api/deliveries", headers=self.auth(who), json={
            "assignment_id": assignment,
            "client_id": customer or self.customer,
            "payment_method": method,
            "items": items,
            **extra,
        })

    def new_glass_run(self, driver: str = "glass_driver") -> str:
        response = self.client.post("/api/glass/assignments", headers=self.auth("glass_staff"), json={
            "date": datetime.now(timezone.utc).isoformat(),
            "vehicle_id": self.vehicle,
            "driver_id": self.user_ids[driver],
            "route_id": self.glass_route,
            "status": "ACTIVE",
        })
        assert response.status_code == 200, response.text
        return response.json()["id"]

    def collect(self, run: str, tons: float = 1.5, who: str = "glass_driver"):
        return self.client.post("/api/glass/collect", headers=self.auth(who), json={
            "assignment_id": run,
            "vehicle": "GOA 01",
            "property": "Beach Hotel",
            "tons_collected": tons,
            "payment_amount": 100,
        })


@pytest.fixture()
def world(tmp_path, monkeypatch):
    monkeypatch.setattr(users_router, "UPLOADS_DIR", tmp_path)
    auth_router._failed_logins.clear()

    db = SessionLocal()
    crud.wipe_all_data(db)
    hashed = security.get_password_hash(PASSWORD)
    state = World(client=TestClient(main.app))
    for who, role in ROLES.items():
        user = models.User(name=who.title(), username=who, role=role, phone=None, hashed_password=hashed)
        db.add(user)
        db.flush()
        state.user_ids[who] = user.id

    vehicle = models.Vehicle(plate_number="MH 12 AB 1234", model="Tata Ace")
    route = models.Route(name="Water Route", business_type="WATER")
    glass_route = models.Route(name="Glass Route", business_type="GLASS")
    db.add_all([vehicle, route, glass_route])
    db.flush()
    state.vehicle, state.route, state.glass_route = vehicle.id, route.id, glass_route.id

    customer = models.Client(name="Standard Cafe", tier="Standard", route_id=route.id)
    wholesale = models.Client(name="Wholesale Hotel", tier="Wholesale", route_id=route.id)
    db.add_all([customer, wholesale])
    db.flush()
    state.customer, state.wholesale_customer = customer.id, wholesale.id

    jar = models.InventoryType(name="20L Jar", price=80, wholesale_price=65, premium_price=60, points_value=1)
    bottle = models.InventoryType(name="5L Bottle", price=35, wholesale_price=28, premium_price=25, points_value=0)
    db.add_all([jar, bottle])
    db.flush()
    state.jar, state.bottle = jar.id, bottle.id
    db.add_all([
        models.Stock(inventory_type_id=jar.id, full_count=100, empty_count=10, damaged_count=0),
        models.Stock(inventory_type_id=bottle.id, full_count=100, empty_count=10, damaged_count=0),
    ])
    db.commit()
    db.close()
    return state
