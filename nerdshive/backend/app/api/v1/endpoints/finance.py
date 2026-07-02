from fastapi import APIRouter, Depends, Body, HTTPException, Query
from typing import Any, List, Optional, cast
from uuid import UUID
import uuid
from datetime import datetime, date, timedelta, timezone
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, text, Date

from app.api import deps
from app.models.user import AuthUser, Admin, Superuser, Finance, User
from app.models.company import Company, CompanyAdmin
from app.models.business import Plan, Checkin, Pricing, PricingPlan, Invoice, Refund, SeatRequest
from app.models.audit import ActivityLog, Notification
from app.schemas.user import FinanceResponse, FinanceCreate, FinanceUpdate
from app.schemas.invoice import InvoiceResponse, RefundResponse
from app.core.security import get_password_hash
from app.services.notification import notify_admins

class SeatPaymentVerification(BaseModel):
    payment_method: str
    transaction_reference: str
    verification_notes: Optional[str] = None


router = APIRouter()

def log_finance_action(db: Session, user: AuthUser, action: str, module: str, entity: Any = None, prev_val: Any = None, new_val: Any = None):
    # Retrieve user's name
    finance_profile = db.query(Finance).filter(Finance.auth_id == user.id).first()
    name = finance_profile.full_name if finance_profile else "System"
    
    log = ActivityLog(
        action=action,
        performed_by=user.id,
        performed_by_name=name,
        performed_by_role="FINANCE",
        details={
            "module": module,
            "entity": entity,
            "previous_value": prev_val,
            "new_value": new_val
        }
    )
    db.add(log)
    db.commit()

# ==========================================
# SUPERUSER ONLY: Manage Finance Accounts
# ==========================================

@router.post("/invite", response_model=FinanceResponse)
def invite_finance(
    invite_in: FinanceCreate,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Create a new Finance user (Superuser only)"""
    existing = db.query(AuthUser).filter(AuthUser.email == invite_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_auth = AuthUser(
        email=invite_in.email,
        hashed_password=get_password_hash(invite_in.password),
        is_active=True
    )
    db.add(new_auth)
    db.flush()
    
    new_finance = Finance(
        auth_id=new_auth.id,
        full_name=invite_in.full_name,
        mobile=invite_in.mobile,
        city=invite_in.city,
        location=invite_in.location,
        occupation=invite_in.occupation,
        status="active",
        permissions=invite_in.permissions or []
    )
    db.add(new_finance)
    db.commit()
    db.refresh(new_finance)
    
    # Notify superusers
    notify_admins(
        db=db,
        title="New Finance User Created",
        message=f"Superuser has created a new finance account for {invite_in.email}.",
        type="info"
    )
    
    return new_finance

@router.get("/", response_model=List[FinanceResponse])
def get_finance_users(
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
) -> Any:
    """List all finance accounts (Superuser only)"""
    skip = (page - 1) * limit
    return db.query(Finance).order_by(desc(Finance.created_at)).offset(skip).limit(limit).all()

@router.get("/me", response_model=FinanceResponse)
def read_finance_me(
    db: Session = Depends(deps.get_db),
    current_finance: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get the current logged in Finance user profile"""
    finance = db.query(Finance).filter(Finance.auth_id == current_finance.id).first()
    if not finance:
        raise HTTPException(status_code=404, detail="Finance profile not found")
    return finance

@router.put("/me", response_model=FinanceResponse)
def update_finance_me(
    update_in: FinanceUpdate,
    db: Session = Depends(deps.get_db),
    current_finance: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Update current finance profile"""
    finance = db.query(Finance).filter(Finance.auth_id == current_finance.id).first()
    if not finance:
        raise HTTPException(status_code=404, detail="Finance profile not found")
        
    if update_in.full_name is not None:
        finance.full_name = update_in.full_name
    if update_in.mobile is not None:
        finance.mobile = update_in.mobile
    if update_in.city is not None:
        finance.city = update_in.city
    if update_in.location is not None:
        finance.location = update_in.location
    if update_in.occupation is not None:
        finance.occupation = update_in.occupation
        
    db.commit()
    db.refresh(finance)
    return finance

@router.put("/{finance_id}", response_model=FinanceResponse)
def update_finance_user(
    finance_id: UUID,
    update_in: FinanceUpdate,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Update a specific finance user status, name, etc. (Superuser only)"""
    finance = db.query(Finance).filter(Finance.id == finance_id).first()
    if not finance:
        raise HTTPException(status_code=404, detail="Finance profile not found")
        
    if update_in.full_name is not None:
        finance.full_name = update_in.full_name
    if update_in.mobile is not None:
        finance.mobile = update_in.mobile
    if update_in.city is not None:
        finance.city = update_in.city
    if update_in.location is not None:
        finance.location = update_in.location
    if update_in.occupation is not None:
        finance.occupation = update_in.occupation
    if update_in.status is not None:
        finance.status = update_in.status
        auth_user = db.query(AuthUser).filter(AuthUser.id == finance.auth_id).first()
        if auth_user:
            auth_user.is_active = (update_in.status == "active")
            
    if update_in.permissions is not None:
        finance.permissions = update_in.permissions
        
    db.commit()
    db.refresh(finance)
    return finance

@router.post("/{finance_id}/reset-password")
def reset_finance_password(
    finance_id: UUID,
    password: str = Body(..., min_length=6),
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Reset a finance user password (Superuser only)"""
    finance = db.query(Finance).filter(Finance.id == finance_id).first()
    if not finance:
        raise HTTPException(status_code=404, detail="Finance user not found")
        
    auth_user = db.query(AuthUser).filter(AuthUser.id == finance.auth_id).first()
    if not auth_user:
        raise HTTPException(status_code=404, detail="Auth user not found")
        
    auth_user.hashed_password = get_password_hash(password)
    db.commit()
    return {"msg": "Password reset successfully"}

@router.delete("/{finance_id}")
def delete_finance_user(
    finance_id: UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Delete a finance user (Superuser only)"""
    finance = db.query(Finance).filter(Finance.id == finance_id).first()
    if not finance:
        raise HTTPException(status_code=404, detail="Finance profile not found")
        
    auth_user = db.query(AuthUser).filter(AuthUser.id == finance.auth_id).first()
    if auth_user:
        db.delete(auth_user)
        db.commit()
    return {"msg": "Finance profile removed successfully"}

# ==========================================
# FINANCE & SUPERUSER: Finance Dashboards & Billing
# ==========================================

@router.get("/dashboard")
def get_finance_dashboard(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get dashboard summary metrics and statistics"""
    today = date.today()
    start_of_month = date(today.year, today.month, 1)
    
    # 1. Today's Collections
    # Paid Corporate Invoices today
    paid_inv_today_corp = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.company_id != None,
        func.cast(Invoice.payment_date, Date) == today
    ).scalar() or 0.0
    
    # Paid Customer Invoices today
    paid_inv_today_cust = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.user_id != None,
        func.cast(Invoice.payment_date, Date) == today
    ).scalar() or 0.0
    
    todays_collections = float(paid_inv_today_corp) + float(paid_inv_today_cust)
    
    # 2. Monthly Revenue
    paid_inv_month_corp = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.company_id != None,
        func.cast(Invoice.payment_date, Date) >= start_of_month
    ).scalar() or 0.0
    
    paid_inv_month_cust = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.user_id != None,
        func.cast(Invoice.payment_date, Date) >= start_of_month
    ).scalar() or 0.0
    
    monthly_revenue = float(paid_inv_month_corp) + float(paid_inv_month_cust)
    
    # 3. Pending Payments count (unpaid invoices)
    unpaid_inv = db.query(Invoice).filter(Invoice.status == "unpaid", Invoice.invoice_status != "voided").count()
    pending_payments_count = unpaid_inv
    
    # 4. Overdue Invoices
    overdue_inv_count = db.query(Invoice).filter(
        Invoice.status == "unpaid",
        Invoice.invoice_status != "voided",
        Invoice.due_date < today
    ).count()
    
    # 5. Invoices Generated Today
    inv_generated_today = db.query(Invoice).filter(
        func.cast(Invoice.created_at, Date) == today,
        Invoice.invoice_status != "voided"
    ).count()
    
    # 6. Active Subscriptions
    active_companies = db.query(Company).filter(
        cast(Any, Company.subscription_status == "ACTIVE"),
        ~Company.company_name.like("% (Customer)"),
        ~Company.company_name.like("Customer %")
    ).count()
    active_customers = db.query(Plan).filter(
        Plan.is_active == True,
        Plan.payment_verified == True,
        Plan.start_date <= today,
        Plan.end_date >= today
    ).count()
    active_subscriptions = active_companies + active_customers
    
    # 7. Outstanding Amount
    outstanding_inv = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "unpaid",
        Invoice.invoice_status != "voided"
    ).scalar() or 0.0
    outstanding_amount = float(outstanding_inv)
    
    # 8. Upcoming Renewals (next 7 days)
    upcoming_renewals_count = db.query(Plan).filter(
        Plan.is_active == True,
        Plan.end_date >= today,
        Plan.end_date <= today + timedelta(days=7)
    ).count()

    # Recent Invoices
    recent_invoices_query = db.query(Invoice).filter(Invoice.invoice_status != "voided").order_by(desc(Invoice.created_at)).limit(5).all()
    recent_invoices = []
    for inv in recent_invoices_query:
        recent_invoices.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "company_name": inv.owner_name,
            "amount": float(cast(Any, inv.total_amount)),
            "status": inv.status,
            "invoice_date": inv.invoice_date.isoformat()
        })
        
    # Recent Payments
    recent_payments = []
    # Fetch recent paid invoices (both corporate and customer)
    recent_paid_inv = db.query(Invoice).filter(Invoice.status == "paid").order_by(desc(Invoice.payment_date)).limit(5).all()
    for inv in recent_paid_inv:
        recent_payments.append({
            "id": str(inv.id),
            "type": "corporate" if inv.company_id else "customer",
            "entity": inv.owner_name,
            "amount": float(cast(Any, inv.total_amount)),
            "method": "Bank Transfer" if inv.company_id else "UPI/Card",
            "date": inv.payment_date.isoformat() if inv.payment_date else inv.created_at.isoformat()
        })
    # Sort and limit to top 5
    recent_payments = sorted(recent_payments, key=lambda x: x["date"], reverse=True)[:5]
    
    # Recent Activity
    logs = db.query(ActivityLog).filter(ActivityLog.performed_by_role == "FINANCE").order_by(desc(ActivityLog.created_at)).limit(5).all()
    recent_activity = []
    for l in logs:
        recent_activity.append({
            "id": str(l.id),
            "user": l.performed_by_name,
            "action": l.action,
            "details": l.details,
            "timestamp": l.created_at.isoformat()
        })
        
    return {
        "metrics": {
            "todays_collections": todays_collections,
            "monthly_revenue": monthly_revenue,
            "pending_payments": pending_payments_count,
            "overdue_invoices": overdue_inv_count,
            "invoices_generated_today": inv_generated_today,
            "active_subscriptions": active_subscriptions,
            "upcoming_renewals": upcoming_renewals_count,
            "outstanding_amount": outstanding_amount
        },
        "recent_invoices": recent_invoices,
        "recent_payments": recent_payments,
        "recent_activity": recent_activity
    }

@router.get("/customers")
def get_finance_customers(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get all individual customers with their current active plan billing details"""
    from app.models.company import Company
    users = db.query(User).outerjoin(Company, User.company_id == Company.id).filter(
        (User.company_id.is_(None)) | 
        (Company.company_name.like("% (Customer)")) | 
        (Company.company_name.like("Customer %"))
    ).order_by(User.full_name).all()
    results = []
    today_val = date.today()
    for u in users:
        # Get active plan
        active_plan = db.query(Plan).filter(
            Plan.user_id == u.id,
            Plan.is_active == True,
            Plan.start_date <= today_val,
            Plan.end_date >= today_val
        ).order_by(desc(Plan.created_at)).first()
        # Outstanding amount
        unpaid_invoices = db.query(Invoice).filter(
            Invoice.user_id == u.id,
            Invoice.status == "unpaid",
            Invoice.invoice_status != "voided"
        ).all()
        outstanding = sum(float(cast(Any, inv.total_amount)) for inv in unpaid_invoices)

        results.append({
            "id": str(u.id),
            "company_id": str(u.company_id) if u.company_id else None,
            "name": u.full_name,
            "email": u.email,
            "mobile": u.mobile,
            "current_plan": active_plan.plan_type if active_plan else "None",
            "billing_cycle": "Monthly" if active_plan and active_plan.plan_type == "month" else "Weekly" if active_plan and active_plan.plan_type == "week" else "Daily" if active_plan else "None",
            "amount": outstanding,
            "renewal_date": active_plan.end_date.isoformat() if active_plan else "N/A",
            "payment_status": "Unpaid" if outstanding > 0 else "Paid",
            "org_name": u.org_name
        })
    return results

@router.get("/companies")
def get_finance_companies(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get all approved companies with their seats, charges, next renewal, and billing status"""
    companies = db.query(Company).filter(
        Company.status == "approved",
        ~Company.company_name.like("% (Customer)"),
        ~Company.company_name.like("Customer %")
    ).order_by(Company.company_name).all()
    results = []
    for comp in companies:
        plan = None
        if comp.selected_plan_id:
            plan = db.query(PricingPlan).filter(PricingPlan.id == comp.selected_plan_id).first()
            
        registered_employees = db.query(User).filter(User.company_id == comp.id).count()
        price = float(cast(Any, plan.price)) if plan is not None else 0.0
        seats = int(cast(Any, comp.max_employee_capacity) or 1)
        monthly_charge = price * seats
        
        # Calculate next renewal date
        renewal_date = "N/A"
        if plan is not None:
            plan_date = comp.plan_selected_at or comp.created_at
            if plan_date:
                renewal_date = (cast(datetime, plan_date) + timedelta(days=30)).date().isoformat()
            
        # Check for unpaid invoices
        unpaid_count = db.query(Invoice).filter(
            Invoice.company_id == comp.id,
            Invoice.status == "unpaid",
            Invoice.invoice_status != "voided"
        ).count()
        billing_status = "Unpaid" if unpaid_count > 0 else "Paid"
            
        results.append({
            "id": str(comp.id),
            "company": comp.company_name,
            "current_plan": plan.plan_name if plan is not None else "None",
            "purchased_seats": seats,
            "employees_registered": registered_employees,
            "available_seats": max(0, seats - registered_employees),
            "monthly_charge": monthly_charge,
            "next_renewal": renewal_date,
            "billing_status": billing_status
        })
    return results

@router.get("/invoices", response_model=List[InvoiceResponse])
def get_finance_invoices(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Retrieve all corporate invoices with optional status filter"""
    query = db.query(Invoice).order_by(desc(Invoice.created_at))
    if status:
        query = query.filter(Invoice.status == status.lower())
    return query.all()

class VoidInvoiceRequest(BaseModel):
    reason: str

@router.post("/invoices/{invoice_id}/pay")
def pay_invoice_action(
    invoice_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Mark an invoice as paid (Deprecated)"""
    raise HTTPException(
        status_code=403,
        detail="Finance users are no longer allowed to manually mark invoices as paid or verify payments."
    )

@router.post("/invoices/{invoice_id}/void")
def void_invoice_action(
    invoice_id: UUID,
    req: VoidInvoiceRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="Void reason is required.")
        
    prev = inv.invoice_status
    inv.invoice_status = "voided"
    inv.voided_by = current_user.id
    inv.voided_at = datetime.now(timezone.utc)
    inv.void_reason = req.reason
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Invoice Voided",
        module="Invoice Management",
        entity=inv.invoice_number,
        prev_val=prev,
        new_val="voided"
    )
    return {"status": "success", "invoice": inv.invoice_number}

@router.get("/payments")
def get_finance_payments(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Retrieve all payments log (Verified Customer plans & Corporate invoices)"""
    payments = []
    
    # 1. Paid invoices (Corporate & Customer)
    paid_invoices = db.query(Invoice).filter(Invoice.status == "paid").order_by(desc(Invoice.payment_date)).all()
    for inv in paid_invoices:
        payments.append({
            "id": f"TXN-{'C' if inv.company_id else 'P'}-{inv.invoice_number}",
            "type": "Corporate" if inv.company_id else "Customer",
            "entity": inv.owner_name,
            "amount": float(cast(Any, inv.total_amount)),
            "status": "Verified",
            "received_on": inv.payment_date.isoformat() if inv.payment_date else inv.created_at.isoformat()
        })
        
    # Sort by received_on descending
    return sorted(payments, key=lambda x: x["received_on"], reverse=True)

@router.get("/subscriptions")
def get_finance_subscriptions(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Retrieve all current subscriptions"""
    subs = []
    
    # 1. Company subscriptions
    companies = db.query(Company).filter(
        cast(Any, Company.selected_plan_id != None),
        Company.status == "approved",
        ~Company.company_name.like("% (Customer)"),
        ~Company.company_name.like("Customer %")
    ).all()
    for c in companies:
        plan = db.query(PricingPlan).filter(PricingPlan.id == c.selected_plan_id).first()
        base_date = cast(Optional[datetime], c.plan_selected_at or c.created_at)
        renewal_date = (base_date + timedelta(days=30)).date().isoformat() if base_date is not None else "N/A"
        subs.append({
            "id": str(c.id),
            "type": "Corporate",
            "entity": c.company_name,
            "plan_name": plan.plan_name if plan is not None else "None",
            "cycle": "month" if plan is not None and plan.billing_type == "seat" else (plan.billing_type if plan is not None else "Month"),
            "renewal_date": renewal_date,
            "status": c.subscription_status
        })
        
    # 2. Individual Customer plans
    plans = db.query(Plan).filter(
        Plan.is_active == True,
        Plan.start_date <= date.today(),
        Plan.end_date >= date.today()
    ).all()
    for p in plans:
        subs.append({
            "id": str(p.id),
            "type": "Customer",
            "entity": p.user.full_name if p.user else "Unknown Customer",
            "plan_name": p.plan_type.upper(),
            "cycle": p.plan_type,
            "renewal_date": p.end_date.isoformat(),
            "status": "ACTIVE" if p.payment_verified else "PENDING_VERIFICATION"
        })
        
    return subs

@router.post("/customers/{user_id}/upgrade")
def upgrade_customer_subscription(
    user_id: UUID,
    plan_type: str = Body(...),
    amount: float = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Upgrade a customer's active plan subscription"""
    active_plans = db.query(Plan).filter(Plan.user_id == user_id, Plan.is_active == True).all()
    for p in active_plans:
        p.is_active = False
        
    start_date = date.today()
    end_date = start_date + timedelta(days=30) if plan_type == "month" else start_date + timedelta(days=7) if plan_type == "week" else start_date + timedelta(days=1)
    
    new_plan = Plan(
        user_id=user_id,
        plan_type=plan_type,
        amount=amount,
        start_date=start_date,
        end_date=end_date,
        is_active=True,
        payment_verified=True
    )
    db.add(new_plan)
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Customer Plan Upgraded",
        module="Customer Billing",
        entity=str(user_id),
        new_val=plan_type
    )
    return {"status": "success", "plan_type": plan_type}

@router.post("/customers/{user_id}/suspend")
def suspend_customer_subscription(
    user_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Suspend a customer's active plan"""
    active_plan = db.query(Plan).filter(Plan.user_id == user_id, Plan.is_active == True).first()
    if not active_plan:
        raise HTTPException(status_code=404, detail="No active plan found to suspend")
        
    active_plan.is_active = False
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Customer Subscription Suspended",
        module="Customer Billing",
        entity=str(user_id)
    )
    return {"status": "success"}

@router.post("/customers/{user_id}/resume")
def resume_customer_subscription(
    user_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Resume suspended customer subscription"""
    inactive_plan = db.query(Plan).filter(Plan.user_id == user_id, Plan.is_active == False).order_by(desc(Plan.created_at)).first()
    if not inactive_plan:
        raise HTTPException(status_code=404, detail="No previous plan found to resume")
        
    inactive_plan.is_active = True
    inactive_plan.start_date = date.today()
    inactive_plan.end_date = date.today() + timedelta(days=30)
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Customer Subscription Resumed",
        module="Customer Billing",
        entity=str(user_id)
    )
    return {"status": "success"}

# ==========================================
# SEAT BILLING QUEUE
# ==========================================

@router.get("/seat-billing")
def get_seat_billing_queue(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get the seat requests billing queue from companies registry"""
    companies = db.query(Company).filter(
        cast(Any, Company.seats_requested).isnot(None),
        cast(Any, Company.seats_requested != Company.max_employee_capacity),
        ~Company.company_name.like("% (Customer)"),
        ~Company.company_name.like("Customer %")
    ).all()
    queue = []
    
    for company in companies:
        old_seats = int(cast(Any, company.max_employee_capacity) or 1)
        new_seats = int(cast(Any, company.seats_requested) or 1)
        diff = new_seats - old_seats
        req_type = "Increase" if diff > 0 else "Reduce"
        
        # Calculate pricing
        plan = None
        if company.selected_plan_id:
            plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
        price = float(cast(Any, plan.price)) if plan is not None else 0.0
        additional_charges = price * diff
        
        # Check if an invoice for seat upgrade has been generated
        latest_inv = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.plan_name.like("%Seat Upgrade%")
        ).order_by(desc(Invoice.created_at)).first()
        
        is_voided = latest_inv and latest_inv.invoice_status == "voided"
        
        generated_invoice = latest_inv.invoice_number if (latest_inv and not is_voided) else "None"
        generated_invoice_id = str(latest_inv.id) if (latest_inv and not is_voided) else None
        
        active_inv = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.plan_name.like("%Seat Upgrade%"),
            Invoice.invoice_status == "active"
        ).order_by(desc(Invoice.created_at)).first()
        
        billing_status = "Pending Invoice" if (not latest_inv or is_voided) else "Invoiced"
        payment_status = "Paid (Verified)" if (active_inv and active_inv.status == "paid") else "Unpaid (Pending)"
        verified_by_name = "N/A"
        
        queue.append({
            "company_id": str(company.id),
            "company": company.company_name,
            "request_type": req_type,
            "current_seats": old_seats,
            "requested_seats": new_seats,
            "seat_difference": abs(diff),
            "additional_charges": additional_charges,
            "generated_invoice": generated_invoice,
            "generated_invoice_id": generated_invoice_id,
            "billing_status": billing_status,
            "payment_status": payment_status,
            "verified_by": verified_by_name
        })
    return queue

@router.post("/seat-billing/{company_id}/calculate")
def calculate_seat_charges(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Calculate seat difference charges for a company"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    old_capacity = int(cast(Any, company.max_employee_capacity) or 1)
    new_capacity = int(cast(Any, company.seats_requested) or old_capacity)
    diff_seats = new_capacity - old_capacity
    
    plan = None
    if company.selected_plan_id:
        plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
    price_per_seat = float(cast(Any, plan.price)) if plan is not None else 0.0
    
    subtotal = price_per_seat * diff_seats
    
    from app.api.v1.endpoints.invoices import get_current_template_snapshot_and_version
    config, version = get_current_template_snapshot_and_version(db)
    config = cast(dict, config)
    
    tax_cfg = config.get("tax", {})
    tax_percent = float(tax_cfg.get("percentage", 18.0))
    tax_included = bool(tax_cfg.get("included", False))
    
    if tax_included:
        actual_subtotal = subtotal / (1.0 + tax_percent / 100.0)
        gst_amount = subtotal - actual_subtotal
        subtotal = actual_subtotal
    else:
        gst_amount = subtotal * (tax_percent / 100.0)
        
    # Fees sum
    fees_sum = 0.0
    for fee in config.get("fees", []):
        val = float(fee.get("value", 0.0))
        if fee.get("type") == "percent":
            fees_sum += subtotal * (val / 100.0)
        else:
            fees_sum += val
            
    # Discounts sum
    discounts_sum = 0.0
    for disc in config.get("discounts", []):
        val = float(disc.get("value", 0.0))
        if disc.get("type") == "percent":
            discounts_sum += subtotal * (val / 100.0)
        else:
            discounts_sum += val
            
    total_amount = subtotal + gst_amount + fees_sum - discounts_sum
    
    return {
        "company_name": company.company_name,
        "seat_difference": diff_seats,
        "price_per_seat": price_per_seat,
        "subtotal": subtotal,
        "gst_rate": tax_percent,
        "gst_amount": gst_amount,
        "total_amount": total_amount
    }

@router.post("/seat-billing/{company_id}/invoice")
def generate_seat_upgrade_invoice(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Generate invoice for company seat request"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    old_capacity = int(cast(Any, company.max_employee_capacity) or 1)
    new_capacity = int(cast(Any, company.seats_requested) or old_capacity)
    diff_seats = new_capacity - old_capacity
    if diff_seats <= 0:
        raise HTTPException(status_code=400, detail="No seat increase requested to generate invoice")
        
    plan = None
    if company.selected_plan_id:
        plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
    if not plan:
        raise HTTPException(status_code=400, detail="Company does not have an active subscription plan")
        
    price_per_seat = float(cast(Any, plan.price))
    subtotal = price_per_seat * diff_seats
    
    from app.api.v1.endpoints.invoices import get_current_template_snapshot_and_version, generate_invoice_number
    config, version = get_current_template_snapshot_and_version(db)
    config = cast(dict, config)
    
    tax_cfg = config.get("tax", {})
    tax_percent = float(tax_cfg.get("percentage", 18.0))
    tax_included = bool(tax_cfg.get("included", False))
    
    if tax_included:
        actual_subtotal = subtotal / (1.0 + tax_percent / 100.0)
        gst_amount = subtotal - actual_subtotal
        subtotal = actual_subtotal
    else:
        gst_amount = subtotal * (tax_percent / 100.0)
        
    # Fees sum
    fees_sum = 0.0
    for fee in config.get("fees", []):
        val = float(fee.get("value", 0.0))
        if fee.get("type") == "percent":
            fees_sum += subtotal * (val / 100.0)
        else:
            fees_sum += val
            
    # Discounts sum
    discounts_sum = 0.0
    for disc in config.get("discounts", []):
        val = float(disc.get("value", 0.0))
        if disc.get("type") == "percent":
            discounts_sum += subtotal * (val / 100.0)
        else:
            discounts_sum += val
            
    total_amount = subtotal + gst_amount + fees_sum - discounts_sum
    
    inv_cfg = config.get("invoice", {})
    due_offset = int(inv_cfg.get("dueDateOffset", 7))
    due_date = date.today() + timedelta(days=due_offset)
    
    inv_num = generate_invoice_number(db, config)
    
    billing_type_lower = plan.billing_type.lower()
    if billing_type_lower in ("day", "daily"):
        billing_end_date = date.today()
    elif billing_type_lower in ("week", "weekly"):
        billing_end_date = date.today() + timedelta(days=6)
    elif billing_type_lower in ("month", "monthly"):
        today = date.today()
        if today.month == 12:
            next_month = date(today.year + 1, 1, 1)
        else:
            next_month = date(today.year, today.month + 1, 1)
        billing_end_date = next_month - timedelta(days=1)
    else:
        billing_end_date = date.today() + timedelta(days=30)

    new_inv_id = uuid.uuid4()
    new_inv = Invoice(
        id=new_inv_id,
        company_id=company.id,
        plan_name=f"{plan.plan_name} - Seat Upgrade",
        billing_type=plan.billing_type,
        price_per_seat=price_per_seat,
        seats=diff_seats,
        subtotal=subtotal,
        gst_rate=tax_percent,
        gst_amount=gst_amount,
        total_amount=total_amount,
        invoice_date=date.today(),
        invoice_number=inv_num,
        billing_start_date=date.today(),
        billing_end_date=billing_end_date,
        due_date=due_date,
        status="unpaid",
        invoice_status="active",
        created_at=datetime.now(timezone.utc),
        template_version=version,
        template_snapshot=config
    )
    db.add(new_inv)
    
    # Link the newly generated invoice to the active seat request and reset status
    seat_req = db.query(SeatRequest).filter(
        SeatRequest.company_id == company.id,
        SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED", "PAYMENT_VERIFIED"])
    ).order_by(SeatRequest.created_at.desc()).first()
    
    if seat_req:
        seat_req.invoice_id = new_inv_id
        seat_req.status = "INVOICE_GENERATED"
        db.add(seat_req)
        
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Generated Seat Upgrade Invoice",
        module="Seat Billing Queue",
        entity=company.company_name,
        new_val=inv_num
    )
    return {"status": "success", "invoice_number": inv_num}

@router.post("/seat-billing/{company_id}/approve")
def approve_seat_billing(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Verify seat upgrade payment (Deprecated)"""
    raise HTTPException(
        status_code=403,
        detail="Finance users are no longer allowed to verify seat requests or payments manually."
    )

@router.post("/seat-billing/{company_id}/reject")
def reject_seat_billing(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Reject seat billing (Deprecated)"""
    raise HTTPException(
        status_code=403,
        detail="Finance users are no longer allowed to reject seat billing requests manually."
    )

# ==========================================
# REFUNDS MODULE
# ==========================================

@router.get("/refunds")
def get_finance_refunds(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """List all refunds in the system"""
    refunds = db.query(Refund).order_by(desc(Refund.created_at)).all()
    results = []
    for r in refunds:
        inv = db.query(Invoice).filter(Invoice.id == r.invoice_id).first()
        results.append({
            "id": str(r.id),
            "invoice_number": inv.invoice_number if inv else "Unknown",
            "company": inv.company.company_name if inv and inv.company else "Unknown",
            "amount": float(cast(Any, r.amount)),
            "reason": r.reason,
            "status": r.status,
            "request_date": r.created_at.date().isoformat(),
            "approved_by": str(r.approved_by) if r.approved_by else "None"
        })
    return results

@router.post("/refunds")
def request_refund(
    invoice_id: UUID = Body(...),
    amount: float = Body(...),
    reason: str = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Request a refund for an invoice"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    new_refund = Refund(
        invoice_id=invoice_id,
        amount=amount,
        reason=reason,
        status="pending"
    )
    db.add(new_refund)
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Refund Requested",
        module="Refund Management",
        entity=inv.invoice_number,
        new_val=str(amount)
    )
    return {"status": "success"}

@router.post("/refunds/{refund_id}/approve")
def approve_refund_action(
    refund_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Approve a refund request"""
    refund = db.query(Refund).filter(Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund request not found")
        
    refund.status = "approved"
    refund.approved_by = current_user.id
    db.commit()
    
    inv = db.query(Invoice).filter(Invoice.id == refund.invoice_id).first()
    if inv:
        inv.status = "cancelled" # Void the invoice upon refund approval
        db.commit()
        
    log_finance_action(
        db=db,
        user=current_user,
        action="Refund Approved",
        module="Refund Management",
        entity=inv.invoice_number if inv else str(refund.id),
        new_val="approved"
    )
    return {"status": "success"}

@router.post("/refunds/{refund_id}/reject")
def reject_refund_action(
    refund_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Reject a refund request"""
    refund = db.query(Refund).filter(Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund request not found")
        
    refund.status = "rejected"
    db.commit()
    
    log_finance_action(
        db=db,
        user=current_user,
        action="Refund Rejected",
        module="Refund Management",
        entity=str(refund.id),
        new_val="rejected"
    )
    return {"status": "success"}

# ==========================================
# FINANCIAL REPORTS
# ==========================================

@router.get("/reports")
def get_financial_reports(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get detailed financial reporting metrics"""
    today = date.today()
    start_of_year = date(today.year, 1, 1)
    
    # 1. Total revenue (annual)
    paid_inv_year_corp = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.company_id != None,
        func.cast(Invoice.payment_date, Date) >= start_of_year
    ).scalar() or 0.0
    
    paid_inv_year_cust = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.user_id != None,
        func.cast(Invoice.payment_date, Date) >= start_of_year
    ).scalar() or 0.0
    
    annual_revenue = float(paid_inv_year_corp) + float(paid_inv_year_cust)
    
    # 2. Outstanding Payments (Total unpaid invoices)
    outstanding_payments = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "unpaid",
        Invoice.invoice_status != "voided"
    ).scalar() or 0.0
    
    # 3. Revenue by Plan type
    revenue_by_plan = []
    # Query invoice groupings
    inv_group = db.query(Invoice.plan_name, func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid"
    ).group_by(Invoice.plan_name).all()
    for name, val in inv_group:
        revenue_by_plan.append({"plan": name, "revenue": float(val)})
        
    # 4. GST Summary (total GST collected)
    gst_collected_inv = db.query(func.sum(Invoice.gst_amount)).filter(
        Invoice.status == "paid"
    ).scalar() or 0.0
    
    # 5. Seat Upgrade Revenue (Corporate seat invoice payments)
    seat_upgrade_rev = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.status == "paid",
        Invoice.plan_name.like("%Seat Upgrade%")
    ).scalar() or 0.0
    
    # 6. Corporate Revenue
    corporate_revenue = float(paid_inv_year_corp)
    
    # 7. Customer Revenue
    customer_revenue = float(paid_inv_year_cust)
    
    return {
        "annual_revenue": annual_revenue,
        "outstanding_payments": float(outstanding_payments),
        "gst_summary": float(gst_collected_inv),
        "seat_upgrade_revenue": float(seat_upgrade_rev),
        "corporate_revenue": corporate_revenue,
        "customer_revenue": customer_revenue,
        "revenue_by_plan": revenue_by_plan
    }

# ==========================================
# AUDIT LOGS
# ==========================================

@router.get("/audit")
def get_finance_audit_logs(
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_finance)
) -> Any:
    """Get finance-specific activity/audit logs"""
    logs = db.query(ActivityLog).filter(ActivityLog.performed_by_role == "FINANCE").order_by(desc(ActivityLog.created_at)).all()
    results = []
    for l in logs:
        details = l.details or {}
        
        # Determine Module
        module = details.get("module")
        raw_action = str(l.action) if l.action is not None else ""
        if not module:
            if raw_action and "Invoice" in raw_action:
                module = "Invoices"
            else:
                module = "N/A"
                
        # Determine Entity Reference and Entity Name
        inv_num = details.get("invoice_number")
        entity_val = details.get("entity")
        if entity_val and str(entity_val).startswith("INV-") and not inv_num:
            inv_num = entity_val
            
        entity_name = None
        # Try database Invoice lookup
        if inv_num:
            inv = db.query(Invoice).filter(Invoice.invoice_number == inv_num).first()
            if inv:
                entity_name = inv.owner_name
                
        # Fallback 1: details dict fields
        if not entity_name:
            entity_name = details.get("company_name")
            if not entity_name or entity_name == "Individual Customer":
                entity_name = details.get("customer_name")
                
        # Fallback 2: UUID lookup
        if not entity_name and entity_val:
            try:
                import uuid
                val_uuid = uuid.UUID(str(entity_val))
                user_obj = db.query(User).filter(User.id == val_uuid).first()
                if user_obj:
                    entity_name = user_obj.full_name or user_obj.email
                else:
                    comp_obj = db.query(Company).filter(Company.id == val_uuid).first()
                    if comp_obj:
                        entity_name = comp_obj.company_name
            except ValueError:
                pass
                
        # Fallback 3: check if entity_val itself is a plain string/name
        if not entity_name and entity_val:
            entity_name = str(entity_val)
            
        # Fallback 4: default
        if not entity_name:
            entity_name = "Unknown Entity"
            
        # Clean suffixes/prefixes for extra robustness
        entity_name = str(entity_name)
        for suffix in [" (Customer)", " (Company)", " (Individual Customer)"]:
            if entity_name.endswith(suffix):
                entity_name = entity_name[:-len(suffix)]
        if entity_name.startswith("Customer "):
            entity_name = entity_name[len("Customer "):]
            
        entity_reference = inv_num
        legacy_entity = f"{inv_num} ({entity_name})" if inv_num else entity_name
                
        # Determine Previous Value
        previous_value = details.get("previous_value")
        if not previous_value:
            previous_value = details.get("previous_status", "N/A")
            
        # Determine New Value
        new_value = details.get("new_value")
        if not new_value:
            new_value = details.get("new_status", "N/A")
            
        results.append({
            "id": str(l.id),
            "timestamp": l.created_at.isoformat(),
            "user": l.performed_by_name or "System",
            "action": l.action,
            "module": module,
            "entity": legacy_entity,
            "entity_reference": entity_reference,
            "entity_name": entity_name,
            "previous_value": previous_value,
            "new_value": new_value,
            "ip_address": "127.0.0.1"
        })
    return results
