from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas
from app.database import get_db

router = APIRouter()

@router.post("", response_model=schemas.InventoryTypeResponse, include_in_schema=False)
@router.post("/", response_model=schemas.InventoryTypeResponse)
def create_inventory_type(inv_type: schemas.InventoryTypeCreate, db: Session = Depends(get_db)):
    return crud.create_inventory_type(db=db, inv_type=inv_type)

@router.get("", response_model=List[schemas.InventoryTypeResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.InventoryTypeResponse])
def read_inventory_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_inventory_types(db, skip=skip, limit=limit)

@router.put("/{inv_type_id}", response_model=schemas.InventoryTypeResponse)
def update_inventory_type(inv_type_id: str, inv_type: schemas.InventoryTypeUpdate, db: Session = Depends(get_db)):
    db_inv_type = crud.get_inventory_type(db, inv_type_id=inv_type_id)
    if db_inv_type is None:
        raise HTTPException(status_code=404, detail="Inventory Type not found")
    return crud.update_inventory_type(db=db, inv_type_id=inv_type_id, inv_update=inv_type)

@router.delete("/{inv_type_id}")
def delete_inventory_type(inv_type_id: str, db: Session = Depends(get_db)):
    db_inv_type = crud.get_inventory_type(db, inv_type_id=inv_type_id)
    if db_inv_type is None:
        raise HTTPException(status_code=404, detail="Inventory Type not found")
    crud.delete_inventory_type(db=db, inv_type_id=inv_type_id)
    return {"message": "Inventory Type deleted successfully"}

@router.post("/{inv_type_id}/stock", response_model=schemas.InventoryTypeResponse)
@router.post("/{inv_type_id}/stock/", response_model=schemas.InventoryTypeResponse, include_in_schema=False)
def adjust_inventory_stock(inv_type_id: str, stock_adj: schemas.StockAdjust, db: Session = Depends(get_db)):
    db_inv_type = crud.adjust_inventory_stock(db=db, inv_type_id=inv_type_id, stock_adj=stock_adj)
    if db_inv_type is None:
        raise HTTPException(status_code=404, detail="Inventory Type not found")
    return db_inv_type
