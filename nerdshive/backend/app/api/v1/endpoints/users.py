from typing import Any, List, Optional, Union, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body, Response, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api import deps
from app.models.user import User, AuthUser, Admin, Superuser
from app.schemas.user import UserResponse, UserUpdate, UserCreate, AdminResponse
from app.core.security import get_password_hash
from app.api.validators import (
    validate_name_str, validate_email_str, validate_phone_str,
    validate_aadhaar_str, validate_pan_str, validate_gst_str
)
from app.models.audit import ActivityLog
from app.services.notification import create_notification, notify_admins
import re
from datetime import datetime, date, timezone

router = APIRouter()

class UserDeleteSchema(BaseModel):
    user_auth_id: UUID

@router.get("/me", response_model=Union[UserResponse, AdminResponse])
def read_user_me(
    db: Session = Depends(deps.get_db),
    current_auth_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Get current user profile (Customer, Admin, Superuser, or Corporate Admin)."""
    if current_auth_user.customer_profile:
        return current_auth_user.customer_profile
    elif current_auth_user.admin_profile:
        return current_auth_user.admin_profile
    elif current_auth_user.superuser_profile:
        return current_auth_user.superuser_profile
    else:
        from app.models.company import CompanyAdmin
        company_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_auth_user.id).first()
        if company_admin:
            return company_admin
        raise HTTPException(status_code=404, detail="Profile not found")

@router.put("/me", response_model=Union[UserResponse, AdminResponse])
def update_user_me(
    user_in: UserUpdate,
    db: Session = Depends(deps.get_db),
    current_auth_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Update current user profile."""
    if current_auth_user.customer_profile:
        customer = current_auth_user.customer_profile
        
        # Backend validation for updates
        if user_in.full_name is not None:
            validate_name_str(user_in.full_name, "Full Name")
        if user_in.mobile is not None:
            validate_phone_str(user_in.mobile)
            existing = db.query(User).filter(User.mobile == user_in.mobile, User.id != customer.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="A user with this Mobile number already exists.")
        if user_in.govt_id_type is not None or user_in.govt_id_number is not None:
            id_type = user_in.govt_id_type if user_in.govt_id_type is not None else customer.govt_id_type
            id_number = user_in.govt_id_number if user_in.govt_id_number is not None else customer.govt_id_number
            if id_type and id_number:
                id_type_upper = id_type.upper()
                id_number_clean = id_number.strip()
                if id_type_upper == "AADHAAR":
                    validate_aadhaar_str(id_number_clean)
                    existing = db.query(User).filter(
                        User.govt_id_type == "AADHAAR",
                        User.govt_id_number == id_number_clean,
                        User.id != customer.id
                    ).first()
                    if existing:
                        raise HTTPException(status_code=400, detail="A user with this Aadhaar number already exists.")
                elif id_type_upper == "PAN":
                    validate_pan_str(id_number_clean)
                    existing = db.query(User).filter(
                        User.govt_id_type == "PAN",
                        User.govt_id_number == id_number_clean.upper(),
                        User.id != customer.id
                    ).first()
                    if existing:
                        raise HTTPException(status_code=400, detail="A user with this PAN card already exists.")
                elif id_type_upper == "OTHER":
                    if len(id_number_clean) < 3:
                        raise HTTPException(status_code=400, detail="ID number must be at least 3 characters long.")
        if user_in.reimbursement is True or (user_in.reimbursement is None and customer.reimbursement):
            gst = user_in.gst_number if user_in.gst_number is not None else customer.gst_number
            if gst:
                validate_gst_str(gst)
                
        for field, value in user_in.model_dump(exclude_unset=True).items():
            setattr(customer, field, value)
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return UserResponse.model_validate(customer)
    elif current_auth_user.admin_profile:
        admin = current_auth_user.admin_profile
        for field in ["full_name", "mobile", "city", "location", "occupation"]:
            value = getattr(user_in, field, None)
            if value is not None:
                setattr(admin, field, value)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        return AdminResponse.model_validate(admin)
    elif current_auth_user.superuser_profile:
        superuser = current_auth_user.superuser_profile
        for field in ["full_name", "mobile", "city", "location", "occupation"]:
            value = getattr(user_in, field, None)
            if value is not None:
                setattr(superuser, field, value)
        db.add(superuser)
        db.commit()
        db.refresh(superuser)
        return AdminResponse.model_validate(superuser)
    else:
        from app.models.company import CompanyAdmin
        company_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_auth_user.id).first()
        if company_admin:
            if user_in.full_name is not None:
                company_admin.full_name = user_in.full_name  # type: ignore
            if user_in.mobile is not None:
                company_admin.mobile = user_in.mobile  # type: ignore
            if user_in.occupation is not None:
                company_admin.designation = user_in.occupation  # type: ignore
            db.add(company_admin)
            db.commit()
            db.refresh(company_admin)
            return AdminResponse.model_validate(company_admin)
        raise HTTPException(status_code=404, detail="Profile not found")

@router.get("/", response_model=List[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    is_approved: Optional[bool] = None,
    exclude_corporate: Optional[bool] = None,
    company_id: Optional[UUID] = None,
    db: Session = Depends(deps.get_db),
    admin_user: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Retrieve all users (Admin only)"""
    query = db.query(User)
    if is_approved is not None:
        query = query.filter(User.is_approved == is_approved)
    if company_id is not None:
        query = query.filter(User.company_id == company_id)
    elif exclude_corporate:
        from app.models.company import Company
        query = query.outerjoin(Company, User.company_id == Company.id).filter(
            (User.company_id.is_(None)) | 
            (Company.company_name.like("% (Customer)")) | 
            (Company.company_name.like("Customer %"))
        )
    users = query.offset(skip).limit(limit).all()
    return users

@router.put("/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: UUID,
    db: Session = Depends(deps.get_db),
    admin_user: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Approve a user (Admin only)"""
    user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    user.is_approved = True  # type: ignore
    user.is_active = True  # type: ignore
    user.status = "ACTIVE"  # type: ignore
    db.commit()
    db.refresh(user)
    
    # Notify customer
    create_notification(
        db=db,
        user_id=user.auth_id,  # type: ignore
        title="Registration Approved",
        message="Your workspace registration has been approved. Welcome!",
        type="success"
    )
    
    return user

@router.put("/{user_id}/reject", response_model=UserResponse)
def reject_user(
    user_id: UUID,
    reason: Optional[str] = Body(None, embed=True),
    db: Session = Depends(deps.get_db),
    admin_user: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Reject a user, removing them from the system (Admin only)"""
    user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    user_data = UserResponse.model_validate(user)
    
    auth_user = db.query(AuthUser).filter(AuthUser.id == user.auth_id).first()
    if auth_user:
        # Create notification before deletion (will be cascaded, but logging it)
        create_notification(
            db=db,
            user_id=auth_user.id,  # type: ignore
            title="Registration Rejected",
            message=f"Your registration has been rejected. Reason: {reason or 'Not specified'}",
            type="error"
        )
        db.delete(auth_user)
        db.commit()
    return user_data

@router.put("/{user_id}/inactive", response_model=UserResponse)
def make_user_inactive(
    user_id: UUID,
    db: Session = Depends(deps.get_db),
    admin_user: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Make a user inactive (Admin only)"""
    user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    user.status = "INACTIVE"  # type: ignore
    user.is_active = False  # type: ignore
    db.commit()
    db.refresh(user)
    
    # Notify customer of deactivation
    create_notification(
        db=db,
        user_id=user.auth_id,  # type: ignore
        title="Account Deactivated",
        message="Your NerdShive account has been deactivated by the Superuser. You cannot log in until your account is activated again.",
        type="warning"
    )
    return user

@router.put("/{user_id}/activate", response_model=UserResponse)
def activate_user(
    user_id: UUID,
    db: Session = Depends(deps.get_db),
    admin_user: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Activate a user (Admin only)"""
    user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    user.status = "ACTIVE"  # type: ignore
    user.is_active = True  # type: ignore
    db.commit()
    db.refresh(user)
    
    # Notify customer of activation
    create_notification(
        db=db,
        user_id=user.auth_id,  # type: ignore
        title="Account Activated",
        message="Your NerdShive account has been been activated. You can now log in to NerdShive.",
        type="success"
    )
    return user

@router.post("/", response_model=UserResponse)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Create a new user profile linked to an authenticated user (Owner only)."""
    # Ensure current user is the one they're creating the profile for
    if current_user.id != user_in.auth_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create profile for a different authenticated user."
        )
    
    # Check if user profile already exists
    db_user = db.query(User).filter(User.auth_id == current_user.id).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="A profile already exists for this authenticated user."
        )
        
    # Backend input validation
    validate_name_str(user_in.full_name, "Full Name")
    validate_email_str(user_in.email)
    validate_phone_str(user_in.mobile)
    
    if user_in.govt_id_type:
        id_type_upper = user_in.govt_id_type.upper()
        if id_type_upper == "AADHAAR":
            validate_aadhaar_str(user_in.govt_id_number)
        elif id_type_upper == "PAN":
            validate_pan_str(user_in.govt_id_number)
        elif id_type_upper == "OTHER":
            if not user_in.govt_id_number or len(user_in.govt_id_number.strip()) < 3:
                raise HTTPException(status_code=400, detail="ID number must be at least 3 characters long.")
                
    if user_in.reimbursement:
        if not user_in.org_name or not user_in.org_name.strip():
            raise HTTPException(status_code=400, detail="Organization Name is required for reimbursement.")
        if not user_in.org_location or not user_in.org_location.strip():
            raise HTTPException(status_code=400, detail="Organization Location is required for reimbursement.")
        validate_gst_str(user_in.gst_number)

    # Duplicate Validation Check
    # 1. Email check
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="A user with this Email already exists.")
    # 2. Mobile check
    if db.query(User).filter(User.mobile == user_in.mobile).first():
        raise HTTPException(status_code=400, detail="A user with this Mobile number already exists.")
    # 3. Aadhaar / PAN check
    if user_in.govt_id_type and user_in.govt_id_number:
        id_type_upper = user_in.govt_id_type.upper()
        id_number_clean = user_in.govt_id_number.strip()
        if id_type_upper == "AADHAAR":
            existing = db.query(User).filter(
                User.govt_id_type == "AADHAAR",
                User.govt_id_number == id_number_clean
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="A user with this Aadhaar number already exists.")
        elif id_type_upper == "PAN":
            existing = db.query(User).filter(
                User.govt_id_type == "PAN",
                User.govt_id_number == id_number_clean.upper()
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="A user with this PAN card already exists.")
        
    db_user = User(
        auth_id=user_in.auth_id,
        email=user_in.email,
        full_name=user_in.full_name,
        gender=user_in.gender,
        mobile=user_in.mobile,
        city=user_in.city,
        location=user_in.location,
        occupation=user_in.occupation,
        govt_id_type=user_in.govt_id_type or "",
        govt_id_number=user_in.govt_id_number or "",
        govt_id_copy_url=user_in.govt_id_copy_url,
        customer_photo_url=user_in.customer_photo_url,
        reimbursement=user_in.reimbursement,
        org_name=user_in.org_name or "",
        gst_number=user_in.gst_number,
        org_location=user_in.org_location,
        emergency_contact_number="",
        is_approved=False,
        is_active=True,
        status="ACTIVE"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Notify admins
    notify_admins(
        db=db,
        title="New Registration Request",
        message=f"New user registration request from {db_user.full_name}",
        type="info"
    )
    
    return db_user

@router.get("/{user_id}", response_model=UserResponse)
def read_user_by_id(
    user_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Get user profile by id or auth_id (Owner, Admin, or Superuser only)."""
    db_user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    # Check if admin/superuser
    is_admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
    is_superuser = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    
    if current_user.id != db_user.auth_id and not is_admin and not is_superuser:
        raise HTTPException(status_code=403, detail="Not enough privileges")
        
    return db_user

@router.post("/delete")
def delete_specific_user(
    *,
    db: Session = Depends(deps.get_db),
    delete_in: UserDeleteSchema,
    superuser_user: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Delete a specific user (Superuser only)."""
    auth_user = db.query(AuthUser).filter(AuthUser.id == delete_in.user_auth_id).first()
    if not auth_user:
        raise HTTPException(status_code=404, detail="AuthUser not found")
    
    # Prevent self-deletion
    if superuser_user.id == auth_user.id:
        raise HTTPException(status_code=400, detail="Superusers cannot delete themselves via this endpoint.")
        
    db.delete(auth_user)
    db.commit()
    return {"msg": "User deleted successfully"}

@router.delete("/")
def delete_all_users(
    db: Session = Depends(deps.get_db),
    superuser_user: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Bulk delete all non-admin and non-superuser AuthUser records (Superuser only)."""
    admins_ids = db.query(Admin.auth_id)
    superuser_ids = db.query(Superuser.auth_id)
    
    users_to_delete = db.query(AuthUser).filter(
        ~AuthUser.id.in_(admins_ids),
        ~AuthUser.id.in_(superuser_ids)
    ).all()
    
    count = len(users_to_delete)
    for u in users_to_delete:
        db.delete(u)
        
    db.commit()
    return {"msg": f"Successfully deleted {count} user(s)"}


class BulkEnrollInput(BaseModel):
    csvData: str
    fileName: Optional[str] = "bulk_enrollment.csv"

# Security patterns to detect injection attempts
INJECTION_PATTERNS = [
    re.compile(r"(\b(DROP|CREATE|ALTER|EXEC|TRUNCATE)\s+(TABLE|DATABASE|INDEX|PROCEDURE)\b)", re.IGNORECASE),
    re.compile(r"<script[\s\S]*?>[\s\S]*?</script>", re.IGNORECASE),
    re.compile(r"<\s*on\w+\s*=", re.IGNORECASE),
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"<\s*(iframe|object|embed|form|link|meta)\b", re.IGNORECASE)
]

def has_injection(value: str) -> bool:
    if not value:
        return False
    return any(pattern.search(value) for pattern in INJECTION_PATTERNS)

def sanitize_input(input_val: str) -> str:
    if not input_val:
        return ""
    return re.sub(r"<[^>]*>", "", input_val).strip()

def validate_email(email: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))

def validate_phone(phone: str) -> bool:
    digits = re.sub(r"\D", "", phone)
    return 8 <= len(digits) <= 15


