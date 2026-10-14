from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, models, schemas
from app.database import get_db

router = APIRouter()

@router.post("", response_model=schemas.ClientResponse, include_in_schema=False)
@router.post("/", response_model=schemas.ClientResponse)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    return crud.create_client(db=db, client=client)

@router.get("", response_model=List[schemas.ClientResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.ClientResponse])
def read_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    clients = crud.get_clients(db, skip=skip, limit=limit)
    return clients

@router.get("/{client_id}", response_model=schemas.ClientResponse)
def read_client(client_id: str, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return db_client

@router.put("/{client_id}", response_model=schemas.ClientResponse)
def update_client(client_id: str, client: schemas.ClientUpdate, db: Session = Depends(get_db)):
    db_client = crud.get_client(db, client_id=client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return crud.update_client(db=db, client_id=client_id, client_update=client)

@router.delete("/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
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
