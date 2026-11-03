import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload
from typing import Dict, List

from app import crud, schemas, models
from app.core.timeutils import utcnow
from app.database import get_db
from app.api import deps

router = APIRouter()

water_office = deps.require_roles(deps.WATER_OFFICE)
water_users = deps.require_roles(deps.WATER_ALL)

# Statuses whose unpaid part is counted in the customer's dues.
DUES_STATUSES = ("PENDING_PAYMENT", "PENDING", "CREDITED", "PARTIAL_PAID")


def _money(value) -> float:
    return round(float(value or 0.0), 2)


def _unit_price(inv_type: models.InventoryType, tier: str) -> float:
    if tier == "Wholesale":
        return inv_type.wholesale_price
    if tier == "Premium":
        return inv_type.premium_price
    return inv_type.price


def _payment_kind(method: str) -> str:
    text = (method or "").lower()
    if "skip" in text:
        return "skipped"
    if any(word in text for word in ("pay later", "slip", "credit")):
        return "later"
    if "upi" in text:
        return "upi"
    return "cash"


def _verifier_name(user: models.User) -> str:
    return user.name or user.username or "Admin"


def _ensure_can_undo(user: models.User, delivery: models.Delivery) -> None:
    """Payments the office has confirmed stay on record. Drivers can only undo their own open stops."""
    if delivery.upi_reference or (delivery.verified_at and (delivery.paid_amount or 0) > 0):
        raise HTTPException(status_code=400, detail="This payment has been verified by the office, so it cannot be deleted.")
    if deps.can_manage_assignment(user, delivery.assignment):
        return
    if not deps.is_assigned(user, delivery.assignment):
        raise HTTPException(status_code=403, detail="This delivery is not on your route.")
    if delivery.assignment.status == "COMPLETED" or delivery.verified_at:
        raise HTTPException(status_code=403, detail="Ask the office to change this: the route or bill is already closed.")


def _reverse_delivery(db: Session, delivery: models.Delivery) -> None:
    """Undoes everything a delivery changed, so dues, jar balances, points and stock all stay correct."""
    client = db.query(models.Client).filter(models.Client.id == delivery.client_id).with_for_update().first()
    assignment = delivery.assignment

    if client and delivery.status in DUES_STATUSES:
        unpaid = max(0.0, _money(delivery.total_amount) - _money(delivery.paid_amount))
        client.credit_amount = max(0.0, _money(_money(client.credit_amount) - unpaid))

    for item in delivery.items:
        inv_type = item.inventory_type
        if client and client.opt_in_loyalty and inv_type:
            client.loyalty_points = max(0, (client.loyalty_points or 0) - (item.delivered_full or 0) * (inv_type.points_value or 0))

        net_jars = (item.delivered_full or 0) - (item.collected_empty or 0)
        if net_jars != 0:
            db.add(models.BottleCreditLedger(
                client_id=delivery.client_id,
                assignment_id=delivery.assignment_id,
                inventory_type_id=item.inventory_type_id,
                quantity=-net_jars,
                notes=f"Reversal: delivery {delivery.id[:6].upper()} was undone",
            ))

        # On a closed route the warehouse already has its counts, so correct them here.
        if assignment.status == "COMPLETED":
            allocation = next((a for a in assignment.allocations if a.inventory_type_id == item.inventory_type_id), None)
            if allocation:
                allocation.returned_full = (allocation.returned_full or 0) + (item.delivered_full or 0)
                allocation.returned_empty = max(0, (allocation.returned_empty or 0) - (item.collected_empty or 0))
            crud.adjust_inventory_stock(
                db,
                inv_type_id=item.inventory_type_id,
                stock_adj=schemas.StockAdjust(add_full=item.delivered_full or 0, add_empty=-(item.collected_empty or 0)),
                commit=False,
            )

    db.delete(delivery)


def _commit_reversal(db: Session, delivery: models.Delivery) -> None:
    try:
        _reverse_delivery(db, delivery)
        db.commit()
    except crud.InsufficientStockError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error))


@router.post("", response_model=schemas.DeliveryResponse, include_in_schema=False)
@router.post("/", response_model=schemas.DeliveryResponse)
def create_delivery(
    delivery: schemas.DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == delivery.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    deps.ensure_assignment_access(current_user, assignment)
    if assignment.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Assignment is already completed")

    client = db.query(models.Client).filter(models.Client.id == delivery.client_id).with_for_update().first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # One record per stop. This also makes it safe to retry after a lost connection.
    if db.query(models.Delivery.id).filter(
        models.Delivery.assignment_id == assignment.id,
        models.Delivery.client_id == client.id,
    ).first():
        raise HTTPException(status_code=409, detail=f"A delivery for {client.name} is already saved on this route.")

    kind = _payment_kind(delivery.payment_method)
    items = [] if kind == "skipped" else delivery.items

    # Check the van can supply this stop.
    delivered_so_far: Dict[str, int] = {}
    for existing in assignment.deliveries:
        for item in existing.items:
            delivered_so_far[item.inventory_type_id] = delivered_so_far.get(item.inventory_type_id, 0) + (item.delivered_full or 0)
    loaded = {alloc.inventory_type_id: alloc.allocated_count or 0 for alloc in assignment.allocations}

    total = 0.0
    loyalty_points = 0
    db_items: List[models.DeliveryItem] = []
    ledger: List[models.BottleCreditLedger] = []
    for item in items:
        inv_type = db.query(models.InventoryType).filter(models.InventoryType.id == item.inventory_type_id).first()
        if not inv_type:
            raise HTTPException(status_code=404, detail="Inventory type not found")

        available = loaded.get(item.inventory_type_id, 0) - delivered_so_far.get(item.inventory_type_id, 0)
        if item.delivered_full > available:
            raise HTTPException(status_code=400, detail=f"Only {max(0, available)} of {inv_type.name} left on this van.")
        delivered_so_far[item.inventory_type_id] = delivered_so_far.get(item.inventory_type_id, 0) + item.delivered_full

        price = _unit_price(inv_type, client.tier)
        total += item.delivered_full * price
        if client.opt_in_loyalty:
            loyalty_points += item.delivered_full * (inv_type.points_value or 0)

        db_items.append(models.DeliveryItem(
            inventory_type_id=item.inventory_type_id,
            delivered_full=item.delivered_full,
            collected_empty=item.collected_empty,
            price_charged=price,
        ))
        net_jars = item.delivered_full - item.collected_empty
        if net_jars != 0:
            ledger.append(models.BottleCreditLedger(
                client_id=client.id,
                assignment_id=assignment.id,
                inventory_type_id=item.inventory_type_id,
                quantity=net_jars,
                notes=f"Delivery stop: {item.delivered_full} delivered, {item.collected_empty} empty returned",
            ))
    total = _money(total)

    paid = 0.0
    new_dues = 0.0
    if kind == "skipped":
        status = "SKIPPED"
    elif total <= 0:
        status = "COMPLETED"
    elif kind == "cash":
        status, paid = "COMPLETED", total
    elif kind == "upi":
        # The driver cannot confirm a bank transfer, so the office checks it against the statement.
        status = "PENDING_VERIFICATION"
    else:
        paid = min(_money(delivery.paid_amount), total)
        new_dues = _money(total - paid)
        status = "COMPLETED" if new_dues <= 0 else ("PARTIAL_PAID" if paid > 0 else "PENDING_PAYMENT")

    if assignment.status == "PENDING":
        assignment.status = "ACTIVE"

    db_delivery = models.Delivery(
        assignment_id=assignment.id,
        client_id=client.id,
        total_amount=total,
        paid_amount=paid,
        payment_method=delivery.payment_method,
        status=status,
    )
    db_delivery.items = db_items
    db.add(db_delivery)
    db.add_all(ledger)

    client.loyalty_points = (client.loyalty_points or 0) + loyalty_points
    client.credit_amount = _money(_money(client.credit_amount) + new_dues)

    db.commit()
    db.refresh(db_delivery)
    return db_delivery


@router.get("/assignment/{assignment_id}", response_model=List[schemas.DeliveryResponse])
def get_deliveries_by_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    deps.ensure_assignment_access(current_user, assignment)
    return (
        db.query(models.Delivery)
        .options(selectinload(models.Delivery.items))
        .filter(models.Delivery.assignment_id == assignment_id)
        .all()
    )


@router.delete("/by-client/{assignment_id}/{client_id}")
def delete_delivery_by_client(
    assignment_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    db_delivery = db.query(models.Delivery).filter(
        models.Delivery.assignment_id == assignment_id,
        models.Delivery.client_id == client_id
    ).order_by(models.Delivery.created_at.desc()).first()

    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found for this client")

    _ensure_can_undo(current_user, db_delivery)
    _commit_reversal(db, db_delivery)
    return {"message": "Delivery reverted successfully"}


@router.delete("/{delivery_id}")
def delete_delivery(
    delivery_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    db_delivery = db.query(models.Delivery).filter(models.Delivery.id == delivery_id).first()
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")

    _ensure_can_undo(current_user, db_delivery)
    _commit_reversal(db, db_delivery)
    return {"message": "Delivery deleted successfully"}


@router.get("/pending-doorstep", response_model=List[schemas.DeliveryResponse])
def get_pending_doorstep_deliveries(
    include_all: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_office),
):
    # High-performance query with relationship preloading to eliminate N+1 latency
    query = db.query(models.Delivery).options(
        selectinload(models.Delivery.items)
    )
    open_bills = [
        models.Delivery.status.in_(["PENDING_PAYMENT", "PENDING_VERIFICATION", "PENDING", "CREDITED", "PARTIAL_PAID"]),
        models.Delivery.payment_method.ilike("%Slip%"),
        models.Delivery.payment_method.ilike("%Pay Later%"),
        models.Delivery.payment_method.ilike("%Credited%"),
    ]
    if include_all:
        query = query.filter(or_(*open_bills, models.Delivery.verified_at != None))
    else:
        # Only pending verification / credited / partial / unverified slip QRs
        query = query.filter(or_(*open_bills)).filter(models.Delivery.status != "COMPLETED")
    return query.order_by(models.Delivery.created_at.desc()).all()


def _verify_paid(db: Session, delivery: models.Delivery, client: models.Client, req: schemas.DeliveryVerifyRequest, user: models.User) -> None:
    clean_ref = (req.upi_reference or "").strip()
    payment_mode = (req.payment_mode or "UPI").upper()

    if "UPI" in payment_mode:
        if not clean_ref:
            raise HTTPException(status_code=400, detail="UPI Reference / UTR number from bank statement is required.")
        # Standard Indian UPI UTR is 12 digits (accept alphanumeric bank refs 8-24 chars)
        if not re.match(r"^[a-zA-Z0-9]{8,24}$", clean_ref):
            raise HTTPException(status_code=400, detail="Invalid UPI Reference / UTR format. Expected 12-digit numeric bank reference.")
        # A reference can only ever pay once, including earlier payments on this same bill.
        reused = db.query(models.PaymentAuditLog.id).filter(
            models.PaymentAuditLog.upi_reference == clean_ref,
            models.PaymentAuditLog.action == "VERIFY_PAID",
        ).first() or db.query(models.Delivery.id).filter(models.Delivery.upi_reference == clean_ref).first()
        if reused:
            raise HTTPException(status_code=400, detail=f"UPI UTR '{clean_ref}' has already been used. Duplicate reference numbers are blocked.")

    was_awaiting_check = delivery.status == "PENDING_VERIFICATION"
    unpaid = max(0.0, _money(delivery.total_amount) - _money(delivery.paid_amount))
    dues = _money(client.credit_amount) if client else 0.0
    # A bill on dues can also settle older dues. A UPI check covers only its own bill.
    limit = unpaid if was_awaiting_check else max(unpaid, dues)
    if limit <= 0:
        raise HTTPException(status_code=400, detail="Nothing is left to pay on this bill.")

    amount = _money(req.amount_paid) if req.amount_paid is not None else limit
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Enter the amount received.")
    if amount > limit:
        raise HTTPException(status_code=400, detail=f"Amount is more than the Rs.{limit:.2f} due.")

    delivery.paid_amount = _money(_money(delivery.paid_amount) + amount)
    remaining = max(0.0, _money(delivery.total_amount) - delivery.paid_amount)

    if client:
        if was_awaiting_check:
            # This bill was never on dues. Only a short payment adds to them.
            client.credit_amount = _money(dues + remaining)
        else:
            client.credit_amount = max(0.0, _money(dues - amount))

    fully_settled = remaining <= 0 and (was_awaiting_check or not client or client.credit_amount <= 0)
    delivery.status = "COMPLETED" if fully_settled else "PARTIAL_PAID"
    delivery.payment_method = "Cash" if "CASH" in payment_mode else "UPI (Verified)"
    if clean_ref:
        delivery.upi_reference = clean_ref

    delivery.verified_at = utcnow()
    delivery.verified_by = _verifier_name(user)
    if req.notes:
        delivery.notes = req.notes

    db.add(models.PaymentAuditLog(
        delivery_id=delivery.id,
        action="VERIFY_PAID",
        amount=amount,
        payment_mode=delivery.payment_method,
        upi_reference=clean_ref or None,
        verified_by=f"{_verifier_name(user)} ({user.id})",
        notes=req.notes or "",
    ))


def _mark_credited(db: Session, delivery: models.Delivery, client: models.Client, req: schemas.DeliveryVerifyRequest, user: models.User) -> None:
    unpaid = max(0.0, _money(delivery.total_amount) - _money(delivery.paid_amount))
    if unpaid <= 0:
        raise HTTPException(status_code=400, detail="Nothing is left to pay on this bill.")

    # A UPI claim that never reached the bank becomes dues now. Other bills are already counted.
    if client and delivery.status == "PENDING_VERIFICATION":
        client.credit_amount = _money(_money(client.credit_amount) + unpaid)

    delivery.status = "CREDITED"
    delivery.payment_method = "Credited / Unpaid"
    delivery.verified_at = utcnow()
    delivery.verified_by = _verifier_name(user)
    if req.notes:
        delivery.notes = req.notes

    db.add(models.PaymentAuditLog(
        delivery_id=delivery.id,
        action="MARK_CREDITED",
        amount=unpaid,
        payment_mode=delivery.payment_method,
        verified_by=f"{_verifier_name(user)} ({user.id})",
        notes=req.notes or "",
    ))


@router.post("/{delivery_id}/verify", response_model=schemas.DeliveryResponse)
def verify_doorstep_delivery(
    delivery_id: str,
    verify_req: schemas.DeliveryVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_office),
):
    """Office confirmation of a bill. Drivers cannot verify payments, and every action is logged."""
    db_delivery = db.query(models.Delivery).filter(models.Delivery.id == delivery_id).first()
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")
    client = db.query(models.Client).filter(models.Client.id == db_delivery.client_id).with_for_update().first()

    if verify_req.action == "VERIFY_PAID":
        _verify_paid(db, db_delivery, client, verify_req, current_user)
    elif verify_req.action == "MARK_CREDITED":
        _mark_credited(db, db_delivery, client, verify_req, current_user)
    else:
        raise HTTPException(status_code=400, detail="Invalid verification action. Use VERIFY_PAID or MARK_CREDITED.")

    db.commit()
    db.refresh(db_delivery)
    return db_delivery
