from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.business import PricingPlan
from app.models.audit import ActivityLog
from app.schemas.pricing import PricingPlanResponse, PricingPlanCreate, PricingPlanUpdate

router = APIRouter()

def log_pricing_change(db: Session, user: Any, plan_name: str, field_name: str, old_val: Any, new_val: Any):
    name = user.email
    role = "user"
    if user.superuser_profile:
        name = user.superuser_profile.full_name or user.email
        role = "superuser"
    elif user.admin_profile:
        name = user.admin_profile.full_name or user.email
        role = "admin"
    elif user.company_admin_profile:
        name = user.company_admin_profile.full_name or user.email
        role = "company_admin"
    elif user.customer_profile:
        name = user.customer_profile.full_name or user.email
        role = "customer"

    # Action format matching prompt example: Monthly Team Plan Price: ₹5200 → ₹6000
    # We prefix Currency symbol if it's price
    old_prefix = "₹" if field_name == "Price" else ""
    new_prefix = "₹" if field_name == "Price" else ""
    action = f"{plan_name} {field_name}: {old_prefix}{old_val} → {new_prefix}{new_val}"
    
    log_entry = ActivityLog(
        action=action,
        performed_by=user.id,
        performed_by_name=name,
        performed_by_role=role,
        details={
            "plan_name": plan_name,
            "field": field_name.lower(),
            "old_value": str(old_val),
            "new_value": str(new_val)
        }
    )
    db.add(log_entry)

@router.get("/pricing/customer", response_model=List[PricingPlanResponse])
def get_customer_pricing(db: Session = Depends(deps.get_db)) -> Any:
    """Get active customer pricing plans (Public)"""
    return db.query(PricingPlan).filter(PricingPlan.category == "customer", PricingPlan.is_active == True).all()

@router.get("/pricing/corporate", response_model=List[PricingPlanResponse])
def get_corporate_pricing(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Get active corporate pricing plans (Corporate/Admin/Superuser)"""
    if not (current_user.superuser_profile or current_user.admin_profile or current_user.company_admin_profile or current_user.finance_profile):
        raise HTTPException(status_code=403, detail="Not authorized to view corporate pricing")
    return db.query(PricingPlan).filter(PricingPlan.category == "corporate", PricingPlan.is_active == True).all()

@router.get("/admin/pricing/customer", response_model=List[PricingPlanResponse])
def get_admin_customer_pricing(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin)
) -> Any:
    """Get all customer pricing plans (Admin/Superuser)"""
    return db.query(PricingPlan).filter(PricingPlan.category == "customer").all()

@router.get("/superuser/pricing", response_model=List[PricingPlanResponse])
def get_superuser_pricing(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Get all pricing plans (Superuser only)"""
    return db.query(PricingPlan).all()

@router.put("/superuser/pricing/{id}", response_model=PricingPlanResponse)
def update_superuser_pricing(
    id: UUID,
    plan_in: PricingPlanUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Update any pricing plan (Superuser only)"""
    plan = db.query(PricingPlan).filter(PricingPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Pricing plan not found")
    
    update_data = plan_in.model_dump(exclude_unset=True)
    
    # Audit logging for changes
    for field, new_val in update_data.items():
        old_val = getattr(plan, field)
        if old_val != new_val:
            field_label = "Price" if field == "price" else field.replace("_", " ").title()
            log_pricing_change(db, current_user, str(plan.plan_name), field_label, old_val, new_val)
            setattr(plan, field, new_val)
            
    db.commit()
    db.refresh(plan)
    return plan

@router.put("/admin/pricing/customer/{id}", response_model=PricingPlanResponse)
def update_admin_customer_pricing(
    id: UUID,
    plan_in: PricingPlanUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Update customer pricing plan (Superuser only)"""
    plan = db.query(PricingPlan).filter(PricingPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Pricing plan not found")
        
    # Enforce role-based permission on the backend
    if plan.category == "corporate":
        raise HTTPException(status_code=403, detail="Admin is not allowed to modify Corporate plans")
        
    update_data = plan_in.model_dump(exclude_unset=True)
    
    # Audit logging for changes
    for field, new_val in update_data.items():
        old_val = getattr(plan, field)
        if old_val != new_val:
            field_label = "Price" if field == "price" else field.replace("_", " ").title()
            log_pricing_change(db, current_user, str(plan.plan_name), field_label, old_val, new_val)
            setattr(plan, field, new_val)
            
    db.commit()
    db.refresh(plan)
    return plan

@router.post("/superuser/pricing", response_model=PricingPlanResponse, status_code=status.HTTP_201_CREATED)
def create_superuser_pricing(
    plan_in: PricingPlanCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Create a new pricing plan (Superuser only)"""
    plan = PricingPlan(**plan_in.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.post("/admin/pricing/customer", response_model=PricingPlanResponse, status_code=status.HTTP_201_CREATED)
def create_admin_pricing_customer(
    plan_in: PricingPlanCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Create a new customer pricing plan (Superuser only)"""
    if plan_in.category == "corporate":
        raise HTTPException(status_code=403, detail="Admin is not allowed to create Corporate plans")
    plan = PricingPlan(**plan_in.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


