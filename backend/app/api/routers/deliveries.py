from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models
from app.database import get_db
from app.api import deps

router = APIRouter()

@router.post("", response_model=schemas.DeliveryResponse, include_in_schema=False)
@router.post("/", response_model=schemas.DeliveryResponse)
def create_delivery(
    delivery: schemas.DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    # Verify assignment exists and is not completed
    assignment = db.query(models.Assignment).filter(models.Assignment.id == delivery.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Assignment is already completed")
        
    # Verify client exists
    client = db.query(models.Client).filter(models.Client.id == delivery.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Change assignment status to ACTIVE if it was PENDING
    if assignment.status == "PENDING":
        assignment.status = "ACTIVE"
        
    # Create the delivery record
    db_delivery = models.Delivery(
        assignment_id=delivery.assignment_id,
        client_id=delivery.client_id,
        total_amount=delivery.total_amount,
        payment_method=delivery.payment_method,
        status=delivery.status
    )
    db.add(db_delivery)
    db.commit()
    db.refresh(db_delivery)
    
    total_loyalty_points = 0
    
    # Process items
    for item in delivery.items:
        db_item = models.DeliveryItem(
            delivery_id=db_delivery.id,
            inventory_type_id=item.inventory_type_id,
            delivered_full=item.delivered_full,
            collected_empty=item.collected_empty,
            price_charged=item.price_charged
        )
        db.add(db_item)
        
        # Calculate points based on inventory type
        inv_type = db.query(models.InventoryType).filter(models.InventoryType.id == item.inventory_type_id).first()
        if inv_type and client.opt_in_loyalty:
            total_loyalty_points += item.delivered_full * inv_type.points_value
            
    # Add loyalty points to client
    if total_loyalty_points > 0:
        client.loyalty_points += total_loyalty_points
        
    db.commit()
    db.refresh(db_delivery)
    return db_delivery

@router.get("/assignment/{assignment_id}", response_model=List[schemas.DeliveryResponse])
def get_deliveries_by_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    return db.query(models.Delivery).filter(models.Delivery.assignment_id == assignment_id).all()
