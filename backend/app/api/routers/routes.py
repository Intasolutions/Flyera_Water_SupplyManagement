from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ... import crud, schemas, models
from ...database import get_db
from .. import deps

router = APIRouter()

@router.post("", response_model=schemas.RouteResponse, include_in_schema=False)
@router.post("/", response_model=schemas.RouteResponse)
def create_route(
    route: schemas.RouteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    return crud.create_route(db=db, route=route)

@router.get("", response_model=List[schemas.RouteResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.RouteResponse])
def read_routes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    return crud.get_routes(db, skip=skip, limit=limit)

@router.get("/{route_id}", response_model=schemas.RouteResponse)
def read_route(
    route_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_route = crud.get_route(db, route_id=route_id)
    if db_route is None:
        raise HTTPException(status_code=404, detail="Route not found")
    return db_route

@router.put("/{route_id}", response_model=schemas.RouteResponse)
def update_route(
    route_id: str,
    route: schemas.RouteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    db_route = crud.update_route(db, route_id=route_id, route_update=route)
    if db_route is None:
        raise HTTPException(status_code=404, detail="Route not found")
    return db_route

@router.delete("/{route_id}")
def delete_route(
    route_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "Owner"]))
):
    db_route = crud.get_route(db, route_id=route_id)
    if db_route is None:
        raise HTTPException(status_code=404, detail="Route not found")
    try:
        crud.delete_route(db, route_id=route_id)
        return {"message": "Route deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete route: {str(e)}")
