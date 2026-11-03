"""Trip Expenses Router — log per-trip driver/helper expenses."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app import models, schemas
from app.core.timeutils import local_range
from app.database import get_db
from app.api import deps

router = APIRouter()

EXPENSE_CATEGORIES = {"FUEL", "TOLL", "PARKING", "MAINTENANCE", "OTHER"}


def _to_response(expense: models.TripExpense) -> schemas.TripExpenseResponse:
    return schemas.TripExpenseResponse(
        id=expense.id,
        assignment_id=expense.assignment_id,
        reported_by=expense.reported_by,
        reporter_name=expense.reporter.name if expense.reporter else None,
        category=expense.category,
        amount=expense.amount,
        paid_from_inhand=bool(expense.paid_from_inhand),
        inhand_amount=expense.inhand_amount or 0.0,
        description=expense.description,
        created_at=expense.created_at,
    )


@router.post("", response_model=schemas.TripExpenseResponse, include_in_schema=False)
@router.post("/", response_model=schemas.TripExpenseResponse)
def create_expense(
    expense_in: schemas.TripExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """Log a new trip expense (driver or helper)."""
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == expense_in.assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    deps.ensure_assignment_access(current_user, assignment)

    category = expense_in.category.upper()
    if category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of: {', '.join(sorted(EXPENSE_CATEGORIES))}.")

    amount = round(float(expense_in.amount), 2)
    inhand_val = 0.0
    if expense_in.paid_from_inhand:
        inhand_val = min(amount, round(float(expense_in.inhand_amount), 2)) if expense_in.inhand_amount > 0 else amount

    expense = models.TripExpense(
        assignment_id=expense_in.assignment_id,
        reported_by=current_user.id,
        category=category,
        amount=amount,
        paid_from_inhand=expense_in.paid_from_inhand,
        inhand_amount=inhand_val,
        description=expense_in.description,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _to_response(expense)


@router.get("", response_model=List[schemas.TripExpenseResponse], include_in_schema=False)
@router.get("/", response_model=List[schemas.TripExpenseResponse])
def get_all_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    assignment_id: Optional[str] = None,
    business_type: str = "WATER",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.require_roles(deps.WATER_OFFICE + deps.GLASS_OFFICE)),
):
    """Office view of trip expenses for one business, with optional date and assignment filters."""
    office = deps.GLASS_OFFICE if business_type == "GLASS" else deps.WATER_OFFICE
    if not deps.is_admin(current_user) and current_user.role not in office:
        raise HTTPException(status_code=403, detail="You do not have permission to do this.")

    query = (
        db.query(models.TripExpense)
        .options(joinedload(models.TripExpense.reporter))
        .join(models.Assignment, models.TripExpense.assignment_id == models.Assignment.id)
    )
    if business_type == "GLASS":
        query = query.filter(models.Assignment.business_type == "GLASS")
    else:
        query = query.filter(or_(models.Assignment.business_type == "WATER", models.Assignment.business_type.is_(None)))
    if assignment_id:
        query = query.filter(models.TripExpense.assignment_id == assignment_id)
    start_at, end_at = local_range(start_date, end_date)
    if start_at:
        query = query.filter(models.TripExpense.created_at >= start_at)
    if end_at:
        query = query.filter(models.TripExpense.created_at <= end_at)
    return [_to_response(e) for e in query.order_by(models.TripExpense.created_at.desc()).all()]


@router.get("/assignment/{assignment_id}", response_model=List[schemas.TripExpenseResponse])
@router.get("/assignment/{assignment_id}/", response_model=List[schemas.TripExpenseResponse], include_in_schema=False)
def get_expenses_for_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """Get all expenses for a specific assignment."""
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    deps.ensure_assignment_access(current_user, assignment)

    expenses = (
        db.query(models.TripExpense)
        .options(joinedload(models.TripExpense.reporter))
        .filter(models.TripExpense.assignment_id == assignment_id)
        .order_by(models.TripExpense.created_at.asc())
        .all()
    )
    return [_to_response(e) for e in expenses]


@router.delete("/{expense_id}")
@router.delete("/{expense_id}/", include_in_schema=False)
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """Delete a trip expense (admin or reporter)."""
    expense = db.query(models.TripExpense).filter(models.TripExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if not deps.is_admin(current_user) and expense.reported_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to delete this expense")
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}
