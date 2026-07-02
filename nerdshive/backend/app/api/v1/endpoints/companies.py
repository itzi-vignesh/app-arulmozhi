from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser, Admin
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.schemas.user import UserResponse
from app.models.audit import Notification
import uuid
from app.api.validators import (
    validate_name_str, validate_company_name_str, validate_email_str,
    validate_phone_str, validate_password_str, validate_gst_str,
    validate_pincode_str, validate_website_str
)

router = APIRouter()

import logging
logger = logging.getLogger(__name__)

@router.post("/register", response_model=CompanyResponse)
def register_company(
    *,
    db: Session = Depends(deps.get_db),
    company_in: CompanyCreate,
) -> Any:
    """Register a new company and create the initial company admin in pending state."""
    logger.info(f"Request received for company registration: {company_in.company_email}")
    logger.info(f"Payload received: {company_in.model_dump(exclude={'admin_password'})}")
    
    # 1. Input Format Validations
    validate_company_name_str(company_in.company_name, "Company Name")
    validate_email_str(company_in.company_email, "Company Email")
    validate_website_str(company_in.company_website, "Company Website")
    validate_gst_str(company_in.gst_number, "GST Number")
    
    validate_name_str(company_in.admin_full_name, "Admin Full Name")
    validate_email_str(company_in.admin_email, "Admin Email")
    validate_phone_str(company_in.admin_mobile, "Admin Mobile Number")
    validate_password_str(company_in.admin_password, "Admin Password")
    
    if not company_in.address or not company_in.address.strip():
        raise HTTPException(status_code=400, detail="Company Registered Address is required.")
    if not company_in.city or not company_in.city.strip():
        raise HTTPException(status_code=400, detail="City is required.")
    if not company_in.state or not company_in.state.strip():
        raise HTTPException(status_code=400, detail="State is required.")
    validate_pincode_str(company_in.pincode, "PIN Code")

    try:
        # 2. Duplicate Validations
        # A. Company Email check
        company = db.query(Company).filter(Company.company_email == company_in.company_email).first()
        if company:
            logger.warning(f"Validation error: Company with email {company_in.company_email} already exists")
            raise HTTPException(status_code=400, detail="Company with this email already exists")

        # B. Admin Email check
        auth_user = db.query(AuthUser).filter(AuthUser.email == company_in.admin_email).first()
        if auth_user:
            raise HTTPException(status_code=400, detail="An account with the admin email already exists.")

        # C. GST check
        if company_in.gst_number:
            existing_gst = db.query(Company).filter(Company.gst_number == company_in.gst_number.strip().upper()).first()
            if existing_gst:
                raise HTTPException(status_code=400, detail="A company with this GST number already exists.")

        # D. Admin Mobile (Company Mobile) check
        if company_in.admin_mobile:
            existing_mobile = db.query(CompanyAdmin).filter(CompanyAdmin.mobile == company_in.admin_mobile.strip()).first()
            if existing_mobile:
                raise HTTPException(status_code=400, detail="An account with this admin mobile number already exists.")

        # Create company
        company_data = company_in.model_dump(exclude={
            "admin_full_name",
            "admin_email",
            "admin_mobile",
            "admin_designation",
            "admin_password",
            "active_seat_request",
            "seat_upgrade_invoice_status",
            "seat_upgrade_invoice_number",
            "seat_upgrade_invoice_payment_status",
            "seat_upgrade_invoice_status_str",
            "seat_upgrade_invoice_is_voided",
        })
        
        # Map seats_required (initial approved seat allocation) to max_employee_capacity and seats_requested
        seats_required = company_data.get("seats_required", 0)
        company_data["max_employee_capacity"] = seats_required
        company_data["seats_requested"] = seats_required
        company_data["allow_future_seat_requests"] = company_data.get("allow_future_seat_requests", False)
        
        company_data.pop("max_seats_required", None)
        company_data.pop("seats_required", None)
        company_data["status"] = "pending"
        new_company = Company(**company_data)
        db.add(new_company)
        db.flush() # To get the company ID
        
        # Check if admin email is already in AuthUser
        auth_user = db.query(AuthUser).filter(AuthUser.email == company_in.admin_email).first()
        if auth_user:
            raise HTTPException(status_code=400, detail="An account with the admin email already exists.")
        
        from app.core.security import get_password_hash
        
        new_auth_user = AuthUser(
            email=company_in.admin_email,
            hashed_password=get_password_hash(company_in.admin_password),
            is_active=False # Pending approval
        )
        db.add(new_auth_user)
        db.flush()
        
        new_company_admin = CompanyAdmin(
            auth_id=new_auth_user.id,
            company_id=new_company.id,
            full_name=company_in.admin_full_name,
            mobile=company_in.admin_mobile,
            designation=company_in.admin_designation,
            is_active=False
        )
        db.add(new_company_admin)
        
        # Notify admins (read-only)
        admins = db.query(AuthUser).filter(AuthUser.admin_profile.has()).all()
        for admin_user in admins:
            notification_info = Notification(
                user_id=admin_user.id,
                title="New Company Registration Submitted",
                message="A new company registration request has been submitted.",
                type="info"
            )
            db.add(notification_info)
            logger.info(f"Notification inserted for Admin AuthUser ID {admin_user.id}: {notification_info.title}")

        # Notify superusers (actionable)
        superusers = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
        for su in superusers:
            notification_action = Notification(
                user_id=su.id,
                title="New Company Registration Requires Review",
                message=f"A new company registration request has been submitted and requires review.",
                type="info"
            )
            db.add(notification_action)
            logger.info(f"Notification inserted for Superuser AuthUser ID {su.id}: {notification_action.title}")
            
        db.commit()
        db.refresh(new_company)
        return new_company
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during registration: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An error occurred while saving the registration: {str(e)}")

@router.get("/", response_model=List[CompanyResponse])
def get_companies(
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Retrieve all companies (Superuser and Admin only)"""
    return db.query(Company).filter(
        ~Company.company_name.like("% (Customer)"),
        ~Company.company_name.like("Customer %")
    ).all()

@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Get company details"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Check permissions
    is_su = db.query(AuthUser).filter(AuthUser.id == current_user.id, AuthUser.superuser_profile.has()).first()
    is_ca = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id, CompanyAdmin.company_id == company_id).first()
    is_admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
    if not is_su and not is_ca and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this company")
        
    return company

@router.get("/{company_id}/employees", response_model=List[UserResponse])
def get_company_employees(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_admin)
) -> Any:
    """Get all employees for a specific company (Superuser and Admin only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company.employees

@router.put("/{company_id}/approve", response_model=CompanyResponse)
def approve_company(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Approve a company (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.status = "approved"  # type: ignore
    company.approved_by = superuser.id  # type: ignore
    
    if company.biometric_required:
        company.biometric_status = "APPROVED"  # type: ignore
        company.biometric_requested = True  # type: ignore
    
    # Activate the company admin
    admin = db.query(CompanyAdmin).filter(CompanyAdmin.company_id == company_id).first()
    if admin:
        admin.is_active = True  # type: ignore
        auth_user = db.query(AuthUser).filter(AuthUser.id == admin.auth_id).first()
        if auth_user:
            auth_user.is_active = True  # type: ignore
            
            notification = Notification(
                user_id=auth_user.id,
                title="Organization Approved",
                message=f"Your organization '{company.company_name}' has been approved."
            )
            db.add(notification)
            
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/reject", response_model=CompanyResponse)
def reject_company(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Reject a company (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.status = "rejected"  # type: ignore
    db.commit()
    db.refresh(company)
    return company

@router.post("/{company_id}/biometric-request", response_model=CompanyResponse)
def request_biometric_access(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Request biometric access for a company"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Check permissions
    is_su = db.query(AuthUser).filter(AuthUser.id == current_user.id, AuthUser.superuser_profile.has()).first()
    is_ca = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id, CompanyAdmin.company_id == company_id).first()
    if not is_su and not is_ca:
        raise HTTPException(status_code=403, detail="Not authorized to update this company")
        
    if company.biometric_status == "PENDING":
        raise HTTPException(status_code=400, detail="Biometric access request is already pending approval")
    if company.biometric_status == "APPROVED":
        raise HTTPException(status_code=400, detail="Biometric access is already approved")
        
    company.biometric_status = "PENDING"  # type: ignore
    company.biometric_requested = True # type: ignore
    
    # Notify admins
    admins = db.query(AuthUser).filter(AuthUser.admin_profile.has()).all()
    for admin_user in admins:
        notif = Notification(
            user_id=admin_user.id,
            title="Biometric Access Request",
            message=f"Company {company.company_name} has requested biometric attendance integration.",
            type="info"
        )
        db.add(notif)
        
    # Notify superusers
    superusers = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
    for su in superusers:
        notif = Notification(
            user_id=su.id,
            title="Biometric Access Request",
            message=f"Company {company.company_name} has requested biometric attendance integration.",
            type="info"
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/approve-seats", response_model=CompanyResponse)
def approve_seats_upgrade(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Approve a company's seats allocation request (Superuser only)"""
    from datetime import datetime, timezone
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    old_capacity = company.max_employee_capacity or 0
    new_capacity = company.seats_requested or 0
    change = new_capacity - old_capacity
    change_sign = f"+{change}" if change > 0 else f"{change}"
    
    from app.models.business import SeatRequest, Invoice
    seat_req = db.query(SeatRequest).filter(
        SeatRequest.company_id == company.id,
        SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED", "PAYMENT_VERIFIED"])
    ).order_by(SeatRequest.created_at.desc()).first()
    
    if not seat_req:
        raise HTTPException(
            status_code=400,
            detail="No pending seat upgrade request found for this company."
        )
        
    if seat_req.requested_seats > seat_req.current_seats:
        # Enforce payment checks on active invoice
        if not seat_req.invoice_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot approve seat upgrade request. No linked invoice found."
            )
        
        inv = db.query(Invoice).filter(Invoice.id == seat_req.invoice_id).first()
        if not inv:
            raise HTTPException(
                status_code=400,
                detail="Cannot approve seat upgrade request. Linked invoice not found."
            )
            
        if inv.invoice_status != "active":
            raise HTTPException(
                status_code=400,
                detail="Cannot approve seat upgrade request. The associated invoice has been voided."
            )
            
        # Allow approval without payment check
        pass

    # Update capacity to the requested seats
    company.max_employee_capacity = new_capacity
    company.seats_requested = new_capacity # Reset requested to capacity
    
    # Transition seat request to APPROVED
    seat_req.status = "APPROVED"
    seat_req.approved_by = superuser.id
    seat_req.approved_at = datetime.now(timezone.utc)
    
    # Notify the company admins
    for admin in company.admins:
        db.query(Notification).filter(
            Notification.user_id == admin.auth_id,
            Notification.title == "Seat Request Submitted"
        ).delete()
        notif = Notification(
            user_id=admin.auth_id,
            title=f"Seats Allocation Approved ({change_sign} Seats)",
            message="Your seat allocation request has been approved.",
            type="info"
        )
        db.add(notif)
        
    # Log approval audit
    from app.models.audit import ActivityLog
    from app.models.user import Superuser
    su_profile = db.query(Superuser).filter(Superuser.auth_id == superuser.id).first()
    name = su_profile.full_name if su_profile else "Superuser"
    act_log = ActivityLog(
        action="Seat Upgrade Approved",
        performed_by=superuser.id,
        performed_by_name=name,
        performed_by_role="SUPERUSER",
        details={
            "company_id": str(company.id),
            "company_name": company.company_name,
            "previous_capacity": old_capacity,
            "new_capacity": new_capacity,
            "approved_by": name
        }
    )
    db.add(act_log)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/reject-seats", response_model=CompanyResponse)
def reject_seats_upgrade(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Reject a company's seats allocation request (Superuser only)"""
    from datetime import datetime, timezone
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    old_capacity = company.max_employee_capacity or 0
    new_capacity = company.seats_requested or old_capacity
    change = new_capacity - old_capacity
    change_sign = f"+{change}" if change > 0 else f"{change}"

    from app.models.business import SeatRequest, Invoice
    seat_req = db.query(SeatRequest).filter(
        SeatRequest.company_id == company.id,
        SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED", "PAYMENT_VERIFIED"])
    ).order_by(SeatRequest.created_at.desc()).first()

    if seat_req:
        seat_req.status = "REJECTED"
        seat_req.approved_by = superuser.id
        seat_req.approved_at = datetime.now(timezone.utc)
        
        # Void invoice if unpaid
        if seat_req.invoice_id:
            inv = db.query(Invoice).filter(Invoice.id == seat_req.invoice_id).first()
            if inv and inv.status == "unpaid":
                inv.status = "void"  # type: ignore
                
    company.seats_requested = company.max_employee_capacity # Reset requested to capacity
    
    # Notify the company admins
    for admin in company.admins:
        db.query(Notification).filter(
            Notification.user_id == admin.auth_id,
            Notification.title == "Seat Request Submitted"
        ).delete()
        notif = Notification(
            user_id=admin.auth_id,
            title=f"Seats Allocation Rejected ({change_sign} Seats)",
            message="Your seat allocation request has been rejected.",
            type="info"
        )
        db.add(notif)
        
    # Log rejection audit
    from app.models.audit import ActivityLog
    from app.models.user import Superuser
    su_profile = db.query(Superuser).filter(Superuser.auth_id == superuser.id).first()
    name = su_profile.full_name if su_profile else "Superuser"
    act_log = ActivityLog(
        action="Seat Upgrade Rejected",
        performed_by=superuser.id,
        performed_by_name=name,
        performed_by_role="SUPERUSER",
        details={
            "company_id": str(company.id),
            "company_name": company.company_name,
            "previous_capacity": old_capacity,
            "requested_capacity": new_capacity,
            "rejected_by": str(superuser.id)
        }
    )
    db.add(act_log)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/approve-seat-permission", response_model=CompanyResponse)
def approve_seat_permission(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Approve a company's request to modify future seats allocation (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.allow_future_seat_requests = True
    company.seat_allocation_permission_requested = False
    
    # Notify the company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Permission Granted",
            message="Your organization can now request future seat allocation changes."
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/reject-seat-permission", response_model=CompanyResponse)
def reject_seat_permission(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Reject a company's request to modify future seats allocation (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.seat_allocation_permission_requested = False
    
    # Notify the company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Permission Rejected",
            message="Your request to modify seat allocation has been rejected."
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/biometric-approve", response_model=CompanyResponse)
def approve_biometric_request(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Approve a company's biometric access request (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.biometric_status = "APPROVED"  # type: ignore
    company.biometric_required = True  # type: ignore
    company.biometric_requested = True  # type: ignore
    
    # Notify company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Biometric Access Approved",
            message="Your biometric attendance request has been approved."
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/biometric-reject", response_model=CompanyResponse)
def reject_biometric_request(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Reject a company's biometric access request (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.biometric_status = "REJECTED"  # type: ignore
    company.biometric_required = False  # type: ignore
    company.biometric_requested = False  # type: ignore
    
    # Notify company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Biometric Access Rejected",
            message="Your biometric attendance request has been rejected."
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/biometric-disable", response_model=CompanyResponse)
def disable_biometric_request(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Disable a company's biometric access (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.biometric_status = "DISABLED"  # type: ignore
    company.biometric_required = False  # type: ignore
    company.biometric_requested = False  # type: ignore
    
    # Notify company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Biometric Access Disabled",
            message="Your biometric attendance has been disabled."
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    return company

@router.delete("/{company_id}")
def delete_company(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Delete a company and clean up all its admins' auth users (Superuser only)."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Extract admin auth IDs before deleting the company
    admin_auth_ids = [admin.auth_id for admin in company.admins]
    company_name = company.company_name
    
    # Delete the company
    db.delete(company)
    db.flush()
    
    # Delete associated AuthUsers for the company admins
    for auth_id in admin_auth_ids:
        auth_user = db.query(AuthUser).filter(AuthUser.id == auth_id).first()
        if auth_user:
            db.delete(auth_user)
            
    # Log the system activity
    from app.models.audit import ActivityLog
    log_entry = ActivityLog(
        action="company_deleted",
        performed_by=superuser.id,
        performed_by_name=superuser.superuser_profile.full_name if superuser.superuser_profile else "Superuser",
        performed_by_role="Superuser",
        details={
            "company_name": company_name,
            "company_id": str(company_id)
        }
    )
    db.add(log_entry)
            
    db.commit()
    return {"msg": f"Company '{company_name}' deleted successfully."}

@router.put("/{company_id}/suspend", response_model=CompanyResponse)
def suspend_company(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Suspend an approved company (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company.status = "suspended"  # type: ignore
    
    # Notify company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Company Suspended",
            message="Your corporate account has been suspended by the Superuser."
        )
        db.add(notif)
        
    # Log system activity
    from app.models.audit import ActivityLog
    log_entry = ActivityLog(
        action="company_suspended",
        performed_by=superuser.id,
        performed_by_name=superuser.superuser_profile.full_name if superuser.superuser_profile else "Superuser",
        performed_by_role="Superuser",
        details={
            "company_name": company.company_name,
            "company_id": str(company_id)
        }
    )
    db.add(log_entry)
    
    db.commit()
    db.refresh(company)
    return company

@router.put("/{company_id}/activate", response_model=CompanyResponse)
def activate_company(
    company_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    superuser: AuthUser = Depends(deps.get_current_superuser)
) -> Any:
    """Activate a suspended company (Superuser only)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company.status = "approved"  # type: ignore
    
    # Notify company admins
    for admin in company.admins:
        notif = Notification(
            user_id=admin.auth_id,
            title="Company Activated",
            message="Your corporate account has been activated/restored by the Superuser."
        )
        db.add(notif)
        
    # Log system activity
    from app.models.audit import ActivityLog
    log_entry = ActivityLog(
        action="company_activated",
        performed_by=superuser.id,
        performed_by_name=superuser.superuser_profile.full_name if superuser.superuser_profile else "Superuser",
        performed_by_role="Superuser",
        details={
            "company_name": company.company_name,
            "company_id": str(company_id)
        }
    )
    db.add(log_entry)
    
    db.commit()
    db.refresh(company)
    return company


