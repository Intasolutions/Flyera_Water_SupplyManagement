from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, models, schemas
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.post("", response_model=schemas.ClientResponse, include_in_schema=False)
@router.post("/", response_model=schemas.ClientResponse)
def create_client(
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    return crud.create_client(db=db, client=client)

@router.get("", response_model=List[schemas.ClientResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.ClientResponse])
def read_clients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    clients = crud.get_clients(db, skip=skip, limit=limit)
    return clients

@router.get("/{client_id}", response_model=schemas.ClientResponse)
def read_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
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
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.update_client(db=db, client_id=client_id, client_update=client)

@router.delete("/{client_id}")
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        crud.delete_client(db=db, client_id=client_id)
        return {"message": "Client deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete client: {str(e)}")

@router.post("/{client_id}/credit-adjust", response_model=schemas.ClientResponse)
def adjust_client_credit(
    client_id: str,
    adjust_data: schemas.ClientCreditAdjustRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        current_credit = db_client.credit_amount or 0.0
        if adjust_data.type == "SET":
            db_client.credit_amount = max(0.0, float(adjust_data.amount))
        elif adjust_data.type == "ADD":
            db_client.credit_amount = current_credit + float(adjust_data.amount)
        elif adjust_data.type == "DEDUCT":
            db_client.credit_amount = max(0.0, current_credit - float(adjust_data.amount))
        db.commit()
        db.refresh(db_client)
        return db_client
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to adjust credit: {str(e)}")


# --- Bottle Credit Ledger ---

@router.post("/{client_id}/bottle-credit", response_model=schemas.BottleCreditResponse)
@router.post("/{client_id}/bottle-credit/", response_model=schemas.BottleCreditResponse, include_in_schema=False)
def adjust_bottle_credit(
    client_id: str,
    credit_in: schemas.BottleCreditCreate,
    db: Session = Depends(get_db)
):
    """Add or deduct a bottle credit entry for a client.
    quantity > 0 = we owe customer (partial delivery, advance booking)
    quantity < 0 = customer owes us
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
