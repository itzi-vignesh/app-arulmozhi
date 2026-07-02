from fastapi import APIRouter, Depends, Body, HTTPException, Query
from typing import Any, List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.models.user import AuthUser, Admin
from app.schemas.user import AdminResponse, AdminCreate
from app.core.security import get_password_hash
from app.services.notification import notify_admins

router = APIRouter()

@router.post("/invite", response_model=AdminResponse)
def invite_admin(
    invite_in: AdminCreate,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    # Centralized validations
    from app.api.validators import validate_email_str, validate_password_str
    validate_email_str(invite_in.email)
    validate_password_str(invite_in.password)
    
    existing = db.query(AuthUser).filter(AuthUser.email == invite_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create AuthUser for Admin
    print(f"Creating AuthUser for admin {invite_in.email}")
    new_auth = AuthUser(
        email=invite_in.email,
        hashed_password=get_password_hash(invite_in.password), 
        is_active=True
    )
    db.add(new_auth)
    db.flush() # get ID
    
    print(f"Creating Admin profile for {invite_in.email}")
    new_admin = Admin(auth_id=new_auth.id, full_name=invite_in.full_name)
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    print(f"Admin creation successful: {new_admin.id}")
    
    notify_admins(
        db=db,
        title="New Admin Created",
        message=f"Superuser has created a new admin account for {invite_in.email}.",
        type="info"
    )
    
    return new_admin

@router.get("/", response_model=List[AdminResponse])
def get_admins(
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
) -> Any:
    """List all admins"""
    skip = (page - 1) * limit
    return db.query(Admin).order_by(desc(Admin.created_at)).offset(skip).limit(limit).all()

@router.delete("/")
def delete_all_admins(
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Bulk delete all Admin records (Superuser only)."""
    admin_records = db.query(Admin).all()
    count = len(admin_records)
    
    for admin in admin_records:
        auth_user = db.query(AuthUser).filter(AuthUser.id == admin.auth_id).first()
        if auth_user and auth_user.id != superuser.id:
            db.delete(auth_user)
            
    db.commit()
    return {"msg": f"Successfully deleted {count} admin(s)"}

@router.get("/me", response_model=AdminResponse)
def read_admin_me(
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Get the current admin profile"""
    admin = db.query(Admin).filter(Admin.auth_id == current_admin.id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin profile not found")
    return admin

@router.delete("/{admin_id}")
def delete_specific_admin(
    admin_id: UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Delete a specific admin (Superuser only)"""
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    auth_user = db.query(AuthUser).filter(AuthUser.id == admin.auth_id).first()
    if auth_user:
        if auth_user.id == superuser.id:
            raise HTTPException(status_code=400, detail="Superusers cannot delete themselves.")
        db.delete(auth_user)
        db.commit()
        
        notify_admins(
            db=db,
            title="Admin Deleted",
            message=f"Superuser has deleted an admin account.",
            type="warning"
        )
        
    return {"msg": "Admin removed successfully"}
