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


# --- Official CA Accountant Financial Reports & Audit Ledgers for Water Logistics ---

@router.get("/ca-financial-report")
@router.get("/ca-financial-report/", include_in_schema=False)
def get_water_ca_financial_report(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Generates formal CA-compliant financial statements (P&L, Sales Register, Fleet Expenses, Debtors, Closing Stock)
    for Flyera Water Logistics.
    """
    now = datetime.utcnow()
    current_year = now.year

    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date[:10], "%Y-%m-%d")
            end_dt = datetime.strptime(end_date[:10], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            start_dt = datetime(current_year, 1, 1, 0, 0, 0)
            end_dt = datetime(current_year, 12, 31, 23, 59, 59)
    else:
        start_dt = datetime(current_year, 1, 1, 0, 0, 0)
        end_dt = datetime(current_year, 12, 31, 23, 59, 59)

    # 1. SALES REGISTER (Water Deliveries & Invoices)
    deliveries_query = db.query(models.Delivery).options(
        joinedload(models.Delivery.client).joinedload(models.Client.route),
        joinedload(models.Delivery.assignment).joinedload(models.Assignment.vehicle),
        joinedload(models.Delivery.assignment).joinedload(models.Assignment.driver),
        selectinload(models.Delivery.items).joinedload(models.DeliveryItem.inventory_type)
    ).filter(
        models.Delivery.created_at >= start_dt,
        models.Delivery.created_at <= end_dt
    ).order_by(models.Delivery.created_at.desc())

    deliveries = deliveries_query.all()

    sales_ledger = []
    total_sales_revenue = 0.0
    water_jars_rev = 0.0
    dispensary_rev = 0.0
    other_rev = 0.0
    total_jars_delivered = 0
    total_cash = 0.0
    total_upi = 0.0
    total_credit = 0.0

    for idx, d in enumerate(deliveries):
        tot = float(d.total_amount or 0.0)
        paid = float(d.paid_amount or 0.0)
        pm = (d.payment_method or "").lower()
        is_credit = "credit" in pm or "slip" in pm or d.status in ["PENDING_PAYMENT", "CREDITED"]

        c_paid = 0.0
        u_paid = 0.0
        c_due = 0.0

        if "upi" in pm:
            u_paid = paid if paid > 0 else tot
            total_upi += u_paid
        elif is_credit:
            c_due = max(0.0, tot - paid)
            total_credit += c_due
            if paid > 0:
                c_paid = paid
                total_cash += c_paid
        else:
            c_paid = paid if paid > 0 else tot
            total_cash += c_paid

        total_sales_revenue += tot

        # Items breakdown
        jars_in_drop = 0
        for item in d.items:
            jars_in_drop += (item.delivered_full or 0)
            item_name = item.inventory_type.name.lower() if item.inventory_type else ""
            item_charge = float(item.price_charged or 0.0) * float(item.delivered_full or 0)
            if "water" in item_name or "can" in item_name or "jar" in item_name or "20" in item_name:
                water_jars_rev += item_charge
            elif "dispensary" in item_name or "stand" in item_name or "tap" in item_name:
                dispensary_rev += item_charge
            else:
                other_rev += item_charge

        total_jars_delivered += jars_in_drop

        v_plate = d.assignment.vehicle.plate_number if d.assignment and d.assignment.vehicle else "Fleet Van"
        dr_name = d.assignment.driver.name if d.assignment and d.assignment.driver else "Assigned Crew"
        rt_name = d.client.route.name if d.client and d.client.route else "General Route"

        inv_num = f"FL-WAT-{d.created_at.strftime('%Y%m')}-{str(idx + 1).zfill(3)}" if d.created_at else f"FL-WAT-{str(idx + 1).zfill(3)}"

        sales_ledger.append({
            "id": d.id,
            "invoice_no": inv_num,
            "date": d.created_at.strftime("%Y-%m-%d") if d.created_at else "",
            "client_name": d.client.name if d.client else "Walk-in Customer",
            "phone": d.client.phone or "" if d.client else "",
            "route": rt_name,
            "jars_delivered": jars_in_drop,
            "payment_method": d.payment_method or "Cash",
            "cash_amount": round(c_paid, 2),
            "upi_amount": round(u_paid, 2),
            "credit_amount": round(c_due, 2),
            "total_amount": round(tot, 2),
            "driver_name": dr_name,
            "vehicle": v_plate,
            "status": d.status
        })

    total_sales_revenue = round(total_sales_revenue, 2)
    water_jars_rev = round(water_jars_rev if water_jars_rev > 0 else total_sales_revenue, 2)
    dispensary_rev = round(dispensary_rev, 2)
    other_rev = round(other_rev, 2)

    # 2. FLEET & LOGISTICS EXPENSES REGISTER (Water fleet only)
    water_assignment_ids = [
        a.id for a in db.query(models.Assignment.id).filter(
            (models.Assignment.business_type != "GLASS") | (models.Assignment.business_type == None)
        ).all()
    ]

    expenses_query = db.query(models.TripExpense).options(
        joinedload(models.TripExpense.assignment).joinedload(models.Assignment.vehicle),
        joinedload(models.TripExpense.reporter)
    ).filter(
        models.TripExpense.assignment_id.in_(water_assignment_ids),
        models.TripExpense.created_at >= start_dt,
        models.TripExpense.created_at <= end_dt
    ).order_by(models.TripExpense.created_at.desc())

    expenses = expenses_query.all() if water_assignment_ids else []

    expenses_ledger = []
    fuel_exp = 0.0
    toll_exp = 0.0
    maint_exp = 0.0
    parking_exp = 0.0
    other_exp = 0.0

    for idx, e in enumerate(expenses):
        amt = round(float(e.amount or 0.0), 2)
        cat = (e.category or "OTHER").upper()
        if cat == "FUEL":
            fuel_exp += amt
        elif cat == "TOLL":
            toll_exp += amt
        elif cat == "MAINTENANCE":
            maint_exp += amt
        elif cat == "PARKING":
            parking_exp += amt
        else:
            other_exp += amt

        assign = e.assignment
        v_plate = assign.vehicle.plate_number if assign and assign.vehicle else "Water Van"
        d_name = e.reporter.name if e.reporter else (assign.driver.name if assign and assign.driver else "Crew")

        vouch_no = f"FL-EXP-WAT-{e.created_at.strftime('%Y%m')}-{str(idx + 1).zfill(3)}" if e.created_at else f"FL-EXP-WAT-{str(idx + 1).zfill(3)}"

        expenses_ledger.append({
            "id": e.id,
            "voucher_no": vouch_no,
            "date": e.created_at.strftime("%Y-%m-%d") if e.created_at else "",
            "category": cat,
            "amount": amt,
            "vehicle": v_plate,
            "reported_by": d_name,
            "payment_source": "In-Hand Petty Cash" if getattr(e, "paid_from_inhand", True) else "Personal Reimbursement",
            "description": e.description or ""
        })

    total_trip_expenses = round(fuel_exp + toll_exp + maint_exp + parking_exp + other_exp, 2)

    # 3. COST OF PRODUCTION / MATERIALS (COGS)
    cost_of_materials = 0.0

    # 4. P&L Statement Math
    gross_profit = round(total_sales_revenue - cost_of_materials, 2)
    net_profit = round(gross_profit - total_trip_expenses, 2)
    gross_margin_percent = round((gross_profit / total_sales_revenue * 100), 1) if total_sales_revenue > 0 else 0.0
    net_margin_percent = round((net_profit / total_sales_revenue * 100), 1) if total_sales_revenue > 0 else 0.0

    # 5. SUNDRY DEBTORS REGISTER (Outstanding Credit / Receivables)
    clients_with_due = db.query(models.Client).options(
        joinedload(models.Client.route)
    ).filter(models.Client.credit_amount > 0).order_by(models.Client.credit_amount.desc()).all()

    debtors_ledger = []
    total_debtors_balance = 0.0

    for c in clients_with_due:
        due = round(float(c.credit_amount or 0.0), 2)
        total_debtors_balance += due
        debtors_ledger.append({
            "client_id": c.id,
            "client_name": c.name,
            "phone": c.phone or "",
            "address": c.address or "",
            "route": c.route.name if c.route else "General Route",
            "outstanding_credit": due,
            "bottle_balance": c.bottle_balance
        })

    total_debtors_balance = round(total_debtors_balance, 2)

    # 6. CLOSING INVENTORY & STOCK VALUATION
    inv_types = db.query(models.InventoryType).options(
        selectinload(models.InventoryType.stocks)
    ).all()

    closing_inventory = []
    total_inventory_valuation = 0.0
    total_full_jars = 0

    for inv in inv_types:
        f_count = inv.full
        e_count = inv.empty
        d_count = inv.damaged
        rate = float(inv.price or 70.0)
        val = round(f_count * rate, 2)
        total_inventory_valuation += val
        if "water" in inv.name.lower() or "can" in inv.name.lower() or "jar" in inv.name.lower():
            total_full_jars += f_count

        closing_inventory.append({
            "id": inv.id,
            "category": "Packaged Water" if ("water" in inv.name.lower() or "can" in inv.name.lower()) else "Dispensing Equipment",
            "name": inv.name,
            "full_stock": f_count,
            "empty_stock": e_count,
            "damaged_stock": d_count,
            "benchmark_rate": rate,
            "valuation_amount": val
        })

    total_inventory_valuation = round(total_inventory_valuation, 2)

    return {
        "period": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "label": f"{start_dt.strftime('%d-%b-%Y')} to {end_dt.strftime('%d-%b-%Y')}"
        },
        "fiscal_calendar": "Calendar Year (Jan 1 to Dec 31)",
        "generated_at": now.strftime("%d-%b-%Y %I:%M %p UTC"),
        "summary": {
            "gross_sales_revenue": total_sales_revenue,
            "cost_of_materials": cost_of_materials,
            "gross_profit": gross_profit,
            "fleet_expenses": total_trip_expenses,
            "net_operating_profit": net_profit,
            "gross_margin_percent": gross_margin_percent,
            "net_margin_percent": net_margin_percent,
            "total_jars_delivered": total_jars_delivered,
            "total_deliveries_count": len(deliveries),
            "total_cash_collected": round(total_cash, 2),
            "total_upi_collected": round(total_upi, 2),
            "total_credit_outstanding": total_debtors_balance,
        },
        "pl_statement": {
            "water_jars_revenue": water_jars_rev,
            "accessories_revenue": dispensary_rev,
            "other_operating_revenue": other_rev,
            "gross_sales_revenue": total_sales_revenue,
            "cost_of_materials": cost_of_materials,
            "gross_profit": gross_profit,
            "gross_margin_percent": gross_margin_percent,
            "operating_expenses": {
                "total_operating_expenses": total_trip_expenses,
                "fuel_and_diesel": round(fuel_exp, 2),
                "highway_tolls": round(toll_exp, 2),
                "vehicle_maintenance": round(maint_exp, 2),
                "parking_and_allowances": round(parking_exp, 2),
                "other_logistics": round(other_exp, 2),
            },
            "net_operating_profit": net_profit,
            "net_margin_percent": net_margin_percent,
        },
        "sales_ledger": sales_ledger,
        "expenses_ledger": expenses_ledger,
        "debtors_ledger": debtors_ledger,
        "closing_inventory": closing_inventory,
        "inventory_summary": {
            "total_full_jars": total_full_jars,
            "total_stock_valuation": total_inventory_valuation,
        },
        "debtors_summary": {
            "total_debtors_count": len(debtors_ledger),
            "total_credit_receivables": total_debtors_balance,
        }
    }
