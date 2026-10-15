
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.post("", response_model=schemas.VehicleResponse, include_in_schema=False)
@router.post("/", response_model=schemas.VehicleResponse)
def create_vehicle(
    vehicle: schemas.VehicleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    return crud.create_vehicle(db=db, vehicle=vehicle)

@router.get("", response_model=List[schemas.VehicleResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.VehicleResponse])
def read_vehicles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    vehicles = crud.get_vehicles(db, skip=skip, limit=limit)
    return vehicles

@router.put("/{vehicle_id}", response_model=schemas.VehicleResponse)
def update_vehicle(
    vehicle_id: str,
    vehicle: schemas.VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    db_vehicle = crud.get_vehicle(db, vehicle_id=vehicle_id)
    if db_vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return crud.update_vehicle(db=db, vehicle_id=vehicle_id, vehicle_update=vehicle)

@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
):
    db_vehicle = crud.get_vehicle(db, vehicle_id=vehicle_id)
    if db_vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    assignment_count = db.query(models.Assignment).filter(models.Assignment.vehicle_id == vehicle_id).count()
    if assignment_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete vehicle because it is assigned to existing delivery shifts. Please delete or reassign those shifts first."
        )
    try:
        crud.delete_vehicle(db=db, vehicle_id=vehicle_id)
        return {"message": "Vehicle deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete vehicle: {str(e)}")
