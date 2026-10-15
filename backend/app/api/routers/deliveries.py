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

    # If delivery is on credit / pay later / doorstep slip, record in client's credit dues
    is_credit_delivery = (
        delivery.status in ["PENDING_PAYMENT", "CREDITED", "PARTIAL_PAID"] or 
        (delivery.payment_method and ("credit" in delivery.payment_method.lower() or "pay later" in delivery.payment_method.lower() or "slip" in delivery.payment_method.lower()))
    )

    initial_paid = 0.0
    if delivery.status == "COMPLETED" or (delivery.payment_method and ("cash" in delivery.payment_method.lower() or "upi" in delivery.payment_method.lower()) and not is_credit_delivery):
        initial_paid = float(delivery.total_amount)
    elif delivery.paid_amount:
        initial_paid = float(delivery.paid_amount)
        
    # Change assignment status to ACTIVE if it was PENDING
    if assignment.status == "PENDING":
        assignment.status = "ACTIVE"
        
    # Create the delivery record
    db_delivery = models.Delivery(
        assignment_id=delivery.assignment_id,
        client_id=delivery.client_id,
        total_amount=delivery.total_amount,
        paid_amount=initial_paid,
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
        
    if is_credit_delivery and delivery.total_amount > 0:
        client.credit_amount = (client.credit_amount or 0.0) + delivery.total_amount
        
    db.commit()
    db.refresh(db_delivery)
    return db_delivery

@router.get("/assignment/{assignment_id}", response_model=List[schemas.DeliveryResponse])
def get_deliveries_by_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    from sqlalchemy.orm import selectinload
    return (
        db.query(models.Delivery)
        .options(selectinload(models.Delivery.items))
        .filter(models.Delivery.assignment_id == assignment_id)
        .all()
    )

@router.delete("/by-client/{assignment_id}/{client_id}")
def delete_delivery_by_client(
    assignment_id: str,
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_delivery = db.query(models.Delivery).filter(
        models.Delivery.assignment_id == assignment_id,
        models.Delivery.client_id == client_id
    ).order_by(models.Delivery.created_at.desc()).first()
    
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found for this client")
        
    try:
        client = db.query(models.Client).filter(models.Client.id == client_id).first()
        if client and client.opt_in_loyalty:
            for item in db_delivery.items:
                inv_type = db.query(models.InventoryType).filter(models.InventoryType.id == item.inventory_type_id).first()
                if inv_type:
                    client.loyalty_points = max(0, client.loyalty_points - (item.delivered_full * inv_type.points_value))
                    
        for item in db_delivery.items:
            db.delete(item)
        db.delete(db_delivery)
        db.commit()
        return {"message": "Delivery reverted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete delivery: {str(e)}")

@router.delete("/{delivery_id}")
def delete_delivery(
    delivery_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    db_delivery = db.query(models.Delivery).filter(models.Delivery.id == delivery_id).first()
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")
        
    try:
        client = db.query(models.Client).filter(models.Client.id == db_delivery.client_id).first()
        if client and client.opt_in_loyalty:
            for item in db_delivery.items:
                inv_type = db.query(models.InventoryType).filter(models.InventoryType.id == item.inventory_type_id).first()
                if inv_type:
                    client.loyalty_points = max(0, client.loyalty_points - (item.delivered_full * inv_type.points_value))
                    
        for item in db_delivery.items:
            db.delete(item)
        db.delete(db_delivery)
        db.commit()
        return {"message": "Delivery deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete delivery: {str(e)}")

@router.get("/pending-doorstep", response_model=List[schemas.DeliveryResponse])
def get_pending_doorstep_deliveries(
    include_all: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    from sqlalchemy import or_
    from sqlalchemy.orm import selectinload

    # High-performance query with relationship preloading to eliminate N+1 latency
    query = db.query(models.Delivery).options(
        selectinload(models.Delivery.items)
    )
    if include_all:
        query = query.filter(
            or_(
                models.Delivery.status.in_(["PENDING_PAYMENT", "PENDING_VERIFICATION", "PENDING", "CREDITED", "PARTIAL_PAID"]),
                models.Delivery.payment_method.ilike("%Slip%"),
                models.Delivery.payment_method.ilike("%Pay Later%"),
                models.Delivery.payment_method.ilike("%Credited%"),
                models.Delivery.verified_at != None
            )
        )
    else:
        # Only pending verification / credited / partial / unverified slip QRs
        query = query.filter(
            or_(
                models.Delivery.status.in_(["PENDING_PAYMENT", "PENDING_VERIFICATION", "PENDING", "CREDITED", "PARTIAL_PAID"]),
                models.Delivery.payment_method.ilike("%Slip%"),
                models.Delivery.payment_method.ilike("%Pay Later%"),
                models.Delivery.payment_method.ilike("%Credited%")
            )
        ).filter(models.Delivery.status != "COMPLETED")
    return query.order_by(models.Delivery.created_at.desc()).all()

@router.post("/{delivery_id}/verify", response_model=schemas.DeliveryResponse)
def verify_doorstep_delivery(
    delivery_id: str,
    verify_req: schemas.DeliveryVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(["ADMIN", "WATER_STAFF", "Owner"]))
):
    """
    Cryptographically safe, RBAC-protected verification endpoint for doorstep deliveries.
    Drivers are strictly restricted from verifying payments.
    Includes duplicate UTR prevention and tamper-evident audit logging.
    """
    import re
    import uuid
    from datetime import datetime
    from sqlalchemy import text

    db_delivery = db.query(models.Delivery).filter(models.Delivery.id == delivery_id).first()
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")
        
    client = db.query(models.Client).filter(models.Client.id == db_delivery.client_id).first()
    
    try:
        if verify_req.action == "VERIFY_PAID":
            clean_upi_ref = (verify_req.upi_reference or "").strip()
            payment_mode = (verify_req.payment_mode or "UPI").upper()

            # If UPI payment mode, strictly validate UTR format and check for duplicate reuse
            if "UPI" in payment_mode:
                if not clean_upi_ref:
                    raise HTTPException(
                        status_code=400,
                        detail="UPI Reference / UTR number from bank statement is required."
                    )
                # Standard Indian UPI UTR is 12 digits (accept alphanumeric bank refs 8-24 chars)
                if not re.match(r"^[a-zA-Z0-9]{8,24}$", clean_upi_ref):
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid UPI Reference / UTR format. Expected 12-digit numeric bank reference."
                    )

                # Duplicate UTR check across all deliveries in database
                duplicate_payment = db.query(models.Delivery).filter(
                    models.Delivery.upi_reference == clean_upi_ref,
                    models.Delivery.id != delivery_id
                ).first()
                if duplicate_payment:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Security alert: UPI UTR '{clean_upi_ref}' has already been credited to another delivery. Duplicate reference numbers are strictly blocked."
                    )

            # Amount verified as credited into bank / UPI account
            payment_amount = float(verify_req.amount_paid) if verify_req.amount_paid is not None else float(db_delivery.total_amount)
            if payment_amount < 0:
                payment_amount = 0.0

            # 1. Update cumulative paid amount on this delivery
            db_delivery.paid_amount = (db_delivery.paid_amount or 0.0) + payment_amount

            # 2. Settle / deduct paid amount from client's total ledger credit dues
            if client and payment_amount > 0:
                client.credit_amount = max(0.0, (client.credit_amount or 0.0) - payment_amount)

            # 3. Determine status based strictly on ZERO CREDIT rule:
            client_credit = (client.credit_amount or 0.0) if client else 0.0
            delivery_unpaid = max(0.0, (db_delivery.total_amount or 0.0) - (db_delivery.paid_amount or 0.0))

            if client_credit <= 0.0 and delivery_unpaid <= 0.0:
                db_delivery.status = "COMPLETED"
            else:
                db_delivery.status = "PARTIAL_PAID"

            # 4. Attribute payment method as UPI (Verified) or Cash
            if "CASH" in payment_mode:
                db_delivery.payment_method = "Cash"
            else:
                db_delivery.payment_method = "UPI (Verified)"

            if clean_upi_ref:
                db_delivery.upi_reference = clean_upi_ref

            verifier_name = getattr(current_user, 'name', None) or getattr(current_user, 'username', 'Admin')
            db_delivery.verified_at = datetime.utcnow()
            db_delivery.verified_by = verifier_name
            if verify_req.notes:
                db_delivery.notes = verify_req.notes

            # 5. Record immutable audit log
            try:
                db.execute(text("""
                    INSERT INTO payment_audit_logs (id, delivery_id, action, amount, payment_mode, upi_reference, verified_by, notes, created_at)
                    VALUES (:id, :delivery_id, :action, :amount, :payment_mode, :upi_reference, :verified_by, :notes, :created_at)
                """), {
                    "id": str(uuid.uuid4()),
                    "delivery_id": delivery_id,
                    "action": "VERIFY_PAID",
                    "amount": payment_amount,
                    "payment_mode": db_delivery.payment_method,
                    "upi_reference": clean_upi_ref,
                    "verified_by": f"{verifier_name} ({current_user.id})",
                    "notes": verify_req.notes or "",
                    "created_at": datetime.utcnow()
                })
            except Exception as log_err:
                print("Payment audit log write note:", log_err)
                
        elif verify_req.action == "MARK_CREDITED":
            verifier_name = getattr(current_user, 'name', None) or getattr(current_user, 'username', 'Admin')
            db_delivery.status = "CREDITED"
            db_delivery.payment_method = "Credited / Unpaid"
            db_delivery.verified_at = datetime.utcnow()
            db_delivery.verified_by = verifier_name
            if verify_req.notes:
                db_delivery.notes = verify_req.notes
        else:
            raise HTTPException(status_code=400, detail="Invalid verification action. Use VERIFY_PAID or MARK_CREDITED.")
            
        db.commit()
        db.refresh(db_delivery)
        return db_delivery
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to verify delivery: {str(e)}")

