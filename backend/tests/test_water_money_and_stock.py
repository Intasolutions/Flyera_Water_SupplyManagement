"""Water deliveries: prices, dues, jar balances, stock and history."""
from app import models
from app.database import SessionLocal


def _jar_balance(world, customer=None) -> int:
    url = f"/api/clients/{customer or world.customer}/bottle-credit-balance"
    return sum(b["balance"] for b in world.client.get(url, headers=world.auth("admin")).json()["balances"])


def _points(world) -> int:
    return world.client.get(f"/api/clients/{world.customer}", headers=world.auth("admin")).json()["loyalty_points"]


# --- Prices and totals ---

def test_server_sets_price_and_total_from_the_customer_tier(world):
    route = world.new_route()
    delivery = world.deliver(route, customer=world.wholesale_customer, total_amount=1, items=[
        {"inventory_type_id": world.jar, "delivered_full": 2, "collected_empty": 0, "price_charged": 1},
    ]).json()
    assert delivery["total_amount"] == 130  # 2 x wholesale 65, not the 1 the caller sent
    assert delivery["items"][0]["price_charged"] == 65


def test_negative_quantities_are_rejected(world):
    route = world.new_route()
    response = world.deliver(route, items=[{"inventory_type_id": world.jar, "delivered_full": -5, "collected_empty": 0}])
    assert response.status_code == 422


# --- Payment methods ---

def test_cash_is_paid_straight_away(world):
    delivery = world.deliver(world.new_route()).json()
    assert (delivery["status"], delivery["paid_amount"]) == ("COMPLETED", 160)
    assert world.dues() == 0


def test_upi_waits_for_the_office_and_is_not_counted_as_collected(world):
    route = world.new_route()
    delivery = world.deliver(route, method="UPI / QR").json()
    assert (delivery["status"], delivery["paid_amount"]) == ("PENDING_VERIFICATION", 0)
    assert world.dues() == 0

    pending = world.client.get("/api/deliveries/pending-doorstep", headers=world.auth("water_staff")).json()
    assert delivery["id"] in [d["id"] for d in pending]

    summary = world.client.get("/api/reports/financial-summary", headers=world.auth("admin")).json()["summary"]
    assert summary["total_upi_collected"] == 0 and summary["total_upi_unverified"] == 160

    verified = world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={
        "action": "VERIFY_PAID", "amount_paid": 160, "upi_reference": "111122223333",
    }).json()
    assert (verified["status"], verified["paid_amount"]) == ("COMPLETED", 160)
    assert world.dues() == 0

    summary = world.client.get("/api/reports/financial-summary", headers=world.auth("admin")).json()["summary"]
    assert summary["total_upi_collected"] == 160 and summary["total_upi_unverified"] == 0


def test_upi_that_never_arrived_becomes_dues(world):
    delivery = world.deliver(world.new_route(), method="UPI / QR").json()
    response = world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={"action": "MARK_CREDITED"})
    assert response.json()["status"] == "CREDITED"
    assert world.dues() == 160


def test_short_upi_payment_leaves_the_rest_on_dues(world):
    delivery = world.deliver(world.new_route(), method="UPI / QR").json()
    verified = world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={
        "action": "VERIFY_PAID", "amount_paid": 100, "upi_reference": "111122223333",
    }).json()
    assert verified["status"] == "PARTIAL_PAID"
    assert world.dues() == 60


def test_partial_payment_adds_only_the_unpaid_part_to_dues(world):
    delivery = world.deliver(world.new_route(), method="Pay Later (Slip QR)", paid_amount=60).json()
    assert delivery["status"] == "PARTIAL_PAID"
    assert world.dues() == 100  # 160 total - 60 paid


# --- Undo ---

def test_undoing_a_pay_later_delivery_removes_dues_jars_and_points(world):
    route = world.new_route()
    assert world.deliver(route, method="Pay Later (Slip QR)").status_code == 200
    assert (world.dues(), _jar_balance(world), _points(world)) == (160, 1, 2)

    response = world.client.delete(f"/api/deliveries/by-client/{route}/{world.customer}", headers=world.auth("driver"))
    assert response.status_code == 200
    assert (world.dues(), _jar_balance(world), _points(world)) == (0, 0, 0)


def test_undo_keeps_a_ledger_trail(world):
    route = world.new_route()
    delivery = world.deliver(route, method="Pay Later (Slip QR)").json()
    world.client.delete(f"/api/deliveries/{delivery['id']}", headers=world.auth("water_staff"))
    ledger = world.client.get(f"/api/clients/{world.customer}/bottle-ledger", headers=world.auth("admin")).json()
    assert sorted(entry["quantity"] for entry in ledger) == [-1, 1]


def test_undoing_on_a_closed_route_corrects_the_warehouse(world):
    route = world.new_route(loads={world.jar: 10})
    delivery = world.deliver(route, items=[{"inventory_type_id": world.jar, "delivered_full": 4, "collected_empty": 3}]).json()
    world.client.put(f"/api/assignments/{route}/complete", headers=world.auth("driver"), json=[])
    assert world.stock(world.jar) == {"full": 96, "empty": 13, "damaged": 0}

    assert world.client.delete(f"/api/deliveries/{delivery['id']}", headers=world.auth("water_staff")).status_code == 200
    assert world.stock(world.jar) == {"full": 100, "empty": 10, "damaged": 0}


def test_verified_payments_cannot_be_deleted(world):
    delivery = world.deliver(world.new_route(), method="Pay Later (Slip QR)").json()
    world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={
        "action": "VERIFY_PAID", "amount_paid": 160, "upi_reference": "111122223333",
    })
    assert world.client.delete(f"/api/deliveries/{delivery['id']}", headers=world.auth("admin")).status_code == 400


def test_a_stop_can_only_be_saved_once(world):
    route = world.new_route()
    assert world.deliver(route).status_code == 200
    assert world.deliver(route).status_code == 409
    assert world.stock(world.jar)["full"] == 80


# --- Payment verification ---

def test_overpayment_is_refused(world):
    delivery = world.deliver(world.new_route(), method="Pay Later (Slip QR)").json()
    response = world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={
        "action": "VERIFY_PAID", "amount_paid": 99999, "upi_reference": "111122223333",
    })
    assert response.status_code == 400
    assert world.dues() == 160


def test_a_bill_can_settle_the_customers_older_dues_but_no_more(world):
    route = world.new_route()
    first = world.deliver(route, method="Pay Later (Slip QR)").json()
    world.deliver(route, method="Pay Later (Slip QR)", customer=world.wholesale_customer)
    world.client.put(f"/api/clients/{world.customer}", headers=world.auth("admin"), json={"credit_amount": 300})

    url = f"/api/deliveries/{first['id']}/verify"
    too_much = {"action": "VERIFY_PAID", "amount_paid": 301, "upi_reference": "111122223333"}
    assert world.client.post(url, headers=world.auth("water_staff"), json=too_much).status_code == 400
    exact = {"action": "VERIFY_PAID", "amount_paid": 300, "upi_reference": "111122223333"}
    assert world.client.post(url, headers=world.auth("water_staff"), json=exact).json()["status"] == "COMPLETED"
    assert world.dues() == 0


def test_a_paid_bill_cannot_be_verified_again(world):
    delivery = world.deliver(world.new_route()).json()
    response = world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={
        "action": "VERIFY_PAID", "amount_paid": 1, "upi_reference": "111122223333",
    })
    assert response.status_code == 400


def test_a_utr_can_only_be_used_once_even_on_the_same_bill(world):
    route = world.new_route()
    first = world.deliver(route, method="Pay Later (Slip QR)").json()
    second = world.deliver(route, method="Pay Later (Slip QR)", customer=world.wholesale_customer).json()
    headers = world.auth("water_staff")
    body = {"action": "VERIFY_PAID", "amount_paid": 10, "upi_reference": "111122223333"}
    assert world.client.post(f"/api/deliveries/{first['id']}/verify", headers=headers, json=body).status_code == 200
    assert world.client.post(f"/api/deliveries/{first['id']}/verify", headers=headers, json=body).status_code == 400
    assert world.client.post(f"/api/deliveries/{second['id']}/verify", headers=headers, json=body).status_code == 400


def test_verification_writes_an_audit_record(world):
    delivery = world.deliver(world.new_route(), method="Pay Later (Slip QR)").json()
    world.client.post(f"/api/deliveries/{delivery['id']}/verify", headers=world.auth("water_staff"), json={
        "action": "VERIFY_PAID", "amount_paid": 160, "upi_reference": "111122223333",
    })
    db = SessionLocal()
    rows = db.query(models.PaymentAuditLog).filter(models.PaymentAuditLog.delivery_id == delivery["id"]).all()
    db.close()
    assert [(r.action, r.amount, r.upi_reference) for r in rows] == [("VERIFY_PAID", 160, "111122223333")]


# --- Stock ---

def test_over_allocating_is_refused_and_changes_nothing(world):
    before_jar, before_bottle = world.stock(world.jar), world.stock(world.bottle)
    response = world.client.post("/api/assignments", headers=world.auth("water_staff"), json={
        "date": "2026-11-02T06:00:00Z",
        "vehicle_id": world.vehicle,
        "driver_id": world.user_ids["driver"],
        "route_id": world.route,
        "allocations": [
            {"inventory_type_id": world.jar, "allocated_count": 10},
            {"inventory_type_id": world.bottle, "allocated_count": 1198},
        ],
    })
    assert response.status_code == 400
    assert "Not enough" in response.json()["detail"]
    assert (world.stock(world.jar), world.stock(world.bottle)) == (before_jar, before_bottle)


def test_manual_stock_adjustment_cannot_go_below_zero(world):
    url = f"/api/inventory/{world.jar}/stock"
    assert world.client.post(url, headers=world.auth("water_staff"), json={"add_full": -101}).status_code == 400
    assert world.client.post(url, headers=world.auth("water_staff"), json={"add_full": -100}).status_code == 200
    assert world.stock(world.jar)["full"] == 0


def test_a_van_cannot_deliver_more_than_it_carries(world):
    route = world.new_route(loads={world.jar: 3})
    items = [{"inventory_type_id": world.jar, "delivered_full": 2, "collected_empty": 0}]
    assert world.deliver(route, items=items).status_code == 200
    response = world.deliver(route, items=items, customer=world.wholesale_customer)
    assert response.status_code == 400
    assert "left on this van" in response.json()["detail"]


def test_end_route_counts_each_product_and_all_empties(world):
    route = world.new_route(loads={world.jar: 50, world.bottle: 30})
    assert world.deliver(route, items=[
        {"inventory_type_id": world.jar, "delivered_full": 20, "collected_empty": 3},
        {"inventory_type_id": world.bottle, "delivered_full": 10, "collected_empty": 2},
    ]).status_code == 200
    assert world.stock(world.jar)["full"] == 50 and world.stock(world.bottle)["full"] == 70

    response = world.client.put(f"/api/assignments/{route}/complete", headers=world.auth("driver"), json=[])
    assert response.status_code == 200 and response.json()["status"] == "COMPLETED"

    # 30 jars and 20 bottles come back, with 3 and 2 empties.
    assert world.stock(world.jar) == {"full": 80, "empty": 13, "damaged": 0}
    assert world.stock(world.bottle) == {"full": 90, "empty": 12, "damaged": 0}


def test_reopening_a_route_reverses_the_warehouse_counts(world):
    route = world.new_route(loads={world.jar: 10})
    world.deliver(route, items=[{"inventory_type_id": world.jar, "delivered_full": 4, "collected_empty": 3}])
    world.client.put(f"/api/assignments/{route}/complete", headers=world.auth("driver"), json=[])
    assert world.client.put(f"/api/assignments/{route}/reopen", headers=world.auth("driver")).json()["status"] == "ACTIVE"
    assert world.stock(world.jar) == {"full": 90, "empty": 10, "damaged": 0}


def test_ending_a_route_twice_counts_stock_once(world):
    route = world.new_route(loads={world.jar: 10})
    url = f"/api/assignments/{route}/complete"
    world.client.put(url, headers=world.auth("driver"), json=[])
    world.client.put(url, headers=world.auth("driver"), json=[])
    assert world.stock(world.jar)["full"] == 100


def test_status_cannot_jump_to_or_from_completed_by_editing(world):
    route = world.new_route()
    assert world.client.put(f"/api/assignments/{route}", headers=world.auth("water_staff"), json={"status": "COMPLETED"}).status_code == 400
    world.client.put(f"/api/assignments/{route}/complete", headers=world.auth("driver"), json=[])
    assert world.client.put(f"/api/assignments/{route}", headers=world.auth("water_staff"), json={"status": "ACTIVE"}).status_code == 400


def test_editing_the_load_moves_only_the_difference(world):
    route = world.new_route(loads={world.jar: 10})
    url = f"/api/assignments/{route}"
    edit = lambda count: world.client.put(url, headers=world.auth("water_staff"), json={"allocations": [{"inventory_type_id": world.jar, "allocated_count": count}]})

    assert edit(15).status_code == 200 and world.stock(world.jar)["full"] == 85
    assert edit(5).status_code == 200 and world.stock(world.jar)["full"] == 95

    world.deliver(route, items=[{"inventory_type_id": world.jar, "delivered_full": 4, "collected_empty": 0}])
    assert edit(3).status_code == 400  # 4 already delivered
    assert edit(1000).status_code == 400  # more than the warehouse holds
    assert world.stock(world.jar)["full"] == 95


# --- Keeping history ---

def test_deleting_a_route_with_records_is_refused(world):
    route = world.new_route()
    world.deliver(route)
    response = world.client.delete(f"/api/assignments/{route}", headers=world.auth("water_staff"))
    assert response.status_code == 400
    assert world.client.get(f"/api/deliveries/assignment/{route}", headers=world.auth("admin")).json()


def test_deleting_an_empty_route_returns_its_stock(world):
    route = world.new_route(loads={world.jar: 10})
    assert world.stock(world.jar)["full"] == 90
    assert world.client.delete(f"/api/assignments/{route}", headers=world.auth("water_staff")).status_code == 200
    assert world.stock(world.jar)["full"] == 100


def test_deleting_a_route_after_undoing_its_stops_works(world):
    route = world.new_route()
    delivery = world.deliver(route).json()
    world.client.delete(f"/api/deliveries/{delivery['id']}", headers=world.auth("driver"))
    assert world.client.delete(f"/api/assignments/{route}", headers=world.auth("water_staff")).status_code == 200


def test_removing_a_driver_with_history_keeps_their_records(world):
    route = world.new_route()
    world.deliver(route)
    response = world.client.delete(f"/api/users/{world.user_ids['driver']}", headers=world.auth("admin"))
    assert response.status_code == 200 and "deactivated" in response.json()["message"]

    assert world.client.get(f"/api/deliveries/assignment/{route}", headers=world.auth("admin")).json()
    login = world.client.post("/api/auth/login", data={"username": "driver", "password": "correct-horse-1"})
    assert login.status_code == 403
    assert world.client.get("/api/auth/me", headers=world.auth("driver")).status_code == 401


def test_removing_staff_with_no_history_deletes_them(world):
    user_id = world.user_ids["helper"]
    assert world.client.delete(f"/api/users/{user_id}", headers=world.auth("admin")).status_code == 200
    assert world.client.get(f"/api/users/{user_id}", headers=world.auth("admin")).status_code == 404


def test_deactivated_staff_cannot_be_assigned_to_a_route(world):
    world.client.put(f"/api/users/{world.user_ids['other_driver']}", headers=world.auth("admin"), json={"is_active": False})
    response = world.client.post("/api/assignments", headers=world.auth("water_staff"), json={
        "date": "2026-11-02T06:00:00Z", "vehicle_id": world.vehicle, "driver_id": world.user_ids["other_driver"], "route_id": world.route,
    })
    assert response.status_code == 400


def test_administrators_cannot_remove_themselves_or_the_last_admin(world):
    admin, owner = world.user_ids["admin"], world.user_ids["owner"]
    assert world.client.delete(f"/api/users/{admin}", headers=world.auth("admin")).status_code == 400
    assert world.client.delete(f"/api/users/{owner}", headers=world.auth("admin")).status_code == 200
    assert world.client.put(f"/api/users/{admin}", headers=world.auth("admin"), json={"is_active": False}).status_code == 400
    assert world.client.put(f"/api/users/{admin}", headers=world.auth("admin"), json={"role": "DRIVER"}).status_code == 400


def test_customers_with_history_or_dues_are_kept(world):
    world.deliver(world.new_route())
    assert world.client.delete(f"/api/clients/{world.customer}", headers=world.auth("admin")).status_code == 400
    world.client.put(f"/api/clients/{world.wholesale_customer}", headers=world.auth("admin"), json={"credit_amount": 5})
    assert world.client.delete(f"/api/clients/{world.wholesale_customer}", headers=world.auth("admin")).status_code == 400
    world.client.put(f"/api/clients/{world.wholesale_customer}", headers=world.auth("admin"), json={"credit_amount": 0})
    assert world.client.delete(f"/api/clients/{world.wholesale_customer}", headers=world.auth("admin")).status_code == 200


def test_products_with_history_are_kept(world):
    world.new_route(loads={world.jar: 1})
    assert world.client.delete(f"/api/inventory/{world.jar}", headers=world.auth("admin")).status_code == 400
    assert world.client.delete(f"/api/inventory/{world.bottle}", headers=world.auth("admin")).status_code == 200


def test_routes_in_use_are_kept(world):
    assert world.client.delete(f"/api/routes/{world.route}", headers=world.auth("admin")).status_code == 400


# --- Reports and expenses ---

def test_water_report_and_dashboard_exclude_glass(world):
    world.new_route()
    run = world.new_glass_run()
    world.client.post("/api/expenses", headers=world.auth("glass_driver"), json={"assignment_id": run, "category": "FUEL", "amount": 500})

    summary = world.client.get("/api/reports/financial-summary", headers=world.auth("admin")).json()["summary"]
    assert summary["total_trips"] == 1 and summary["total_expenses"] == 0

    assert world.client.get("/api/dashboard/stats", headers=world.auth("admin")).json()["activeAssignments"] == 1
    assert len(world.client.get("/api/assignments", headers=world.auth("admin")).json()) == 1
    assert world.client.get("/api/expenses", headers=world.auth("admin")).json() == []
    assert len(world.client.get("/api/expenses?business_type=GLASS", headers=world.auth("admin")).json()) == 1
    assert [r["name"] for r in world.client.get("/api/routes", headers=world.auth("admin")).json()] == ["Water Route"]


def test_report_splits_collections_and_unpaid_correctly(world):
    route = world.new_route()
    world.deliver(route)  # Cash 160
    world.deliver(route, method="Pay Later (Slip QR)", customer=world.wholesale_customer)  # 130 unpaid
    summary = world.client.get("/api/reports/financial-summary", headers=world.auth("admin")).json()["summary"]
    assert (summary["total_revenue"], summary["total_cash_collected"], summary["total_credit_sales"]) == (290, 160, 130)


def test_any_list_returns_more_than_100_rows(world):
    db = SessionLocal()
    db.add_all([models.Client(name=f"Customer {i}") for i in range(150)])
    db.commit()
    db.close()
    assert len(world.client.get("/api/clients", headers=world.auth("admin")).json()) == 152


def test_owner_can_delete_any_expense_and_drivers_only_their_own(world):
    route = world.new_route()
    expense = world.client.post("/api/expenses", headers=world.auth("driver"), json={"assignment_id": route, "category": "TOLL", "amount": 50}).json()
    assert world.client.delete(f"/api/expenses/{expense['id']}", headers=world.auth("other_driver")).status_code == 403
    assert world.client.delete(f"/api/expenses/{expense['id']}", headers=world.auth("owner")).status_code == 200


def test_expenses_need_a_valid_category_and_the_drivers_own_route(world):
    route = world.new_route()
    post = lambda who, **body: world.client.post("/api/expenses", headers=world.auth(who), json={"assignment_id": route, "category": "FUEL", "amount": 10, **body})
    assert post("driver").status_code == 200
    assert post("driver", category="BRIBES").status_code == 400
    assert post("driver", amount=-5).status_code == 422
    assert post("other_driver").status_code == 403


def test_petty_cash_split_is_recorded_correctly(world):
    route = world.new_route()
    post = lambda **body: world.client.post("/api/expenses", headers=world.auth("driver"), json={"assignment_id": route, "category": "FUEL", **body}).json()
    assert post(amount=100, paid_from_inhand=True, inhand_amount=40)["inhand_amount"] == 40
    assert post(amount=100, paid_from_inhand=True, inhand_amount=400)["inhand_amount"] == 100
    assert post(amount=100, paid_from_inhand=True)["inhand_amount"] == 100
    assert post(amount=100, paid_from_inhand=False, inhand_amount=40)["inhand_amount"] == 0
