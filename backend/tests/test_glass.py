"""Glass recycling: collection, godown stock, sales and accounting."""
from datetime import datetime

from app import models
from app.database import SessionLocal


def _tons(world, kind: str) -> float:
    items = world.client.get("/api/glass/inventory", headers=world.auth("glass_staff")).json()
    return next(i["tons"] for i in items if i["type"] == kind)


def _dropped_collection(world, tons: float = 2.0) -> str:
    run = world.new_glass_run()
    collection = world.collect(run, tons=tons).json()["id"]
    assert world.client.post(f"/api/glass/dropoff/{collection}", headers=world.auth("glass_driver")).status_code == 200
    return collection


def _add_white_stock(world, tons: float = 10.0) -> None:
    collection = _dropped_collection(world, tons=tons)
    response = world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json={
        "collection_id": collection, "tons_separated": tons, "white_tons": tons, "mixed_tons": 0,
    })
    assert response.status_code == 200


# --- Collecting and dropping off ---

def test_repeating_a_drop_off_counts_the_tons_once(world):
    run = world.new_glass_run()
    collection = world.collect(run, tons=1.5).json()["id"]
    url = f"/api/glass/dropoff/{collection}"
    assert world.client.post(url, headers=world.auth("glass_driver")).status_code == 200
    assert _tons(world, "unseparated") == 1.5
    assert world.client.post(url, headers=world.auth("glass_driver")).status_code == 200
    assert _tons(world, "unseparated") == 1.5


def test_ending_a_run_then_dropping_off_again_counts_once(world):
    run = world.new_glass_run()
    collection = world.collect(run, tons=1.5).json()["id"]
    world.client.post(f"/api/glass/assignments/{run}/complete", headers=world.auth("glass_driver"))
    world.client.post(f"/api/glass/dropoff/{collection}", headers=world.auth("glass_driver"))
    world.client.post("/api/glass/dropoff-all", headers=world.auth("glass_driver"))
    assert _tons(world, "unseparated") == 1.5


def test_reopening_a_run_reverses_its_stock(world):
    run = world.new_glass_run()
    world.collect(run, tons=1.5)
    world.client.post(f"/api/glass/assignments/{run}/complete", headers=world.auth("glass_driver"))
    assert world.client.put(f"/api/glass/assignments/{run}/reopen", headers=world.auth("glass_driver")).status_code == 200
    assert _tons(world, "unseparated") == 0


def test_collections_are_logged_as_the_signed_in_driver(world):
    run = world.new_glass_run()
    response = world.client.post("/api/glass/collect", headers=world.auth("glass_driver"), json={
        "assignment_id": run, "vehicle": "V", "property": "P", "tons_collected": 1,
        "driver_id": world.user_ids["other_glass_driver"],
    })
    assert response.json()["driver_id"] == world.user_ids["glass_driver"]


def test_drivers_only_see_and_change_their_own_collections_and_runs(world):
    run = world.new_glass_run("glass_driver")
    world.new_glass_run("other_glass_driver")
    collection = world.collect(run).json()["id"]
    other = world.auth("other_glass_driver")

    assert world.client.get("/api/glass/collections", headers=other).json() == []
    assert len(world.client.get("/api/glass/assignments", headers=other).json()) == 1
    assert world.client.post(f"/api/glass/dropoff/{collection}", headers=other).status_code == 403
    assert world.client.post(f"/api/glass/assignments/{run}/complete", headers=other).status_code == 403
    assert world.collect(run, who="other_glass_driver").status_code == 403

    world.client.post("/api/glass/dropoff-all", headers=other)
    assert _tons(world, "unseparated") == 0


def test_invalid_collections_are_rejected(world):
    run = world.new_glass_run()
    assert world.collect(run, tons=0).status_code == 422
    assert world.collect(run, tons=-1).status_code == 422
    world.client.post(f"/api/glass/assignments/{run}/complete", headers=world.auth("glass_driver"))
    assert world.collect(run).status_code == 400


# --- Sorting ---

def test_sorting_cannot_create_glass(world):
    collection = _dropped_collection(world, tons=1.0)
    response = world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json={
        "collection_id": collection, "tons_separated": 1, "white_tons": 50, "mixed_tons": 50,
    })
    assert response.status_code == 400
    assert _tons(world, "white") == 0


def test_bulk_sorting_cannot_exceed_what_is_waiting(world):
    _dropped_collection(world, tons=1.0)
    response = world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json={
        "tons_separated": 5, "white_tons": 5, "mixed_tons": 0,
    })
    assert response.status_code == 400


def test_a_drop_can_only_be_sorted_once(world):
    collection = _dropped_collection(world, tons=2.0)
    body = {"collection_id": collection, "tons_separated": 2, "white_tons": 2, "mixed_tons": 0}
    assert world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json=body).status_code == 200
    assert world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json=body).status_code == 400
    assert _tons(world, "white") == 2


def test_only_dropped_glass_can_be_sorted(world):
    run = world.new_glass_run()
    collection = world.collect(run, tons=2.0).json()["id"]
    response = world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json={
        "collection_id": collection, "tons_separated": 2, "white_tons": 2, "mixed_tons": 0,
    })
    assert response.status_code == 400


def test_unsorted_remainder_is_recorded_as_wastage_and_stock_stays_consistent(world):
    collection = _dropped_collection(world, tons=2.0)
    response = world.client.post("/api/glass/separate", headers=world.auth("glass_staff"), json={
        "collection_id": collection, "tons_separated": 1.5, "white_tons": 1.0, "mixed_tons": 0.5,
    }).json()
    assert response["tons_separated"] == 2.0 and response["wastage_tons"] == 0.5
    assert (_tons(world, "white"), _tons(world, "mixed"), _tons(world, "unseparated")) == (1.0, 0.5, 0.0)

    stats = world.client.get("/api/glass/stats", headers=world.auth("glass_staff")).json()
    assert stats["unseparatedTons"] == 0


# --- Sales ---

def test_a_sale_cannot_exceed_stock_or_be_free(world):
    _add_white_stock(world, tons=2.0)
    sale = lambda **body: world.client.post("/api/glass/vendor-pickup", headers=world.auth("glass_staff"), json={
        "vendor_name": "Mill", "type": "white", "tons": 1, "price_per_ton": 5000, **body,
    })
    assert sale(tons=3).status_code == 400
    assert sale(price_per_ton=0).status_code == 422
    assert sale(tons=-1).status_code == 422
    assert sale().status_code == 200
    assert _tons(world, "white") == 1


# --- Accounting ---

def test_report_numbers_do_not_change_with_the_date_range(world):
    _add_white_stock(world, tons=5.0)
    for _ in range(3):
        world.client.post("/api/glass/vendor-pickup", headers=world.auth("glass_staff"), json={
            "vendor_name": "Mill", "type": "white", "tons": 1, "price_per_ton": 5000,
        })

    db = SessionLocal()
    pickups = db.query(models.GlassVendorPickup).all()
    pickups[0].date, pickups[1].date, pickups[2].date = datetime(2026, 3, 5, 6), datetime(2026, 3, 6, 6), datetime(2026, 3, 7, 6)
    db.commit()
    ids = [p.id for p in pickups]
    db.close()

    get = lambda query: {r["id"]: r["invoice_no"] for r in world.client.get(f"/api/glass/reports?{query}", headers=world.auth("glass_staff")).json()["sales_ledger"]}
    whole_month = get("start_date=2026-03-01&end_date=2026-03-31")
    only_last = get("start_date=2026-03-07&end_date=2026-03-07")

    assert [whole_month[i] for i in ids] == ["FL-SLS-202603-001", "FL-SLS-202603-002", "FL-SLS-202603-003"]
    assert only_last[ids[2]] == whole_month[ids[2]]


def test_report_and_dashboard_value_an_old_free_sale_the_same_way(world):
    db = SessionLocal()
    db.add(models.GlassVendorPickup(vendor_name="Old", type="white", tons=2, price_per_ton=0))
    db.commit()
    db.close()
    report = world.client.get("/api/glass/reports", headers=world.auth("glass_staff")).json()
    stats = world.client.get("/api/glass/stats", headers=world.auth("glass_staff")).json()
    assert report["pl_statement"]["gross_sales_revenue"] == 0 == stats["totalPickupRevenue"]


def test_report_and_dashboard_agree_on_unseparated_stock(world):
    _dropped_collection(world, tons=3.0)
    report = world.client.get("/api/glass/reports", headers=world.auth("glass_staff")).json()
    stats = world.client.get("/api/glass/stats", headers=world.auth("glass_staff")).json()
    closing = next(i for i in report["closing_inventory"] if i["type"] == "unseparated")
    assert closing["quantity_tons"] == stats["unseparatedTons"] == 3.0


def test_report_uses_the_configured_company_name(world):
    world.client.post("/api/settings", headers=world.auth("admin"), json={"company_name": "Acme Water"})
    assert world.client.get("/api/glass/reports", headers=world.auth("admin")).json()["company_name"] == "Acme Water"


# --- Keeping history ---

def test_runs_and_routes_with_records_are_kept(world):
    run = world.new_glass_run()
    world.collect(run)
    assert world.client.delete(f"/api/glass/assignments/{run}", headers=world.auth("glass_staff")).status_code == 400
    assert world.client.delete(f"/api/glass/routes/{world.glass_route}", headers=world.auth("glass_staff")).status_code == 400


def test_empty_runs_can_be_deleted(world):
    run = world.new_glass_run()
    assert world.client.delete(f"/api/glass/assignments/{run}", headers=world.auth("glass_staff")).status_code == 200
