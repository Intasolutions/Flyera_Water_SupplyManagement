from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import case, or_
from sqlalchemy.orm import Session, selectinload
from typing import Dict, List, Optional

from app import crud, schemas, models
from app.core.timeutils import parse_day, local_day_bounds, utcnow
from app.database import get_db
from app.api import deps

router = APIRouter()

water_office = deps.require_roles(deps.WATER_OFFICE)
water_users = deps.require_roles(deps.WATER_ALL)

# Drivers only need current work and their recent history.
DRIVER_HISTORY_DAYS = 30


def _get_water_assignment(db: Session, assignment_id: str) -> models.Assignment:
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        or_(models.Assignment.business_type == "WATER", models.Assignment.business_type.is_(None)),
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


def _validate_links(db: Session, vehicle_id=None, driver_id=None, helper_id=None, route_id=None) -> None:
    if vehicle_id and not db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first():
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if route_id and not db.query(models.Route).filter(models.Route.id == route_id).first():
        raise HTTPException(status_code=404, detail="Route not found")
    for label, user_id in (("Driver", driver_id), ("Helper", helper_id)):
        if not user_id:
            continue
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        if user.is_active is False:
            raise HTTPException(status_code=400, detail=f"{label} {user.name} is deactivated.")


def _adjust_full_stock(db: Session, inv_type_id: str, add_full: int) -> None:
    try:
        result = crud.adjust_inventory_stock(
            db,
            inv_type_id=inv_type_id,
            stock_adj=schemas.StockAdjust(add_full=add_full),
            commit=False,
        )
    except crud.InsufficientStockError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error))
    if result is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="Inventory type not found")


def _delivered_counts(assignment: models.Assignment):
    delivered: Dict[str, int] = {}
    empties: Dict[str, int] = {}
    for delivery in assignment.deliveries:
        for item in delivery.items:
            delivered[item.inventory_type_id] = delivered.get(item.inventory_type_id, 0) + (item.delivered_full or 0)
            empties[item.inventory_type_id] = empties.get(item.inventory_type_id, 0) + (item.collected_empty or 0)
    return delivered, empties


@router.post("", response_model=schemas.AssignmentResponse, include_in_schema=False)
@router.post("/", response_model=schemas.AssignmentResponse)
def create_assignment(
    assignment: schemas.AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_office),
):
    _validate_links(db, assignment.vehicle_id, assignment.driver_id, assignment.helper_id, assignment.route_id)
    if assignment.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="A new route must start as PENDING or ACTIVE.")

    db_assignment = models.Assignment(
        date=assignment.date,
        vehicle_id=assignment.vehicle_id,
        driver_id=assignment.driver_id,
        helper_id=assignment.helper_id,
        route_id=assignment.route_id,
        status=assignment.status,
        business_type="WATER",
        petty_cash=assignment.petty_cash or 0.0
    )
    db.add(db_assignment)
    db.flush()

    # Load the van from the warehouse. Everything saves together, or nothing does.
    for alloc in assignment.allocations:
        db.add(models.Allocation(
            assignment_id=db_assignment.id,
            inventory_type_id=alloc.inventory_type_id,
            allocated_count=alloc.allocated_count
        ))
        _adjust_full_stock(db, alloc.inventory_type_id, -alloc.allocated_count)

    db.commit()
    db.refresh(db_assignment)
    return db_assignment


@router.get("", response_model=List[schemas.AssignmentResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.AssignmentResponse])
def get_assignments(
    skip: int = 0,
    limit: Optional[int] = Query(None, ge=1),
    since: Optional[str] = Query(None, description="Only routes from this YYYY-MM-DD onward, plus any still open"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    status_order = case(
        (models.Assignment.status == "ACTIVE", 0),
        (models.Assignment.status == "PENDING", 1),
        else_=2
    )
    query = (
        db.query(models.Assignment)
        .options(
            selectinload(models.Assignment.allocations),
            selectinload(models.Assignment.deliveries).selectinload(models.Delivery.items),
            selectinload(models.Assignment.expenses),
        )
        .filter(or_(models.Assignment.business_type == "WATER", models.Assignment.business_type.is_(None)))
    )

    since_at: Optional[datetime] = None
    since_day = parse_day(since)
    if since_day:
        since_at = local_day_bounds(since_day)[0]

    if current_user.role in deps.WATER_FIELD:
        query = query.filter(or_(
            models.Assignment.driver_id == current_user.id,
            models.Assignment.helper_id == current_user.id,
        ))
        since_at = utcnow() - timedelta(days=DRIVER_HISTORY_DAYS)

    if since_at:
        query = query.filter(or_(
            models.Assignment.date >= since_at,
            models.Assignment.status.in_(["ACTIVE", "PENDING"]),
        ))

    query = query.order_by(status_order, models.Assignment.created_at.asc()).offset(skip)
    if limit:
        query = query.limit(limit)
    return query.all()


@router.get("/{assignment_id}", response_model=schemas.AssignmentResponse)
def get_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    db_assignment = _get_water_assignment(db, assignment_id)
    deps.ensure_assignment_access(current_user, db_assignment)
    return db_assignment


@router.put("/{assignment_id}", response_model=schemas.AssignmentResponse)
def update_assignment(
    assignment_id: str,
    assignment_in: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_office),
):
    db_assignment = _get_water_assignment(db, assignment_id)

    is_completed = db_assignment.status == "COMPLETED"
    if assignment_in.status is not None and assignment_in.status != db_assignment.status:
        if "COMPLETED" in (assignment_in.status, db_assignment.status):
            raise HTTPException(
                status_code=400,
                detail="Use End Route or Reopen Route to change a completed status, so stock stays correct.",
            )

    _validate_links(
        db,
        assignment_in.vehicle_id,
        assignment_in.driver_id,
        assignment_in.helper_id or None,
        assignment_in.route_id,
    )

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
    if assignment_in.petty_cash is not None:
        db_assignment.petty_cash = assignment_in.petty_cash

    if assignment_in.allocations is not None:
        current = {alloc.inventory_type_id: alloc for alloc in db_assignment.allocations}
        wanted = {alloc.inventory_type_id: alloc.allocated_count for alloc in assignment_in.allocations}
        changed = any(
            wanted.get(type_id, 0) != (current[type_id].allocated_count if type_id in current else 0)
            for type_id in set(current) | set(wanted)
        )
        if changed and is_completed:
            db.rollback()
            raise HTTPException(status_code=400, detail="Reopen this route before changing its loaded stock.")

        delivered, _ = _delivered_counts(db_assignment)
        for type_id in set(current) | set(wanted):
            new_count = wanted.get(type_id, 0)
            old_count = current[type_id].allocated_count if type_id in current else 0
            if new_count < delivered.get(type_id, 0):
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"{delivered[type_id]} jars of this product are already delivered, so the van cannot hold fewer.",
                )
            if new_count == old_count:
                continue
            # Only the difference moves between warehouse and van.
            _adjust_full_stock(db, type_id, old_count - new_count)
            if type_id not in current:
                db.add(models.Allocation(assignment_id=db_assignment.id, inventory_type_id=type_id, allocated_count=new_count))
            elif new_count == 0:
                db.delete(current[type_id])
            else:
                current[type_id].allocated_count = new_count

    db.commit()
    db.refresh(db_assignment)
    return db_assignment


@router.put("/{assignment_id}/complete", response_model=schemas.AssignmentResponse)
def complete_assignment(
    assignment_id: str,
    returned_stock: List[schemas.AllocationReturn] = Body(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    """Ends a route. Returned jars are worked out per product from its deliveries unless counts are supplied."""
    db_assignment = _get_water_assignment(db, assignment_id)
    deps.ensure_assignment_access(current_user, db_assignment)

    if db_assignment.status == "COMPLETED":
        # Assignment is already completed; return it gracefully without throwing an error
        return db_assignment

    delivered, empties = _delivered_counts(db_assignment)
    allocations = {alloc.inventory_type_id: alloc for alloc in db_assignment.allocations}
    counted = {item.inventory_type_id: item for item in returned_stock}

    for type_id in set(allocations) | set(empties) | set(counted):
        alloc = allocations.get(type_id)
        if alloc is None:
            # Empties of a product that was not on the van still need a record, so Reopen can undo them.
            alloc = models.Allocation(assignment_id=db_assignment.id, inventory_type_id=type_id, allocated_count=0)
            db.add(alloc)

        expected_full = max(0, (alloc.allocated_count or 0) - delivered.get(type_id, 0))
        count = counted.get(type_id)
        returned_full = count.returned_full if count else expected_full
        returned_empty = count.returned_empty if count else empties.get(type_id, 0)
        if returned_full > expected_full:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Only {expected_full} full jars can come back for this product.")

        alloc.returned_full = returned_full
        alloc.returned_empty = returned_empty
        if crud.adjust_inventory_stock(
            db,
            inv_type_id=type_id,
            stock_adj=schemas.StockAdjust(add_full=returned_full, add_empty=returned_empty),
            commit=False,
        ) is None:
            db.rollback()
            raise HTTPException(status_code=404, detail="Inventory type not found")

    db_assignment.status = "COMPLETED"
    db.commit()
    db.refresh(db_assignment)
    return db_assignment


@router.put("/{assignment_id}/reopen", response_model=schemas.AssignmentResponse)
def reopen_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_users),
):
    db_assignment = _get_water_assignment(db, assignment_id)
    deps.ensure_assignment_access(current_user, db_assignment)

    if db_assignment.status != "COMPLETED":
        # Already active or pending, return as is
        return db_assignment

    # Revert warehouse stock additions that were credited during completion
    try:
        for alloc in db_assignment.allocations:
            returned_full = alloc.returned_full or 0
            returned_empty = alloc.returned_empty or 0
            if returned_full > 0 or returned_empty > 0:
                crud.adjust_inventory_stock(
                    db,
                    inv_type_id=alloc.inventory_type_id,
                    stock_adj=schemas.StockAdjust(add_full=-returned_full, add_empty=-returned_empty),
                    commit=False,
                )
            alloc.returned_full = 0
            alloc.returned_empty = 0
    except crud.InsufficientStockError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Cannot reopen: the returned stock is already in use. {error}")

    db_assignment.status = "ACTIVE"
    db.commit()
    db.refresh(db_assignment)
    return db_assignment


@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(water_office),
):
    db_assignment = _get_water_assignment(db, assignment_id)

    if db_assignment.deliveries or db_assignment.expenses:
        raise HTTPException(
            status_code=400,
            detail="This route has delivery or expense records. Undo or delete those first, so sales history is not lost.",
        )

    # Completed routes have already returned their stock to the warehouse.
    if db_assignment.status != "COMPLETED":
        for alloc in db_assignment.allocations:
            _adjust_full_stock(db, alloc.inventory_type_id, alloc.allocated_count or 0)

    # Keep ledger history if a reversed delivery left entries pointing at this route.
    db.query(models.BottleCreditLedger).filter(
        models.BottleCreditLedger.assignment_id == assignment_id
    ).update({models.BottleCreditLedger.assignment_id: None})

    db.delete(db_assignment)
    db.commit()
    return {"message": "Assignment deleted successfully"}
