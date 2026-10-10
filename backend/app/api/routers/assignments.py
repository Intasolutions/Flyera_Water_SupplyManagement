from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.post("/", response_model=schemas.AssignmentResponse)
def create_assignment(
    assignment: schemas.AssignmentCreate, 
    db: Session = Depends(get_db)
):
    # Ensure vehicle and route exist
    if not db.query(models.Vehicle).filter(models.Vehicle.id == assignment.vehicle_id).first():
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if assignment.route_id and not db.query(models.Route).filter(models.Route.id == assignment.route_id).first():
        raise HTTPException(status_code=404, detail="Route not found")
        
    # Create the assignment
    db_assignment = models.Assignment(
        date=assignment.date,
        vehicle_id=assignment.vehicle_id,
        driver_id=assignment.driver_id,
        helper_id=assignment.helper_id,
        route_id=assignment.route_id,
        status=assignment.status
    )
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    
    # Create allocations and deduct from warehouse stock
    for alloc in assignment.allocations:
        db_alloc = models.Allocation(
            assignment_id=db_assignment.id,
            inventory_type_id=alloc.inventory_type_id,
            allocated_count=alloc.allocated_count
        )
        db.add(db_alloc)
        
        # Deduct from warehouse stock
        crud.adjust_inventory_stock(
            db, 
            inv_type_id=alloc.inventory_type_id, 
            stock_adj=schemas.StockAdjust(add_full=-alloc.allocated_count, add_empty=0, add_damaged=0)
        )
        
    db.commit()
    db.refresh(db_assignment)
    return db_assignment

@router.get("/", response_model=List[schemas.AssignmentResponse])
def get_assignments(
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(get_db)
):
    # If we don't have current_user, return all assignments
    return db.query(models.Assignment).offset(skip).limit(limit).all()

@router.get("/{assignment_id}", response_model=schemas.AssignmentResponse)
def get_assignment(
    assignment_id: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return db_assignment

@router.put("/{assignment_id}", response_model=schemas.AssignmentResponse)
def update_assignment(
    assignment_id: str,
    assignment_in: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if assignment_in.status is not None:
        db_assignment.status = assignment_in.status
    if assignment_in.helper_id is not None:
        db_assignment.helper_id = assignment_in.helper_id
        
    db.commit()
    db.refresh(db_assignment)
    return db_assignment

@router.put("/{assignment_id}/complete", response_model=schemas.AssignmentResponse)
def complete_assignment(
    assignment_id: str, 
    returned_stock: List[schemas.AllocationBase], # Needs inventory_type, returned_full, returned_empty
    db: Session = Depends(get_db)
):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if db_assignment.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Assignment already completed")
        
    # Reconcile stock
    for returned in returned_stock:
        # Update allocation record
        db_alloc = db.query(models.Allocation).filter(
            models.Allocation.assignment_id == assignment_id,
            models.Allocation.inventory_type_id == returned.inventory_type_id
        ).first()
        
        if db_alloc:
            db_alloc.returned_full = returned.returned_full
            db_alloc.returned_empty = returned.returned_empty
            
        # Add back to warehouse stock
        crud.adjust_inventory_stock(
            db, 
            inv_type_id=returned.inventory_type_id, 
            stock_adj=schemas.StockAdjust(add_full=returned.returned_full, add_empty=returned.returned_empty, add_damaged=0)
        )
        
    db_assignment.status = "COMPLETED"
    db.commit()
    db.refresh(db_assignment)
    return db_assignment

@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Restore stock for allocations
    for alloc in db_assignment.allocations:
        crud.adjust_inventory_stock(
            db, 
            inv_type_id=alloc.inventory_type_id, 
            stock_adj=schemas.StockAdjust(add_full=alloc.allocated_count, add_empty=0, add_damaged=0)
        )
        db.delete(alloc)
        
    db.delete(db_assignment)
    db.commit()
    return {"message": "Assignment deleted successfully"}

