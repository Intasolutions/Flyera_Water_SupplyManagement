"""Login sessions, first-time setup, schema updates and time handling."""
from datetime import datetime, timedelta

from sqlalchemy import create_engine, inspect, text

from app import models
from app.api.routers import auth as auth_router
from app.core import config, timeutils
from app.database import SessionLocal
from app.schema_sync import sync_schema
from conftest import PASSWORD


def _login(world, username="driver", password=PASSWORD):
    return world.client.post("/api/auth/login", data={"username": username, "password": password})


def _refresh(world, token):
    return world.client.post("/api/auth/refresh", json={"refresh_token": token})


def _age_rotation(seconds: int) -> None:
    db = SessionLocal()
    for row in db.query(models.RefreshToken).filter(models.RefreshToken.rotated_at.is_not(None)).all():
        row.rotated_at -= timedelta(seconds=seconds)
    db.commit()
    db.close()


# --- Sign-in ---

def test_login_returns_tokens_and_a_user_with_utc_dates(world):
    body = _login(world).json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["role"] == "DRIVER" and body["user"]["created_at"].endswith("Z")
    assert world.client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}).status_code == 200


def test_wrong_name_and_wrong_password_look_the_same(world):
    wrong_password = _login(world, password="not-the-password")
    unknown_user = _login(world, username="nobody")
    assert wrong_password.status_code == unknown_user.status_code == 400
    assert wrong_password.json() == unknown_user.json()


def test_repeated_failures_lock_the_login_for_a_while(world):
    for _ in range(auth_router.MAX_FAILED_LOGINS):
        assert _login(world, password="not-the-password").status_code == 400
    assert _login(world, password="not-the-password").status_code == 429
    assert _login(world).status_code == 429  # the right password also waits
    assert _login(world, username="helper").status_code == 200  # other accounts are unaffected


def test_a_successful_login_clears_earlier_failures(world):
    for _ in range(auth_router.MAX_FAILED_LOGINS - 1):
        _login(world, password="not-the-password")
    assert _login(world).status_code == 200
    assert _login(world, password="not-the-password").status_code == 400
    assert _login(world).status_code == 200


# --- Refresh tokens ---

def test_refresh_gives_a_new_working_pair(world):
    old = _login(world).json()
    new = _refresh(world, old["refresh_token"]).json()
    assert new["refresh_token"] != old["refresh_token"]
    assert world.client.get("/api/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"}).status_code == 200


def test_two_tabs_refreshing_together_both_succeed(world):
    token = _login(world).json()["refresh_token"]
    assert _refresh(world, token).status_code == 200
    assert _refresh(world, token).status_code == 200


def test_reusing_an_old_refresh_token_ends_all_sessions(world):
    first = _login(world).json()
    second = _refresh(world, first["refresh_token"]).json()
    _age_rotation(auth_router.ROTATION_GRACE_SECONDS + 5)

    assert _refresh(world, first["refresh_token"]).status_code == 401
    assert _refresh(world, second["refresh_token"]).status_code == 401
    assert world.client.get("/api/auth/me", headers={"Authorization": f"Bearer {second['access_token']}"}).status_code == 401


def test_sign_out_ends_the_refresh_token(world):
    token = _login(world).json()["refresh_token"]
    assert world.client.post("/api/auth/logout", json={"refresh_token": token}).status_code == 200
    assert _refresh(world, token).status_code == 401


def test_sign_out_with_a_bad_token_reveals_nothing(world):
    assert world.client.post("/api/auth/logout", json={"refresh_token": "garbage"}).status_code == 200


def test_tokens_without_a_database_record_are_refused(world):
    from app.core import security
    token = security.create_refresh_token(world.user_ids["driver"], jti="never-issued")
    assert _refresh(world, token).status_code == 401


# --- Passwords and revocation ---

def test_admin_can_change_a_staff_password_and_old_sessions_end(world):
    session = _login(world).json()
    response = world.client.put(f"/api/users/{world.user_ids['driver']}", headers=world.auth("admin"), json={"password": "brand-new-pass-9"})
    assert response.status_code == 200

    assert _login(world, password="brand-new-pass-9").status_code == 200
    assert _login(world).status_code == 400
    assert world.client.get("/api/auth/me", headers={"Authorization": f"Bearer {session['access_token']}"}).status_code == 401
    assert _refresh(world, session["refresh_token"]).status_code == 401


def test_editing_a_profile_without_a_password_keeps_the_session(world):
    session = _login(world).json()
    world.client.put(f"/api/users/{world.user_ids['driver']}", headers=world.auth("admin"), json={"address": "Pune"})
    assert world.client.get("/api/auth/me", headers={"Authorization": f"Bearer {session['access_token']}"}).status_code == 200


def test_short_passwords_are_refused(world):
    response = world.client.put(f"/api/users/{world.user_ids['driver']}", headers=world.auth("admin"), json={"password": "short"})
    assert response.status_code == 422
    response = world.client.post("/api/users", headers=world.auth("admin"), json={"name": "New", "role": "DRIVER", "password": "short"})
    assert response.status_code == 422


def test_only_administrators_manage_staff(world):
    assert world.client.put(f"/api/users/{world.user_ids['driver']}", headers=world.auth("water_staff"), json={"role": "ADMIN"}).status_code == 403
    assert world.client.put(f"/api/users/{world.user_ids['driver']}", headers=world.auth("driver"), json={"role": "ADMIN"}).status_code == 403


def test_duplicate_usernames_are_refused(world):
    response = world.client.post("/api/users", headers=world.auth("admin"), json={"name": "Copy", "role": "DRIVER", "username": "driver", "password": PASSWORD})
    assert response.status_code == 400


def test_revoking_another_users_sessions_needs_an_administrator(world):
    target = world.user_ids["driver"]
    assert world.client.post(f"/api/auth/revoke-tokens?user_id={target}", headers=world.auth("helper")).status_code == 403
    assert world.client.get("/api/auth/me", headers=world.auth("driver")).status_code == 200
    assert world.client.post(f"/api/auth/revoke-tokens?user_id={target}", headers=world.auth("admin")).status_code == 200
    assert world.client.get("/api/auth/me", headers=world.auth("driver")).status_code == 401


# --- First-time setup ---

SETUP = {"confirm_wipe": "WIPE_ALL_DATA", "name": "Owner", "username": "owner1", "password": "long-enough-pass"}


def _fill_with_real_looking_data(world) -> None:
    route = world.new_route()
    world.deliver(route, method="Pay Later (Slip QR)")
    world.client.post("/api/expenses", headers=world.auth("driver"), json={"assignment_id": route, "category": "FUEL", "amount": 50})
    run = world.new_glass_run()
    collection = world.collect(run, tons=2).json()["id"]
    world.client.post(f"/api/glass/dropoff/{collection}", headers=world.auth("glass_driver"))
    world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json={"collection_id": collection, "tons_separated": 2, "white_tons": 2, "mixed_tons": 0})
    world.client.post("/api/glass/properties", headers=world.auth("glass_staff"), json={"name": "Hotel", "route_id": world.glass_route})
    world.client.post("/api/settings", headers=world.auth("admin"), json={"company_name": "Old Co"})
    _login(world)


def test_wipe_succeeds_with_real_looking_data_and_empties_every_table(world, monkeypatch):
    monkeypatch.setenv("SETUP_MASTER_KEY", "the-right-key")
    _fill_with_real_looking_data(world)

    response = world.client.post("/api/setup/reset-and-create-superuser", json={**SETUP, "master_key": "the-right-key", "company_name": "New Co"})
    assert response.status_code == 200, response.text

    db = SessionLocal()
    from app.database import Base
    counts = {table.name: db.execute(table.select()).first() is not None for table in Base.metadata.sorted_tables}
    assert db.query(models.User).count() == 1
    assert db.query(models.SystemSetting).filter(models.SystemSetting.key == "company_name").first().value == "New Co"
    db.close()
    assert {name for name, has_rows in counts.items() if has_rows} == {"users", "system_settings"}


def test_wipe_needs_the_key_once_users_exist(world, monkeypatch):
    assert world.client.post("/api/setup/reset-and-create-superuser", json=SETUP).status_code == 403
    monkeypatch.setenv("SETUP_MASTER_KEY", "the-right-key")
    assert world.client.post("/api/setup/reset-and-create-superuser", json={**SETUP, "master_key": "wrong"}).status_code == 403
    assert world.client.post("/api/setup/reset-and-create-superuser", json={**SETUP, "master_key": "the-right-key", "confirm_wipe": "no"}).status_code == 400


def _empty_database() -> None:
    from app import crud
    db = SessionLocal()
    crud.wipe_all_data(db)
    db.commit()
    db.close()


def test_first_run_on_an_empty_database_needs_no_key_in_development(world):
    _empty_database()
    assert world.client.get("/api/setup/status").json() == {"is_clean": True, "master_key_required": False}
    assert world.client.post("/api/setup/reset-and-create-superuser", json=SETUP).status_code == 200


def test_first_run_needs_the_key_in_production(world, monkeypatch):
    from app.api.routers import setup as setup_router
    monkeypatch.setattr(setup_router, "IS_PRODUCTION", True)
    _empty_database()
    assert world.client.get("/api/setup/status").json()["master_key_required"] is True
    assert world.client.post("/api/setup/reset-and-create-superuser", json=SETUP).status_code == 403


# --- Schema updates ---

def test_schema_sync_adds_what_is_missing_and_is_safe_to_repeat(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'old.db').as_posix()}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE glass_separations (id VARCHAR PRIMARY KEY, tons_separated REAL NOT NULL, white_tons REAL NOT NULL, mixed_tons REAL NOT NULL)"))
        conn.execute(text("INSERT INTO glass_separations VALUES ('kept', 1, 1, 0)"))

    sync_schema(engine)
    sync_schema(engine)

    inspector = inspect(engine)
    assert "wastage_tons" in {c["name"] for c in inspector.get_columns("glass_separations")}
    assert {"refresh_tokens", "payment_audit_logs", "users"} <= set(inspector.get_table_names())
    assert "idx_deliveries_status" in {i["name"] for i in inspector.get_indexes("deliveries")}
    with engine.connect() as conn:
        assert conn.execute(text("SELECT id, wastage_tons FROM glass_separations")).first() == ("kept", 0)
    engine.dispose()


def test_database_url_is_anchored_to_the_backend_folder():
    resolved = config._resolve_database_url("sqlite:///./water_supply.db")
    assert resolved == "sqlite:///" + (config.BACKEND_DIR / "water_supply.db").resolve().as_posix()
    assert config._resolve_database_url("sqlite:///C:/data/x.db") == "sqlite:///C:/data/x.db"
    assert config._resolve_database_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert config._resolve_database_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"


def test_postgres_engine_can_be_built_with_the_installed_driver():
    engine = create_engine("postgresql+psycopg://u:p@localhost/db")
    assert engine.dialect.driver == "psycopg"


# --- Time ---

def test_business_day_follows_india_time():
    start, end = timeutils.local_day_bounds(datetime(2026, 11, 2).date())
    assert start == datetime(2026, 11, 1, 18, 30)
    assert end.date() == datetime(2026, 11, 2).date() and end.hour == 18


def test_utc_iso_marks_times_as_utc():
    assert timeutils.utc_iso(datetime(2026, 11, 2, 1, 2, 3)) == "2026-11-02T01:02:03Z"
    assert timeutils.utc_iso(None) is None


def test_bad_dates_are_ignored_rather_than_crashing(world):
    assert world.client.get("/api/dashboard/stats?start_date=nonsense&end_date=nonsense", headers=world.auth("admin")).status_code == 200
    assert world.client.get("/api/reports/financial-summary?start_date=nonsense", headers=world.auth("admin")).status_code == 200


def test_sale_just_after_midnight_india_time_counts_on_the_new_day(world):
    route = world.new_route()
    delivery = world.deliver(route).json()
    db = SessionLocal()
    row = db.query(models.Delivery).filter(models.Delivery.id == delivery["id"]).first()
    row.created_at = datetime(2026, 11, 1, 19, 0)  # 00:30 on 2 Nov in India
    db.commit()
    db.close()

    revenue = lambda day: world.client.get(f"/api/dashboard/stats?start_date={day}&end_date={day}", headers=world.auth("admin")).json()["todayRevenue"]
    assert revenue("2026-11-02") == 160
    assert revenue("2026-11-01") == 0


def test_api_dates_carry_the_utc_marker(world):
    route = world.new_route()
    world.deliver(route)
    assignment = world.client.get(f"/api/assignments/{route}", headers=world.auth("admin")).json()
    assert assignment["date"].endswith("Z") and assignment["created_at"].endswith("Z")
    assert assignment["deliveries"][0]["created_at"].endswith("Z")

    run = world.new_glass_run()
    world.collect(run)
    assert world.client.get("/api/glass/collections", headers=world.auth("admin")).json()[0]["date"].endswith("Z")
    assert world.client.get("/api/glass/assignments", headers=world.auth("admin")).json()[0]["date"].endswith("Z")
