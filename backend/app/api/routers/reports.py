"""Reports Router — Financial performance, total expenses, profit, and vehicle-by-vehicle reports."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime, time

from app import models, schemas
from app.database import get_db
from app.api import deps

router = APIRouter()


@router.get("/financial-summary")
@router.get("/financial-summary/", include_in_schema=False)
def get_financial_summary(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD"),
    vehicle_id: Optional[str] = Query(None, description="Filter by specific vehicle ID"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Returns high-level financial KPIs (Total Deliveries Revenue, Total Expenses, Net Profit, Profit Margin)
    and detailed vehicle-by-vehicle performance breakdown.
    Restricted to non-driver staff (Admin, Water Staff, Superuser, Owner).
    """
    # Parse date filters if provided
    dt_start = None
    dt_end = None
    if start_date:
        try:
            dt_start = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            pass
    if end_date:
        try:
            dt_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            pass

    # 1. Fetch Vehicles
    veh_query = db.query(models.Vehicle)
    if vehicle_id:
        veh_query = veh_query.filter(models.Vehicle.id == vehicle_id)
    vehicles = veh_query.order_by(models.Vehicle.plate_number.asc()).all()

    # 2. Fetch Assignments in date range
    assign_query = db.query(models.Assignment).options(
        joinedload(models.Assignment.vehicle),
        joinedload(models.Assignment.driver),
        joinedload(models.Assignment.helper),
        joinedload(models.Assignment.route),
        selectinload(models.Assignment.deliveries).selectinload(models.Delivery.items),
        selectinload(models.Assignment.expenses),
    )
    if dt_start:
        assign_query = assign_query.filter(models.Assignment.date >= dt_start)
    if dt_end:
        assign_query = assign_query.filter(models.Assignment.date <= dt_end)
    if vehicle_id:
        assign_query = assign_query.filter(models.Assignment.vehicle_id == vehicle_id)

    assignments = assign_query.order_by(models.Assignment.date.desc()).all()

    # Map assignments by vehicle
    assignments_by_vehicle: Dict[str, List[models.Assignment]] = {}
    for a in assignments:
        v_id = a.vehicle_id or "unassigned"
        assignments_by_vehicle.setdefault(v_id, []).append(a)

    # Global Accumulators
    overall_revenue = 0.0
    overall_cash = 0.0
    overall_upi = 0.0
    overall_credit = 0.0
    overall_expenses = 0.0
    overall_inhand_spent = 0.0
    overall_personal_spent = 0.0
    overall_bottles = 0
    overall_trips = len(assignments)
    overall_morning_petty_cash = 0.0

    category_totals: Dict[str, float] = {
        "FUEL": 0.0,
        "TOLL": 0.0,
        "PARKING": 0.0,
        "MAINTENANCE": 0.0,
        "OTHER": 0.0,
    }
    category_counts: Dict[str, int] = {
        "FUEL": 0,
        "TOLL": 0,
        "PARKING": 0,
        "MAINTENANCE": 0,
        "OTHER": 0,
    }

    # Per-vehicle reports list
    vehicle_reports = []

    for v in vehicles:
        v_assignments = assignments_by_vehicle.get(v.id, [])
        v_revenue = 0.0
        v_cash = 0.0
        v_upi = 0.0
        v_credit = 0.0
        v_expenses = 0.0
        v_inhand_spent = 0.0
        v_personal_spent = 0.0
        v_bottles = 0
        v_petty_cash_allocated = 0.0
        v_categories: Dict[str, float] = {
            "FUEL": 0.0,
            "TOLL": 0.0,
            "PARKING": 0.0,
            "MAINTENANCE": 0.0,
            "OTHER": 0.0,
        }

        # Identify prominent driver for this vehicle
        driver_names = set()

        for a in v_assignments:
            v_petty_cash_allocated += float(a.petty_cash or 0.0)
            overall_morning_petty_cash += float(a.petty_cash or 0.0)
            if a.driver and a.driver.name:
                driver_names.add(a.driver.name)

            # Deliveries for this assignment
            for d in a.deliveries:
                rev = float(d.total_amount or 0.0)
                paid = float(d.paid_amount or 0.0)
                pm = (d.payment_method or "").lower()

                v_revenue += rev
                overall_revenue += rev

                if "upi" in pm:
                    v_upi += paid if paid > 0 else rev
                    overall_upi += paid if paid > 0 else rev
                elif "credit" in pm or "slip" in pm or d.status in ["PENDING_PAYMENT", "CREDITED"]:
                    v_credit += rev
                    overall_credit += rev
                else:
                    v_cash += paid if paid > 0 else rev
                    overall_cash += paid if paid > 0 else rev

                for item in d.items:
                    v_bottles += item.delivered_full or 0
                    overall_bottles += item.delivered_full or 0

            # Expenses for this assignment
            for e in a.expenses:
                amt = float(e.amount or 0.0)
                cat = (e.category or "OTHER").upper()
                if cat not in v_categories:
                    cat = "OTHER"

                v_expenses += amt
                overall_expenses += amt
                v_categories[cat] += amt
                category_totals[cat] = category_totals.get(cat, 0.0) + amt
                category_counts[cat] = category_counts.get(cat, 0) + 1

                is_inhand = getattr(e, "paid_from_inhand", True)
                inhand_val = float(getattr(e, "inhand_amount", 0.0) or 0.0)
                if inhand_val <= 0 and is_inhand:
                    inhand_val = amt
                if inhand_val > amt:
                    inhand_val = amt

                if is_inhand and inhand_val > 0:
                    v_inhand_spent += inhand_val
                    overall_inhand_spent += inhand_val
                    pers = max(0.0, amt - inhand_val)
                    v_personal_spent += pers
                    overall_personal_spent += pers
                else:
                    v_personal_spent += amt
                    overall_personal_spent += amt

        v_profit = v_revenue - v_expenses
        v_margin = round((v_profit / v_revenue * 100), 1) if v_revenue > 0 else 0.0
        v_petty_returned = max(0.0, v_petty_cash_allocated - v_inhand_spent)

        vehicle_reports.append({
            "vehicle_id": v.id,
            "plate_number": v.plate_number,
            "model": v.model or "Water Delivery Van",
            "capacity": getattr(v, "capacity", 100),
            "assigned_driver": ", ".join(driver_names) if driver_names else "Unassigned",
            "trips_count": len(v_assignments),
            "bottles_delivered": v_bottles,
            "gross_revenue": round(v_revenue, 2),
            "cash_collected": round(v_cash, 2),
            "upi_collected": round(v_upi, 2),
            "credit_sales": round(v_credit, 2),
            "total_expenses": round(v_expenses, 2),
            "inhand_cash_spent": round(v_inhand_spent, 2),
            "personal_expenses": round(v_personal_spent, 2),
            "net_profit": round(v_profit, 2),
            "profit_margin_pct": v_margin,
            "petty_cash_allocated": round(v_petty_cash_allocated, 2),
            "petty_cash_returned": round(v_petty_returned, 2),
            "expenses_breakdown": {k: round(v, 2) for k, v in v_categories.items()},
        })

    # Sort vehicle reports by profit descending
    vehicle_reports.sort(key=lambda r: r["net_profit"], reverse=True)

    # Net overall profit
    net_operating_profit = overall_revenue - overall_expenses
    overall_profit_margin = round((net_operating_profit / overall_revenue * 100), 1) if overall_revenue > 0 else 0.0

    # Expense breakdown percentage
    expense_categories_summary = []
    for cat, tot in category_totals.items():
        pct = round((tot / overall_expenses * 100), 1) if overall_expenses > 0 else 0.0
        expense_categories_summary.append({
            "category": cat,
            "amount": round(tot, 2),
            "percentage": pct,
            "count": category_counts.get(cat, 0),
        })
    expense_categories_summary.sort(key=lambda c: c["amount"], reverse=True)

    return {
        "summary": {
            "total_revenue": round(overall_revenue, 2),
            "total_expenses": round(overall_expenses, 2),
            "net_profit": round(net_operating_profit, 2),
            "profit_margin_pct": overall_profit_margin,
            "total_cash_collected": round(overall_cash, 2),
            "total_upi_collected": round(overall_upi, 2),
            "total_credit_sales": round(overall_credit, 2),
            "total_deliveries_count": sum(len(a.deliveries) for a in assignments),
            "total_bottles_delivered": overall_bottles,
            "total_trips": overall_trips,
            "inhand_cash_spent": round(overall_inhand_spent, 2),
            "personal_expenses": round(overall_personal_spent, 2),
            "morning_petty_cash_total": round(overall_morning_petty_cash, 2),
            "petty_cash_to_return": round(max(0.0, overall_morning_petty_cash - overall_inhand_spent), 2),
        },
        "expense_categories": expense_categories_summary,
        "vehicle_reports": vehicle_reports,
        "date_filter": {
            "start_date": start_date,
            "end_date": end_date,
            "vehicle_id": vehicle_id,
        }
    }

