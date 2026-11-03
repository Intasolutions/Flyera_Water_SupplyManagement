"""Who is allowed to do what."""
import os
import subprocess
import sys
from pathlib import Path

import pytest
from jose import jwt

BACKEND = Path(__file__).resolve().parents[1]
FAKE_ID = "00000000-0000-0000-0000-000000000000"


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/assignments"),
    ("POST", "/api/assignments"),
    ("PUT", f"/api/assignments/{FAKE_ID}"),
    ("PUT", f"/api/assignments/{FAKE_ID}/complete"),
    ("PUT", f"/api/assignments/{FAKE_ID}/reopen"),
    ("DELETE", f"/api/assignments/{FAKE_ID}"),
    ("GET", "/api/dashboard/stats"),
    ("GET", "/api/settings"),
    ("GET", "/api/users"),
    ("GET", "/api/clients"),
    ("GET", f"/api/clients/{FAKE_ID}/bottle-ledger"),
    ("GET", f"/api/clients/{FAKE_ID}/bottle-credit-balance"),
    ("POST", f"/api/clients/{FAKE_ID}/bottle-credit"),
    ("GET", "/api/users/uploads/anything.pdf"),
    ("GET", "/api/reports/financial-summary"),
    ("GET", "/api/glass/stats"),
    ("GET", "/api/glass/properties"),
    ("POST", "/api/glass/properties"),
    ("GET", "/api/glass/routes"),
    ("GET", "/api/glass/assignments"),
    ("POST", "/api/glass/assignments"),
    ("DELETE", f"/api/glass/assignments/{FAKE_ID}"),
    ("POST", "/api/glass/collect"),
    ("GET", "/api/glass/collections"),
    ("POST", f"/api/glass/dropoff/{FAKE_ID}"),
    ("POST", "/api/glass/dropoff-all"),
    ("POST", "/api/glass/separate"),
    ("POST", "/api/glass/vendor-pickup"),
    ("GET", "/api/glass/inventory"),
    ("GET", "/api/glass/reports"),
])
def test_core_routes_refuse_anonymous_callers(world, method, path):
    assert world.client.request(method, path).status_code == 401


def test_public_routes_reveal_no_business_data(world):
    health = world.client.get("/api/health").json()
    assert health["status"] == "healthy" and "metrics" not in health

    status = world.client.get("/api/setup/status").json()
    assert set(status) == {"is_clean", "master_key_required"}


def test_old_default_signing_key_no_longer_works(world):
    forged = jwt.encode(
        {"sub": world.user_ids["admin"], "token_type": "access", "token_version": 1, "exp": 4102444800},
        "aqua_glass_super_secret_key_change_in_production",
        algorithm="HS256",
    )
    response = world.client.get("/api/users", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_refresh_token_is_not_accepted_as_an_access_token(world):
    from app.core import security
    token = security.create_refresh_token(world.user_ids["admin"], jti="x")
    assert world.client.get("/api/users", headers={"Authorization": f"Bearer {token}"}).status_code == 401


@pytest.mark.parametrize("key", ["", "aqua_glass_super_secret_key_change_in_production", "short"])
def test_production_refuses_to_start_with_a_weak_key(key):
    env = {**os.environ, "APP_ENV": "production", "SECRET_KEY": key, "PYTHONDONTWRITEBYTECODE": "1"}
    env.pop("JWT_SECRET_KEY", None)
    result = subprocess.run(
        [sys.executable, "-c", "import app.core.security"],
        cwd=BACKEND, env=env, capture_output=True, text=True,
    )
    assert result.returncode != 0 and "SECRET_KEY" in result.stderr


def test_production_refuses_wildcard_cors():
    env = {**os.environ, "APP_ENV": "production", "CORS_ORIGINS": "*", "PYTHONDONTWRITEBYTECODE": "1"}
    result = subprocess.run(
        [sys.executable, "-c", "from app.core.config import cors_origins; cors_origins()"],
        cwd=BACKEND, env=env, capture_output=True, text=True,
    )
    assert result.returncode != 0 and "CORS_ORIGINS" in result.stderr


def test_drivers_cannot_read_financial_reports(world):
    assert world.client.get("/api/reports/financial-summary", headers=world.auth("driver")).status_code == 403
    assert world.client.get("/api/reports/financial-summary", headers=world.auth("water_staff")).status_code == 200


def test_driver_cannot_delete_another_drivers_delivery(world):
    route = world.new_route("other_driver")
    delivery = world.deliver(route, who="other_driver").json()
    response = world.client.delete(f"/api/deliveries/{delivery['id']}", headers=world.auth("driver"))
    assert response.status_code == 403


def test_driver_can_undo_own_open_stop_but_not_after_the_route_closes(world):
    route = world.new_route()
    delivery = world.deliver(route).json()
    assert world.client.put(f"/api/assignments/{route}/complete", headers=world.auth("driver"), json=[]).status_code == 200
    assert world.client.delete(f"/api/deliveries/{delivery['id']}", headers=world.auth("driver")).status_code == 403

    route_2 = world.new_route()
    delivery_2 = world.deliver(route_2).json()
    assert world.client.delete(f"/api/deliveries/{delivery_2['id']}", headers=world.auth("driver")).status_code == 200


def test_driver_cannot_record_deliveries_on_someone_elses_route(world):
    route = world.new_route("other_driver")
    assert world.deliver(route, who="driver").status_code == 403


def test_drivers_only_see_their_own_routes(world):
    mine = world.new_route("driver")
    world.new_route("other_driver")
    seen = world.client.get("/api/assignments", headers=world.auth("driver")).json()
    assert [a["id"] for a in seen] == [mine]
    assert world.client.get(f"/api/assignments/{mine}", headers=world.auth("other_driver")).status_code == 403


def test_drivers_cannot_verify_payments_or_create_routes(world):
    route = world.new_route()
    delivery = world.deliver(route, method="Pay Later (Slip QR)").json()
    response = world.client.post(
        f"/api/deliveries/{delivery['id']}/verify",
        headers=world.auth("driver"),
        json={"action": "VERIFY_PAID", "upi_reference": "123456789012"},
    )
    assert response.status_code == 403
    assert world.client.delete(f"/api/assignments/{route}", headers=world.auth("driver")).status_code == 403


def test_driver_can_fix_a_customer_location_but_not_money_or_tier(world):
    url = f"/api/clients/{world.customer}"
    headers = world.auth("driver")
    assert world.client.put(url, headers=headers, json={"latitude": 18.5, "longitude": 73.8, "address": "New lane"}).status_code == 200
    assert world.client.put(url, headers=headers, json={"credit_amount": 0}).status_code == 200  # unchanged value
    assert world.client.put(url, headers=headers, json={"credit_amount": 500}).status_code == 403
    assert world.client.put(url, headers=headers, json={"tier": "Premium"}).status_code == 403
    assert world.client.put(url, headers=headers, json={"loyalty_points": 999}).status_code == 403


def test_only_administrators_can_change_dues(world):
    url = f"/api/clients/{world.customer}"
    assert world.client.put(url, headers=world.auth("water_staff"), json={"credit_amount": 500}).status_code == 403
    assert world.client.put(url, headers=world.auth("admin"), json={"credit_amount": 500}).status_code == 200
    assert world.client.post(f"{url}/credit-adjust", headers=world.auth("water_staff"), json={"amount": 1, "type": "ADD"}).status_code == 403
    assert world.dues() == 500


def test_new_customers_from_the_road_start_with_no_dues_or_points(world):
    response = world.client.post("/api/clients", headers=world.auth("driver"), json={
        "name": "New Shop", "route_id": world.route, "credit_amount": 900, "loyalty_points": 900,
    })
    assert response.status_code == 200
    assert response.json()["credit_amount"] == 0 and response.json()["loyalty_points"] == 0


def test_water_and_glass_staff_are_separated(world):
    assert world.client.get("/api/glass/stats", headers=world.auth("water_staff")).status_code == 403
    assert world.client.get("/api/glass/collections", headers=world.auth("driver")).status_code == 403
    assert world.client.get("/api/clients", headers=world.auth("glass_staff")).status_code == 403
    assert world.client.get("/api/assignments", headers=world.auth("glass_staff")).status_code == 403
    assert world.client.get("/api/dashboard/stats", headers=world.auth("glass_staff")).status_code == 403
    for who in ("admin", "owner"):
        assert world.client.get("/api/glass/stats", headers=world.auth(who)).status_code == 200
        assert world.client.get("/api/clients", headers=world.auth(who)).status_code == 200


def test_glass_driver_cannot_use_office_glass_routes(world):
    headers = world.auth("glass_driver")
    for path in ("/api/glass/stats", "/api/glass/reports", "/api/glass/inventory", "/api/glass/vendor-pickups"):
        assert world.client.get(path, headers=headers).status_code == 403
    assert world.client.post("/api/glass/separate", headers=headers, json={"tons_separated": 1, "white_tons": 1, "mixed_tons": 0}).status_code == 403


def test_glass_wipe_route_is_gone(world):
    assert world.client.post("/api/glass/reset-data", headers=world.auth("admin")).status_code in (404, 405)


def test_settings_hide_the_upi_seal(world):
    settings = world.client.get("/api/settings", headers=world.auth("driver")).json()
    assert "upi_id_hmac" not in settings


def test_non_office_users_see_limited_staff_details(world):
    admin_id = world.user_ids["admin"]
    seen = {u["id"]: u for u in world.client.get("/api/users", headers=world.auth("driver")).json()}
    assert seen[admin_id]["username"] is None
    assert seen[world.user_ids["driver"]]["username"] == "driver"
    full = {u["id"]: u for u in world.client.get("/api/users", headers=world.auth("water_staff")).json()}
    assert full[admin_id]["username"] == "admin"


# --- Uploads ---

PDF = b"%PDF-1.7 test"


def test_uploads_need_the_right_role(world):
    files = {"file": ("id.pdf", PDF, "application/pdf")}
    assert world.client.post("/api/users/upload-id", files=files).status_code == 401
    assert world.client.post("/api/users/upload-id", files=files, headers=world.auth("driver")).status_code == 403

    response = world.client.post("/api/users/upload-id", files=files, headers=world.auth("admin"))
    assert response.status_code == 200
    url = response.json()["url"]

    assert world.client.get(url).status_code == 401
    assert world.client.get(url, headers=world.auth("driver")).status_code == 403
    served = world.client.get(url, headers=world.auth("water_staff"))
    assert served.status_code == 200 and served.content == PDF
    assert served.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize("name,content", [
    ("id.exe", b"MZ"),
    ("id.pdf", b"<script>alert(1)</script>"),
    ("id.png", b"not an image"),
    ("id.pdf", b"%PDF" + b"x" * (5 * 1024 * 1024)),
])
def test_bad_uploads_are_rejected(world, name, content):
    response = world.client.post("/api/users/upload-id", files={"file": (name, content)}, headers=world.auth("admin"))
    assert response.status_code == 400


def test_upload_path_cannot_leave_the_folder(world):
    response = world.client.get("/api/users/uploads/..%2F..%2Fmain.py", headers=world.auth("admin"))
    assert response.status_code == 404
