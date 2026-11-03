from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app import crud, schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.post("", response_model=schemas.InventoryTypeResponse, include_in_schema=False)
@router.post("/", response_model=schemas.InventoryTypeResponse)
def create_inventory_type(
    inv_type: schemas.InventoryTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
):
    return crud.create_inventory_type(db=db, inv_type=inv_type)

@router.get("", response_model=List[schemas.InventoryTypeResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.InventoryTypeResponse])
def read_inventory_types(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(deps.WATER_ALL))
):
    return crud.get_inventory_types(db, skip=skip, limit=limit)

@router.put("/{inv_type_id}", response_model=schemas.InventoryTypeResponse)
def update_inventory_type(
    inv_type_id: str,
    inv_type: schemas.InventoryTypeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
):
    db_inv_type = crud.get_inventory_type(db, inv_type_id=inv_type_id)
    if db_inv_type is None:
        raise HTTPException(status_code=404, detail="Inventory Type not found")
    return crud.update_inventory_type(db=db, inv_type_id=inv_type_id, inv_update=inv_type)

@router.delete("/{inv_type_id}")
def delete_inventory_type(
    inv_type_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
):
    db_inv_type = crud.get_inventory_type(db, inv_type_id=inv_type_id)
    if db_inv_type is None:
        raise HTTPException(status_code=404, detail="Inventory Type not found")
    if crud.inventory_type_has_history(db, inv_type_id):
        raise HTTPException(
            status_code=400,
            detail="This product has been loaded or sold, so it cannot be deleted without losing sales history.",
        )
    crud.delete_inventory_type(db, db_inv_type)
    return {"message": "Inventory Type deleted successfully"}

@router.post("/{inv_type_id}/stock", response_model=schemas.InventoryTypeResponse)
@router.post("/{inv_type_id}/stock/", response_model=schemas.InventoryTypeResponse, include_in_schema=False)
def adjust_inventory_stock(
    inv_type_id: str,
    stock_adj: schemas.StockAdjust,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    try:
        db_inv_type = crud.adjust_inventory_stock(db=db, inv_type_id=inv_type_id, stock_adj=stock_adj)
    except crud.InsufficientStockError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error))
    if db_inv_type is None:
        raise HTTPException(status_code=404, detail="Inventory Type not found")
    return db_inv_type
