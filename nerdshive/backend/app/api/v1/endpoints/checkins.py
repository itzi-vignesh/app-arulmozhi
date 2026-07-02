from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import AuthUser, User
from app.models.business import Checkin
from app.schemas.business import CheckinCreate, CheckinUpdate, CheckinResponseNested
from app.services.notification import create_notification, notify_admins

router = APIRouter()

@router.post("/", response_model=CheckinResponseNested)
def create_checkin(
    checkin_in: CheckinCreate,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Create a checkin"""
    from app.api.v1.endpoints.invoices import verify_no_overdue_payment
    verify_no_overdue_payment(db, current_user)
    
    # Look up the customer profile for the authenticated user
    customer = db.query(User).filter(User.auth_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=403, detail="Customer profile not found")
    # Verify the current user is creating for themselves
    if customer.id != checkin_in.user_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    checkin = Checkin(
        user_id=checkin_in.user_id,
        plan_id=checkin_in.plan_id,
        status="pending"
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    
    notify_admins(
        db=db,
        title="New Check-in Request",
        message=f"{customer.full_name} has requested a check-in.",
        type="info"
    )
    
    return checkin

@router.put("/{checkin_id}", response_model=CheckinResponseNested)
def update_checkin(
    checkin_id: UUID,
    checkin_in: CheckinUpdate,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    checkin = db.query(Checkin).filter(Checkin.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")
        
    for field, value in checkin_in.model_dump(exclude_unset=True).items():
        setattr(checkin, field, value)
        
    db.commit()
    db.refresh(checkin)
    
    # Notify customer if payment rejected
    if getattr(checkin_in, "payment_status", None) == "rejected" and checkin.user and checkin.user.auth_id:
        create_notification(
            db=db,
            user_id=checkin.user.auth_id,
            title="Payment Rejected",
            message="Your payment was marked as unpaid/rejected.",
            type="error"
        )
        
    return checkin

@router.put("/{checkin_id}/approve", response_model=CheckinResponseNested)
def approve_checkin(
    checkin_id: UUID,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    """Approve a checkin (Admin only)"""
    checkin = db.query(Checkin).filter(Checkin.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")
    
    checkin.checkin_approved = True  # type: ignore
    checkin.checkin_approved_by = admin.id  # type: ignore
    checkin.checkin_approved_at = datetime.now(timezone.utc)  # type: ignore
    checkin.checkin_time = datetime.now(timezone.utc)  # type: ignore
    checkin.status = "checked_in"  # type: ignore
    
    db.commit()
    db.refresh(checkin)
    
    if checkin.user and checkin.user.auth_id:
        create_notification(
            db=db,
            user_id=checkin.user.auth_id,
            title="Check-in Approved",
            message="Your check-in request has been approved.",
            type="success"
        )
        
    return checkin

@router.post("/{checkin_id}/verify_payment")
def verify_payment(
    checkin_id: UUID,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    """Verify checkin payment (Admin only)"""
    checkin = db.query(Checkin).filter(Checkin.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")
        
    checkin.payment_status = "verified"  # type: ignore
    if checkin.plan:
        checkin.plan.payment_verified = True  # type: ignore
        
    db.commit()
    db.refresh(checkin)
    
    if checkin.user and checkin.user.auth_id:
        create_notification(
            db=db,
            user_id=checkin.user.auth_id,
            title="Payment Verified",
            message="Your payment has been successfully verified.",
            type="success"
        )
        
    return {"msg": "Payment verified successfully"}

@router.delete("/{checkin_id}")
def delete_checkin(
    checkin_id: UUID,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    """Reject/Delete a checkin"""
    checkin = db.query(Checkin).filter(Checkin.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")
        
    if checkin.user and checkin.user.auth_id:
        create_notification(
            db=db,
            user_id=checkin.user.auth_id,
            title="Check-in Rejected",
            message="Your check-in request was rejected.",
            type="error"
        )
        
    db.delete(checkin)
    db.commit()
    return {"msg": "Checkin deleted"}
