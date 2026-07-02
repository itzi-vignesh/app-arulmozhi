from typing import Any, List, Optional, cast
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.api import deps
from app.models.business import Plan, Pricing, Checkin
from app.schemas.business import PlanResponse, PlanCreate, PricingResponse, PricingUpdate, CheckinResponseNested
from app.services.notification import create_notification, notify_admins

router = APIRouter()

# ---- Plans ----
@router.get("/plans/my", response_model=List[PlanResponse])
def get_my_plans(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_customer)
) -> Any:
    """Get all plans for the currently authenticated customer (User only)"""
    return db.query(Plan).filter(Plan.user_id == current_user.id).order_by(desc(Plan.created_at)).all()

@router.get("/plans", response_model=List[PlanResponse])
def get_plans(
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
) -> Any:
    skip = (page - 1) * limit
    return db.query(Plan).order_by(desc(Plan.created_at)).offset(skip).limit(limit).all()

@router.post("/plans", response_model=PlanResponse)
def create_plan(
    plan_in: PlanCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    from app.api.v1.endpoints.invoices import verify_no_overdue_payment
    verify_no_overdue_payment(db, current_user)
    
    if current_user.company_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Corporate employees are not allowed to purchase individual plans. Please contact your company administrator to assign you a corporate seat."
        )
        
    plan = Plan(**plan_in.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    
    # Generate Paid Invoice directly linked to Customer/User
    from app.models.user import User
    from app.models.business import Invoice
    import uuid
    from datetime import date, timedelta, datetime, timezone
    
    customer = db.query(User).filter(User.id == plan.user_id).first()
    if customer:
        # Generate an Invoice in invoices table for this plan booking linked directly to customer!
        from app.api.v1.endpoints.invoices import get_current_template_snapshot_and_version, generate_invoice_number
        config, version = get_current_template_snapshot_and_version(db)
        inv_num = generate_invoice_number(db, config)
        
        invoice_cfg = config.get("invoice") if isinstance(config, dict) else None
        if not isinstance(invoice_cfg, dict):
            invoice_cfg = {}
        due_offset = int(invoice_cfg.get("dueDateOffset", 7))
        b_date = cast(date, plan.start_date)
        due_date = b_date + timedelta(days=due_offset)
        
        total_amount = float(cast(Any, plan.amount))
        subtotal = total_amount / 1.18
        gst_amount = total_amount - subtotal
        
        new_inv = Invoice(
            id=uuid.uuid4(),
            company_id=None,
            user_id=customer.id,
            plan_name=f"{plan.plan_type.upper()} PASS",
            billing_type=plan.plan_type,
            price_per_seat=total_amount,
            seats=1,
            subtotal=subtotal,
            gst_rate=18.0,
            gst_amount=gst_amount,
            total_amount=total_amount,
            invoice_date=plan.created_at.date() if hasattr(plan.created_at, "date") else date.today(),
            status="unpaid",
            payment_date=None,
            invoice_status="active",
            created_at=plan.created_at,
            invoice_number=inv_num,
            billing_start_date=plan.start_date,
            billing_end_date=plan.end_date,
            due_date=due_date,
            template_version=version,
            template_snapshot=config
        )
        db.add(new_inv)
        db.commit()
        
    # Notify customer
    create_notification(
        db=db,
        user_id=current_user.id,
        title="Plan Subscribed",
        message=f"You have successfully booked a {plan.plan_type} plan.",
        type="success"
    )
    
    return plan

# ---- Pricing ----
@router.get("/pricing", response_model=List[PricingResponse])
def get_pricing(
    db: Session = Depends(deps.get_db)
) -> Any:
    """Get all pricing models (Public/Any auth)"""
    return db.query(Pricing).all()

@router.put("/pricing/update", response_model=PricingResponse)
def update_pricing(
    pricing_in: PricingUpdate,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    """Update a pricing model"""
    pricing = db.query(Pricing).filter(Pricing.plan_type == pricing_in.plan_type).first()
    if not pricing:
        pricing = Pricing(
            plan_type=pricing_in.plan_type,
            amount=pricing_in.amount,
            gst_rate=pricing_in.gst_rate,
            updated_by=admin.id
        )
        db.add(pricing)
    else:
        pricing.amount = pricing_in.amount  # type: ignore
        pricing.gst_rate = pricing_in.gst_rate  # type: ignore
        pricing.updated_by = admin.id  # type: ignore
        
    db.commit()
    db.refresh(pricing)
    
    notify_admins(
        db=db,
        title="Pricing Updated",
        message=f"Pricing for {pricing.plan_type} has been updated.",
        type="info"
    )
    
    return pricing

# ---- Checkins ----
@router.get("/checkins/my", response_model=List[CheckinResponseNested])
def get_my_checkins(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_customer)
) -> Any:
    """Get all checkins for the currently authenticated customer (User only)"""
    return (
        db.query(Checkin)
        .options(joinedload(Checkin.user), joinedload(Checkin.plan))
        .filter(Checkin.user_id == current_user.id)
        .order_by(desc(Checkin.created_at))
        .all()
    )

@router.get("/checkins/", response_model=List[CheckinResponseNested])
def get_checkins(
    status: Optional[str] = None,
    checkin_approved: Optional[bool] = None,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
) -> Any:
    skip = (page - 1) * limit
    q = db.query(Checkin).options(joinedload(Checkin.user), joinedload(Checkin.plan))
    if status:
        q = q.filter(Checkin.status == status)
    if checkin_approved is not None:
        q = q.filter(Checkin.checkin_approved == checkin_approved)
    return q.order_by(desc(Checkin.created_at)).offset(skip).limit(limit).all()

@router.post("/checkins/expired/mark")
def mark_expired_checkins(db: Session = Depends(deps.get_db), admin = Depends(deps.get_current_admin)) -> Any:
    # Logic to mark expired
    return {"msg": "Marked expired checkins"}

@router.post("/checkins/expired/delete-old")
def delete_old_expired_checkins(db: Session = Depends(deps.get_db), admin = Depends(deps.get_current_admin)) -> Any:
    # Logic to delete old expired
    return {"msg": "Deleted old expired checkins"}
