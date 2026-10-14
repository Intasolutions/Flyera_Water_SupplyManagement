"""Trip Expenses Router — log per-trip driver/helper expenses."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app import models, schemas
from app.database import get_db
from app.api import deps

router = APIRouter()


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
    if expense_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

    expense = models.TripExpense(
        assignment_id=expense_in.assignment_id,
        reported_by=current_user.id,
        category=expense_in.category.upper(),
        amount=float(expense_in.amount),
        description=expense_in.description,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    return schemas.TripExpenseResponse(
        id=expense.id,
        assignment_id=expense.assignment_id,
        reported_by=expense.reported_by,
        reporter_name=current_user.name,
        category=expense.category,
        amount=expense.amount,
        description=expense.description,
        created_at=expense.created_at,
    )


@router.get("", response_model=List[schemas.TripExpenseResponse])
@router.get("/", response_model=List[schemas.TripExpenseResponse])
def get_all_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    assignment_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """Get all trip expenses (admin view, optional date/assignment filter)."""
    from datetime import datetime
    query = db.query(models.TripExpense)
    if assignment_id:
        query = query.filter(models.TripExpense.assignment_id == assignment_id)
    if start_date:
        try:
            query = query.filter(models.TripExpense.created_at >= datetime.fromisoformat(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            query = query.filter(models.TripExpense.created_at <= datetime.fromisoformat(end_date))
        except ValueError:
            pass
    expenses = query.order_by(models.TripExpense.created_at.desc()).all()
    result = []
    for e in expenses:
        reporter = db.query(models.User).filter(models.User.id == e.reported_by).first() if e.reported_by else None
        result.append(schemas.TripExpenseResponse(
            id=e.id,
            assignment_id=e.assignment_id,
            reported_by=e.reported_by,
            reporter_name=reporter.name if reporter else None,
            category=e.category,
            amount=e.amount,
            description=e.description,
            created_at=e.created_at,
        ))
    return result


@router.get("/assignment/{assignment_id}", response_model=List[schemas.TripExpenseResponse])
@router.get("/assignment/{assignment_id}/", response_model=List[schemas.TripExpenseResponse], include_in_schema=False)
def get_expenses_for_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """Get all expenses for a specific assignment."""
    expenses = (
        db.query(models.TripExpense)
        .filter(models.TripExpense.assignment_id == assignment_id)
        .order_by(models.TripExpense.created_at.asc())
        .all()
    )
    result = []
    for e in expenses:
        reporter = db.query(models.User).filter(models.User.id == e.reported_by).first() if e.reported_by else None
        result.append(schemas.TripExpenseResponse(
            id=e.id,
            assignment_id=e.assignment_id,
            reported_by=e.reported_by,
            reporter_name=reporter.name if reporter else None,
            category=e.category,
            amount=e.amount,
            description=e.description,
            created_at=e.created_at,
        ))
    return result


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
    if current_user.role not in ("ADMIN", "SUPERUSER") and expense.reported_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to delete this expense")
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}
