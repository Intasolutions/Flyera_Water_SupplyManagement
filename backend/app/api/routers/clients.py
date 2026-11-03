from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app import crud, models, schemas
from app.database import get_db
from app.api import deps

router = APIRouter()

water_office = deps.require_roles(deps.WATER_OFFICE)
water_users = deps.require_roles(deps.WATER_ALL)
admin_only = deps.require_roles([])

# On the road, drivers can only correct how to reach a customer.
DRIVER_EDITABLE_FIELDS = {"phone", "address", "latitude", "longitude"}
# Dues and points change through deliveries. Manual corrections are for administrators, and are logged.
ADMIN_ONLY_FIELDS = {"credit_amount", "loyalty_points"}


def _record_dues_change(db: Session, client: models.Client, old_value: float, new_value: float, user: models.User, notes: Optional[str]) -> None:
    db.add(models.PaymentAuditLog(
        action="CREDIT_ADJUST",
        amount=round(new_value - old_value, 2),
        payment_mode="MANUAL",
        verified_by=f"{user.name} ({user.id})",
        notes=f"{client.name}: dues Rs.{old_value:.2f} to Rs.{new_value:.2f}. {notes or ''}".strip(),
    ))


@router.post("", response_model=schemas.ClientResponse, include_in_schema=False)
@router.post("/", response_model=schemas.ClientResponse)
def create_client(
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users)
):
    if not deps.is_admin(current_user):
        # New customers start with nothing owed and no points unless an administrator says otherwise.
        client = client.model_copy(update={"credit_amount": 0.0, "loyalty_points": 0})
    return crud.create_client(db=db, client=client)


@router.get("", response_model=List[schemas.ClientResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.ClientResponse])
def read_clients(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users)
):
    return crud.get_clients(db, skip=skip, limit=limit)


@router.get("/{client_id}", response_model=schemas.ClientResponse)
def read_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users)
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return db_client


@router.put("/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: str,
    client: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users)
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    changed = {
        field for field, value in client.model_dump(exclude_unset=True).items()
        if value != getattr(db_client, field)
    }
    if current_user.role in deps.WATER_FIELD and changed - DRIVER_EDITABLE_FIELDS:
        raise HTTPException(status_code=403, detail="Drivers can only change a customer's phone, address and location.")
    if not deps.is_admin(current_user) and changed & ADMIN_ONLY_FIELDS:
        raise HTTPException(status_code=403, detail="Only an administrator can change dues or loyalty points.")

    if "credit_amount" in changed:
        _record_dues_change(db, db_client, db_client.credit_amount or 0.0, client.credit_amount or 0.0, current_user, "Edited on the customer record.")
    return crud.update_client(db=db, client_id=client_id, client_update=client)


@router.delete("/{client_id}")
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    if crud.client_has_history(db, client_id):
        raise HTTPException(
            status_code=400,
            detail="This customer has delivery history, so the record must stay. Remove them from their route instead.",
        )
    if (db_client.credit_amount or 0) > 0:
        raise HTTPException(status_code=400, detail="This customer still has dues, so the record must stay.")
    crud.delete_client(db, db_client)
    return {"message": "Client deleted successfully"}


@router.post("/{client_id}/credit-adjust", response_model=schemas.ClientResponse)
def adjust_client_credit(
    client_id: str,
    adjust_data: schemas.ClientCreditAdjustRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_only)
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    current_credit = db_client.credit_amount or 0.0
    amount = float(adjust_data.amount)
    if adjust_data.type == "SET":
        new_credit = amount
    elif adjust_data.type == "ADD":
        new_credit = current_credit + amount
    elif adjust_data.type == "DEDUCT":
        new_credit = current_credit - amount
    else:
        raise HTTPException(status_code=400, detail="Adjustment type must be SET, ADD or DEDUCT.")
    new_credit = max(0.0, round(new_credit, 2))

    _record_dues_change(db, db_client, current_credit, new_credit, current_user, adjust_data.notes)
    db_client.credit_amount = new_credit
    db.commit()
    db.refresh(db_client)
    return db_client


# --- Bottle Credit Ledger ---

@router.post("/{client_id}/bottle-credit", response_model=schemas.BottleCreditResponse)
@router.post("/{client_id}/bottle-credit/", response_model=schemas.BottleCreditResponse, include_in_schema=False)
def adjust_bottle_credit(
    client_id: str,
    credit_in: schemas.BottleCreditCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_office)
):
    """Add a manual jar correction for a client. Deliveries record their own jar changes.
    quantity > 0 = jars gone to the customer
    quantity < 0 = jars back from the customer
    """
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    inv = db.query(models.InventoryType).filter(models.InventoryType.id == credit_in.inventory_type_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory type not found")

    entry = models.BottleCreditLedger(
        client_id=client_id,
        assignment_id=credit_in.assignment_id,
        inventory_type_id=credit_in.inventory_type_id,
        quantity=credit_in.quantity,
        notes=credit_in.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return schemas.BottleCreditResponse(
        id=entry.id,
        client_id=entry.client_id,
        assignment_id=entry.assignment_id,
        inventory_type_id=entry.inventory_type_id,
        inventory_name=inv.name,
        quantity=entry.quantity,
        notes=entry.notes,
        created_at=entry.created_at,
    )


@router.get("/{client_id}/bottle-ledger", response_model=List[schemas.BottleCreditResponse])
@router.get("/{client_id}/bottle-ledger/", response_model=List[schemas.BottleCreditResponse], include_in_schema=False)
def get_bottle_ledger(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users)
):
    """Get the full bottle credit ledger for a client."""
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    entries = (
        db.query(models.BottleCreditLedger)
        .filter(models.BottleCreditLedger.client_id == client_id)
        .order_by(models.BottleCreditLedger.created_at.desc())
        .all()
    )
    result = []
    for e in entries:
        inv = db.query(models.InventoryType).filter(models.InventoryType.id == e.inventory_type_id).first()
        result.append(schemas.BottleCreditResponse(
            id=e.id,
            client_id=e.client_id,
            assignment_id=e.assignment_id,
            inventory_type_id=e.inventory_type_id,
            inventory_name=inv.name if inv else None,
            quantity=e.quantity,
            notes=e.notes,
            created_at=e.created_at,
        ))
    return result


@router.get("/{client_id}/bottle-credit-balance")
@router.get("/{client_id}/bottle-credit-balance/", include_in_schema=False)
def get_bottle_credit_balance(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users)
):
    """Returns current net bottle credit balance per inventory type."""
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    entries = db.query(models.BottleCreditLedger).filter(
        models.BottleCreditLedger.client_id == client_id
    ).all()

    # Aggregate by inventory_type_id
    balance: dict = {}
    for e in entries:
        inv = db.query(models.InventoryType).filter(models.InventoryType.id == e.inventory_type_id).first()
        inv_name = inv.name if inv else e.inventory_type_id
        if e.inventory_type_id not in balance:
            balance[e.inventory_type_id] = {"inventory_type_id": e.inventory_type_id, "name": inv_name, "balance": 0}
        balance[e.inventory_type_id]["balance"] += e.quantity

    return {"balances": list(balance.values())}
