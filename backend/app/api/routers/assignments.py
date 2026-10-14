from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.post("", response_model=schemas.AssignmentResponse, include_in_schema=False)
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

@router.get("", response_model=List[schemas.AssignmentResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.AssignmentResponse])
def get_assignments(
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(get_db)
):
    from sqlalchemy import case
    status_order = case(
        (models.Assignment.status == "ACTIVE", 0),
        (models.Assignment.status == "PENDING", 1),
        else_=2
    )
    return db.query(models.Assignment).order_by(status_order, models.Assignment.created_at.asc()).offset(skip).limit(limit).all()

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
    db: Session = Depends(get_db)
):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if assignment_in.vehicle_id is not None:
        db_assignment.vehicle_id = assignment_in.vehicle_id
    if assignment_in.driver_id is not None:
        db_assignment.driver_id = assignment_in.driver_id
    if assignment_in.helper_id is not None:
        db_assignment.helper_id = assignment_in.helper_id if assignment_in.helper_id != "" else None
    if assignment_in.route_id is not None:
        db_assignment.route_id = assignment_in.route_id
    if assignment_in.date is not None:
        db_assignment.date = assignment_in.date
    if assignment_in.status is not None:
        db_assignment.status = assignment_in.status
        
    if assignment_in.allocations is not None:
        # Restore previously allocated stock back to warehouse inventory
        for alloc in db_assignment.allocations:
            crud.adjust_inventory_stock(
                db,
                inv_type_id=alloc.inventory_type_id,
                stock_adj=schemas.StockAdjust(add_full=alloc.allocated_count, add_empty=0, add_damaged=0)
            )
            db.delete(alloc)
            
        db.flush()
        
        # Insert newly allocated items and deduct from warehouse inventory
        for alloc in assignment_in.allocations:
            db_alloc = models.Allocation(
                assignment_id=db_assignment.id,
                inventory_type_id=alloc.inventory_type_id,
                allocated_count=alloc.allocated_count
            )
            db.add(db_alloc)
            crud.adjust_inventory_stock(
                db,
                inv_type_id=alloc.inventory_type_id,
                stock_adj=schemas.StockAdjust(add_full=-alloc.allocated_count, add_empty=0, add_damaged=0)
            )
            
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
        # Assignment is already completed; return it gracefully without throwing an error
        return db_assignment
        
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

@router.put("/{assignment_id}/reopen", response_model=schemas.AssignmentResponse)
def reopen_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if db_assignment.status != "COMPLETED":
        # Already active or pending, return as is
        return db_assignment
        
    # Revert warehouse stock additions that were credited during completion
    for alloc in db_assignment.allocations:
        returned_full = alloc.returned_full or 0
        returned_empty = alloc.returned_empty or 0
        if returned_full > 0 or returned_empty > 0:
            crud.adjust_inventory_stock(
                db,
                inv_type_id=alloc.inventory_type_id,
                stock_adj=schemas.StockAdjust(add_full=-returned_full, add_empty=-returned_empty, add_damaged=0)
            )
        alloc.returned_full = 0
        alloc.returned_empty = 0
        
    db_assignment.status = "ACTIVE"
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
    
    try:
        # Restore stock only for non-completed shifts (since completed shifts have already reconciled returned/full stock)
        if db_assignment.status != "COMPLETED":
            for alloc in db_assignment.allocations:
                stock = db.query(models.Stock).filter(models.Stock.inventory_type_id == alloc.inventory_type_id).first()
                if stock:
                    stock.full_count = (stock.full_count or 0) + (alloc.allocated_count or 0)
        
        # Explicitly delete all delivery items and deliveries for this assignment
        for delivery in list(db_assignment.deliveries):
            for item in list(delivery.items):
                db.delete(item)
            db.delete(delivery)
            
        # Explicitly delete allocations
        for alloc in list(db_assignment.allocations):
            db.delete(alloc)
            
        db.delete(db_assignment)
        db.commit()
        return {"message": "Assignment deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete assignment: {str(e)}")

