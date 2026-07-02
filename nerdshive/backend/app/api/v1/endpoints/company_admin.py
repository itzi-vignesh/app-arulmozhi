from typing import Any, List, Optional, cast
from fastapi import APIRouter, Depends, HTTPException, status as fastapi_status, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.api import deps
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser, User
from app.models.business import Checkin, SeatRequest
from app.models.audit import BiometricSyncHistory
from app.core.config import settings
from app.services.biometric import sync_biometric_data
from app.schemas.company import DashboardStatsResponse, CompanyInfoResponse, CompanyInfoUpdate
from app.schemas.user import UserResponse
from datetime import datetime, date, timezone
import logging
import re
from uuid import UUID
from pydantic import BaseModel
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

def generate_password(name: str, dob: Optional[date]) -> str:
    clean_name = re.sub(r"[^a-zA-Z]", "", name)
    if dob:
        day = str(dob.day).zfill(2)
        month = str(dob.month).zfill(2)
        year = str(dob.year)
        return f"{clean_name}{day}{month}{year}"
    return "TempPassword123!"

class EmployeeEnrollmentSchema(BaseModel):
    employee_id: str
    full_name: str
    gender: str
    date_of_birth: date
    mobile: str
    email: str
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    department: str
    designation: str
    joining_date: date
    duration: str
    govt_id_type: str
    govt_id_number: str
    requires_parking: bool
    vehicle_type: Optional[str] = None
    vehicle_brand_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_registration: Optional[str] = None

class EmployeeUpdateSchema(BaseModel):
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    duration: Optional[str] = None
    govt_id_type: Optional[str] = None
    govt_id_number: Optional[str] = None
    requires_parking: Optional[bool] = None
    vehicle_type: Optional[str] = None
    vehicle_brand_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_registration: Optional[str] = None
    is_active: Optional[bool] = None

router = APIRouter()

@router.get("/my-company", response_model=CompanyInfoResponse)
def get_my_company(
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    company = db.query(Company).filter(Company.id == admin_profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    total_employees = db.query(User).filter(User.company_id == company.id).count()
    
    company_dict = company.__dict__.copy()
    company_dict.pop('_sa_instance_state', None)
    
    # Attach properties for CompanyInfoResponse
    company_dict['active_seat_request'] = company.active_seat_request
    company_dict['seat_upgrade_invoice_status'] = company.seat_upgrade_invoice_status
    company_dict['seat_upgrade_invoice_number'] = company.seat_upgrade_invoice_number
    company_dict['seat_upgrade_invoice_payment_status'] = company.seat_upgrade_invoice_payment_status
    company_dict['seat_upgrade_invoice_status_str'] = company.seat_upgrade_invoice_status_str
    company_dict['seat_upgrade_invoice_is_voided'] = company.seat_upgrade_invoice_is_voided
    
    company_dict['admin_full_name'] = admin_profile.full_name
    company_dict['admin_mobile'] = admin_profile.mobile
    company_dict['employees_added'] = total_employees
    company_dict['approved_by_name'] = company.approved_by_name
    company_dict['approved_by_email'] = company.approved_by_email
    return company_dict

@router.put("/my-company", response_model=CompanyInfoResponse)
def update_my_company(
    request: CompanyInfoUpdate,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    from app.api.v1.endpoints.invoices import verify_no_overdue_payment
    verify_no_overdue_payment(db, current_admin)
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    company = db.query(Company).filter(Company.id == admin_profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Centralized validations
    from app.api.validators import (
        validate_company_name_str, validate_website_str, validate_email_str,
        validate_pincode_str, validate_gst_str, validate_name_str, validate_phone_str
    )
    validate_company_name_str(request.company_name, "Company Name")
    validate_website_str(request.company_website, "Company Website")
    validate_email_str(request.company_email, "Company Email")
    validate_pincode_str(request.pincode, "PIN Code")
    validate_gst_str(request.gst_number, "GST Number")
    validate_name_str(request.admin_full_name, "Admin Full Name")
    validate_phone_str(request.admin_mobile, "Admin Mobile Number")
    
    if not request.address or not request.address.strip():
        raise HTTPException(status_code=400, detail="Company Registered Address is required.")
    if not request.city or not request.city.strip():
        raise HTTPException(status_code=400, detail="City is required.")
    if not request.state or not request.state.strip():
        raise HTTPException(status_code=400, detail="State is required.")
        
    if request.company_email.lower().strip() != company.company_email.lower().strip():
        existing_email = db.query(Company).filter(Company.company_email == request.company_email.lower().strip()).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Company Email already registered by another company.")
            
    if request.gst_number and request.gst_number.strip().upper() != (company.gst_number or "").strip().upper():
        existing_gst = db.query(Company).filter(Company.gst_number == request.gst_number.strip().upper()).first()
        if existing_gst:
            raise HTTPException(status_code=400, detail="A company with this GST number already exists.")
            
    if request.seats_requested is not None:
        if request.seats_requested <= 0:
            raise HTTPException(status_code=400, detail="Seats requested must be greater than zero.")
        total_employees = db.query(User).filter(User.company_id == company.id).count()
        if request.seats_requested < total_employees:
            raise HTTPException(status_code=400, detail=f"Seat allocation cannot be reduced below the current number of registered employees ({total_employees}).")
    
    company.company_name = request.company_name  # type: ignore
    company.company_website = request.company_website  # type: ignore
    company.company_email = request.company_email  # type: ignore
    company.industry_type = request.industry_type  # type: ignore
    company.address = request.address  # type: ignore
    company.city = request.city  # type: ignore
    company.state = request.state  # type: ignore
    company.pincode = request.pincode  # type: ignore
    company.gst_number = request.gst_number  # type: ignore
    company.company_logo_url = request.company_logo_url  # type: ignore
    # Do NOT let company admin directly update max_employee_capacity or biometric_required
    if request.seats_requested is not None and request.seats_requested != company.max_employee_capacity:
        if not company.allow_future_seat_requests:
            raise HTTPException(
                status_code=403,
                detail="Organization does not have permission to modify seat allocation."
            )
        
        from app.models.business import SeatRequest
        active_req = db.query(SeatRequest).filter(
            SeatRequest.company_id == company.id,
            SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED", "PAYMENT_VERIFIED"])
        ).first()
        if active_req:
            raise HTTPException(
                status_code=400,
                detail="A seat upgrade request is already in progress."
            )

        total_employees = db.query(User).filter(User.company_id == company.id).count()
        if request.seats_requested < company.max_employee_capacity:
            # Reduction validation
            if request.seats_requested < total_employees:
                raise HTTPException(
                    status_code=400,
                    detail="Seat allocation cannot be reduced below the current number of registered employees."
                )
            title_text = "Seat Allocation Reduction Request"
            message_text = f"Company {company.company_name} requested a reduction from {company.max_employee_capacity} seats to {request.seats_requested} seats."
        else:
            # Increase
            title_text = "Seat Allocation Increase Request"
            message_text = f"Company {company.company_name} requested an increase from {company.max_employee_capacity} seats to {request.seats_requested} seats."
            
        from app.models.audit import Notification
        # Notify admins
        admins_list = db.query(AuthUser).filter(AuthUser.admin_profile.has()).all()
        for admin_user in admins_list:
            notif = Notification(
                user_id=admin_user.id,
                title=title_text,
                message=message_text,
                type="info"
            )
            db.add(notif)
            
        # Notify superusers
        superusers_list = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
        for su in superusers_list:
            notif = Notification(
                user_id=su.id,
                title=title_text,
                message=message_text,
                type="info"
            )
            db.add(notif)

        # Delete any existing pending seat request notifications for this admin
        db.query(Notification).filter(
            Notification.user_id == current_admin.id,
            Notification.title == "Seat Request Submitted"
        ).delete()

        import uuid
        from datetime import timedelta
        from app.models.business import Invoice, PricingPlan

        change = request.seats_requested - company.max_employee_capacity
        if change != 0:
            # Create a SeatRequest record in PENDING state
            seat_req = SeatRequest(
                id=uuid.uuid4(),
                company_id=company.id,
                current_seats=company.max_employee_capacity,
                requested_seats=request.seats_requested,
                status="PENDING",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(seat_req)
            db.flush()  # to obtain seat_req.id

            if change > 0:
                # Log target transition (Seat Request Created)
                log_notif = Notification(
                    user_id=current_admin.id,
                    title="Seat Request Submitted",
                    message=f"You have requested to increase seat capacity to {request.seats_requested}.",
                    type="info"
                )
                db.add(log_notif)

                # Automatic invoice generation for seat increase
                plan = None
                if company.selected_plan_id:
                    plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
                
                if plan:
                    price_per_seat = float(cast(Any, plan.price))
                    subtotal = price_per_seat * change

                    from app.api.v1.endpoints.invoices import get_current_template_snapshot_and_version, generate_invoice_number
                    config, version = get_current_template_snapshot_and_version(db)
                    config = cast(dict, config)

                    # Tax calculations
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

                    # Fetch latest invoice to copy billing period dates
                    latest_inv = db.query(Invoice).filter(
                        Invoice.company_id == company.id
                    ).order_by(Invoice.invoice_date.desc()).first()

                    if latest_inv:
                        billing_start = latest_inv.billing_start_date
                        billing_end = latest_inv.billing_end_date
                        due_date = latest_inv.due_date
                        invoice_date = latest_inv.invoice_date
                    else:
                        invoice_date = date.today()
                        billing_start = invoice_date
                        billing_type_lower = plan.billing_type.lower()
                        if billing_type_lower in ("day", "daily"):
                            billing_end = invoice_date
                        elif billing_type_lower in ("week", "weekly"):
                            billing_end = invoice_date + timedelta(days=6)
                        elif billing_type_lower in ("month", "monthly"):
                            today = date.today()
                            if today.month == 12:
                                next_month = date(today.year + 1, 1, 1)
                            else:
                                next_month = date(today.year, today.month + 1, 1)
                            billing_end = next_month - timedelta(days=1)
                        else:
                            billing_end = invoice_date + timedelta(days=30)
                        due_offset = int(config.get("invoice", {}).get("dueDateOffset", 7))
                        due_date = invoice_date + timedelta(days=due_offset)

                    # Generate sequential unique invoice number using template prefix
                    inv_num = generate_invoice_number(db, config)

                    new_inv_id = uuid.uuid4()
                    new_inv = Invoice(
                        id=new_inv_id,
                        company_id=company.id,
                        plan_name=f"{plan.plan_name} - Seat Upgrade",
                        billing_type=plan.billing_type,
                        price_per_seat=price_per_seat,
                        seats=change,
                        subtotal=subtotal,
                        gst_rate=tax_percent,
                        gst_amount=gst_amount,
                        total_amount=total_amount,
                        invoice_date=invoice_date,
                        status="unpaid",
                        created_at=datetime.now(timezone.utc),
                        invoice_number=inv_num,
                        billing_start_date=billing_start,
                        billing_end_date=billing_end,
                        due_date=due_date,
                        template_version=version,
                        template_snapshot=config
                    )
                    db.add(new_inv)

                    # Link the invoice to the seat request and transition status
                    seat_req.invoice_id = new_inv_id
                    seat_req.status = "INVOICE_GENERATED"

                    # Log notification to company admin
                    inv_msg = f"New Invoice Generated for Seat Upgrade\nInvoice #{inv_num}\nAmount ₹{total_amount:,.2f}"
                    inv_notif = Notification(
                        user_id=current_admin.id,
                        title="Invoice Generated",
                        message=inv_msg,
                        type="info"
                    )
                    db.add(inv_notif)

                    # Notify Finance users about new seat billing request
                    finance_list = db.query(AuthUser).filter(AuthUser.finance_profile.has()).all()
                    for fin in finance_list:
                        fin_notif = Notification(
                            user_id=fin.id,
                            title="New Seat Billing Request",
                            message=f"Company {company.company_name} has requested an increase of {change} seats. Invoice #{inv_num} is generated and pending payment.",
                            type="info"
                        )
                        db.add(fin_notif)
            else:
                # Log target transition (Seat Request Created for reduction)
                log_notif = Notification(
                    user_id=current_admin.id,
                    title="Seat Request Submitted",
                    message=f"You have requested to reduce seat capacity to {request.seats_requested}. Awaiting Superuser approval.",
                    type="info"
                )
                db.add(log_notif)

                # Notify superusers about the reduction request
                superusers_list = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
                for su in superusers_list:
                    su_notif = Notification(
                        user_id=su.id,
                        title="Seat Reduction Request",
                        message=f"Company {company.company_name} has requested a reduction from {company.max_employee_capacity} to {request.seats_requested} seats. Awaiting approval.",
                        type="info"
                    )
                    db.add(su_notif)

            # Update company's seats_requested only (Do NOT update max_employee_capacity yet)
            company.seats_requested = request.seats_requested

            # Create activity log for auditing
            from app.models.audit import ActivityLog
            name = admin_profile.full_name or "Company Admin"
            act_log = ActivityLog(
                action="Seat Request Created",
                performed_by=current_admin.id,
                performed_by_name=name,
                performed_by_role="COMPANY_ADMIN",
                details={
                    "company_id": str(company.id),
                    "company_name": company.company_name,
                    "previous_capacity": company.max_employee_capacity,
                    "requested_capacity": request.seats_requested,
                    "change": change
                }
            )
            db.add(act_log)
    
    admin_profile.full_name = request.admin_full_name  # type: ignore
    admin_profile.mobile = request.admin_mobile  # type: ignore
    
    if request.selected_plan_id is not None and company.selected_plan_id != request.selected_plan_id:
        company.selected_plan_id = request.selected_plan_id
        company.plan_selected_at = datetime.now(timezone.utc)
        company.subscription_status = "PAYMENT_PENDING"
        
        # Trigger invoice generation immediately
        from app.api.v1.endpoints.invoices import sync_company_invoices
        sync_company_invoices(db, company)
    
    db.commit()
    db.refresh(company)
    db.refresh(admin_profile)
    
    total_employees = db.query(User).filter(User.company_id == company.id).count()
    
    company_dict = company.__dict__.copy()
    company_dict.pop('_sa_instance_state', None)
    
    # Attach properties for CompanyInfoResponse
    company_dict['active_seat_request'] = company.active_seat_request
    company_dict['seat_upgrade_invoice_status'] = company.seat_upgrade_invoice_status
    company_dict['seat_upgrade_invoice_number'] = company.seat_upgrade_invoice_number
    company_dict['seat_upgrade_invoice_payment_status'] = company.seat_upgrade_invoice_payment_status
    company_dict['seat_upgrade_invoice_status_str'] = company.seat_upgrade_invoice_status_str
    company_dict['seat_upgrade_invoice_is_voided'] = company.seat_upgrade_invoice_is_voided
    
    company_dict['admin_full_name'] = admin_profile.full_name
    company_dict['admin_mobile'] = admin_profile.mobile
    company_dict['employees_added'] = total_employees
    company_dict['approved_by_name'] = company.approved_by_name
    company_dict['approved_by_email'] = company.approved_by_email
    return company_dict


@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    company_id = admin_profile.company_id
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    total_employees = db.query(User).filter(User.company_id == company_id).count()
    active_employees = db.query(User).filter(User.company_id == company_id, User.is_active == True).count()
    
    # Checkins today
    today = date.today()
    checked_in_today = db.query(Checkin).join(User).filter(
        User.company_id == company_id,
        func.date(Checkin.checkin_time) == today,
        func.lower(Checkin.status).in_(["checked_in", "present", "checked_out"])
    ).count()
    
    seats_approved = company.max_employee_capacity or 0
    seats_available = seats_approved - total_employees
    if seats_available < 0:
        seats_available = 0
        
    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "checked_in_today": checked_in_today,
        "seats_requested": company.seats_requested or 0,
        "seats_available": seats_available,
        "pending_requests": 0,
        "max_employee_capacity": company.max_employee_capacity or 0,
        "biometric_status": company.biometric_status or "NOT_REQUESTED"
    }

def format_employee_response(employee: User) -> dict:
    emp_data = {c.name: getattr(employee, c.name) for c in employee.__table__.columns}
    desig = emp_data.get("designation")
    dept = emp_data.get("department")
    if (not desig or not desig.strip()) and (dept and dept.strip().upper().endswith("INT")):
        emp_data["designation"] = "Intern"
    return emp_data

@router.get("/employees", response_model=List[UserResponse])
def get_employees(
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    employees = db.query(User).filter(User.company_id == admin_profile.company_id).order_by(User.created_at.asc()).all()
    return [format_employee_response(e) for e in employees]

@router.post("/employees", response_model=UserResponse)
def create_employee(
    employee_in: EmployeeEnrollmentSchema,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    from app.api.v1.endpoints.invoices import verify_no_overdue_payment
    verify_no_overdue_payment(db, current_admin)
    
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    company = db.query(Company).filter(Company.id == admin_profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Centralized validations
    from app.api.validators import (
        validate_name_str, validate_email_str, validate_phone_str,
        validate_dob, validate_joining_date, validate_emergency_contact,
        validate_vehicle_details, validate_aadhaar_str, validate_pan_str
    )
    validate_name_str(employee_in.full_name, "Full Name")
    validate_email_str(employee_in.email)
    validate_phone_str(employee_in.mobile)
    validate_dob(employee_in.date_of_birth)
    validate_joining_date(employee_in.joining_date, employee_in.date_of_birth)
    validate_emergency_contact(employee_in.emergency_contact_name, employee_in.emergency_contact_number)
    validate_vehicle_details(
        employee_in.requires_parking,
        employee_in.vehicle_type,
        employee_in.vehicle_brand_model,
        employee_in.vehicle_color,
        employee_in.vehicle_registration
    )
    
    id_type = employee_in.govt_id_type.upper()
    if id_type == "AADHAAR":
        validate_aadhaar_str(employee_in.govt_id_number)
    elif id_type == "PAN":
        validate_pan_str(employee_in.govt_id_number)
    elif id_type == "OTHER":
        if not employee_in.govt_id_number or len(employee_in.govt_id_number.strip()) < 3:
            raise HTTPException(status_code=400, detail="ID number must be at least 3 characters long.")
    else:
        raise HTTPException(status_code=400, detail="Government ID type must be AADHAAR, PAN, or OTHER")

    total_employees = db.query(User).filter(User.company_id == company.id).count()
    seats_available = (company.max_employee_capacity or 0) - total_employees
    if seats_available <= 0:
        raise HTTPException(status_code=400, detail="Enrollment exceeds available company seats. Please request a seat capacity increase.")
        
    email = employee_in.email.lower().strip()
    existing_auth = db.query(AuthUser).filter(AuthUser.email == email).first()
    if existing_auth:
        raise HTTPException(status_code=400, detail="Email is already registered.")
        
    existing_emp_id = db.query(User).filter(User.employee_id == employee_in.employee_id, User.company_id == company.id).first()
    if existing_emp_id:
        raise HTTPException(status_code=400, detail="Employee ID already exists.")
        
    password = generate_password(employee_in.full_name, employee_in.date_of_birth)
    
    new_auth = AuthUser(
        email=email,
        hashed_password=get_password_hash(password),
        is_active=True
    )
    db.add(new_auth)
    db.flush()
    
    next_val = db.execute(text("SELECT nextval('customer_id_seq')")).scalar()
    customer_id = f"NH-{datetime.now().year}-{str(next_val).zfill(5)}"
    
    new_user = User(
        auth_id=new_auth.id,
        email=email,
        full_name=employee_in.full_name,
        gender=employee_in.gender,
        date_of_birth=employee_in.date_of_birth,
        mobile=employee_in.mobile,
        emergency_contact_name=employee_in.emergency_contact_name,
        emergency_contact_number=employee_in.emergency_contact_number,
        org_name=company.company_name,
        company_id=company.id,
        department=employee_in.department,
        designation=employee_in.designation,
        employee_id=employee_in.employee_id,
        joining_date=employee_in.joining_date,
        duration=employee_in.duration.lower() or "permanent",
        govt_id_type=employee_in.govt_id_type.upper(),
        govt_id_number=employee_in.govt_id_number,
        requires_parking=employee_in.requires_parking,
        vehicle_type=employee_in.vehicle_type,
        vehicle_brand_model=employee_in.vehicle_brand_model,
        vehicle_color=employee_in.vehicle_color,
        vehicle_registration=employee_in.vehicle_registration,
        customer_id=customer_id,
        enrollment_source="individual_enrollment",
        is_approved=True,
        is_active=True,
        status="ACTIVE"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return format_employee_response(new_user)

@router.get("/employees/{employee_id}", response_model=UserResponse)
def get_employee_by_id(
    employee_id: UUID,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    employee = db.query(User).filter(User.id == employee_id, User.company_id == admin_profile.company_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return format_employee_response(employee)

@router.put("/employees/{employee_id}", response_model=UserResponse)
def update_employee(
    employee_id: UUID,
    employee_in: EmployeeUpdateSchema,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
        
    employee = db.query(User).filter(User.id == employee_id, User.company_id == admin_profile.company_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Centralized validations
    from app.api.validators import (
        validate_name_str, validate_email_str, validate_phone_str,
        validate_dob, validate_joining_date, validate_emergency_contact,
        validate_vehicle_details, validate_aadhaar_str, validate_pan_str
    )
    if employee_in.full_name is not None:
        validate_name_str(employee_in.full_name, "Full Name")
    if employee_in.email is not None:
        validate_email_str(employee_in.email)
    if employee_in.mobile is not None:
        validate_phone_str(employee_in.mobile)
    
    dob = employee_in.date_of_birth if employee_in.date_of_birth is not None else employee.date_of_birth
    joining = employee_in.joining_date if employee_in.joining_date is not None else employee.joining_date
    
    if employee_in.date_of_birth is not None:
        validate_dob(employee_in.date_of_birth)
    if employee_in.joining_date is not None or employee_in.date_of_birth is not None:
        validate_joining_date(joining, dob)
        
    if employee_in.emergency_contact_name is not None or employee_in.emergency_contact_number is not None:
        e_name = employee_in.emergency_contact_name if employee_in.emergency_contact_name is not None else employee.emergency_contact_name
        e_number = employee_in.emergency_contact_number if employee_in.emergency_contact_number is not None else employee.emergency_contact_number
        validate_emergency_contact(e_name, e_number)
        
    if (employee_in.requires_parking is not None or 
        employee_in.vehicle_type is not None or 
        employee_in.vehicle_brand_model is not None or 
        employee_in.vehicle_color is not None or 
        employee_in.vehicle_registration is not None):
        
        req_parking = employee_in.requires_parking if employee_in.requires_parking is not None else employee.requires_parking
        v_type = employee_in.vehicle_type if employee_in.vehicle_type is not None else employee.vehicle_type
        v_brand = employee_in.vehicle_brand_model if employee_in.vehicle_brand_model is not None else employee.vehicle_brand_model
        v_color = employee_in.vehicle_color if employee_in.vehicle_color is not None else employee.vehicle_color
        v_reg = employee_in.vehicle_registration if employee_in.vehicle_registration is not None else employee.vehicle_registration
        
        validate_vehicle_details(req_parking, v_type, v_brand, v_color, v_reg)
        
    if employee_in.govt_id_type is not None or employee_in.govt_id_number is not None:
        g_type = employee_in.govt_id_type if employee_in.govt_id_type is not None else employee.govt_id_type
        g_number = employee_in.govt_id_number if employee_in.govt_id_number is not None else employee.govt_id_number
        
        if g_type:
            g_type_upper = g_type.upper()
            if g_type_upper == "AADHAAR":
                validate_aadhaar_str(g_number)
            elif g_type_upper == "PAN":
                validate_pan_str(g_number)
            elif g_type_upper == "OTHER":
                if not g_number or len(g_number.strip()) < 3:
                    raise HTTPException(status_code=400, detail="ID number must be at least 3 characters long.")
            else:
                raise HTTPException(status_code=400, detail="Government ID type must be AADHAAR, PAN, or OTHER")
        
    if employee_in.email and employee_in.email.lower().strip() != employee.email.lower():
        new_email = employee_in.email.lower().strip()
        existing = db.query(AuthUser).filter(AuthUser.email == new_email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        employee.email = new_email
        auth_user = db.query(AuthUser).filter(AuthUser.id == employee.auth_id).first()
        if auth_user:
            auth_user.email = new_email
            
    if employee_in.employee_id and employee_in.employee_id != employee.employee_id:
        existing_emp_id = db.query(User).filter(User.employee_id == employee_in.employee_id, User.company_id == admin_profile.company_id).first()
        if existing_emp_id:
            raise HTTPException(status_code=400, detail="Employee ID already exists")
        employee.employee_id = employee_in.employee_id
        
    if employee_in.full_name is not None:
        employee.full_name = employee_in.full_name
    if employee_in.gender is not None:
        employee.gender = employee_in.gender
    if employee_in.date_of_birth is not None:
        employee.date_of_birth = employee_in.date_of_birth
    if employee_in.mobile is not None:
        employee.mobile = employee_in.mobile
    if employee_in.emergency_contact_name is not None:
        employee.emergency_contact_name = employee_in.emergency_contact_name
    if employee_in.emergency_contact_number is not None:
        employee.emergency_contact_number = employee_in.emergency_contact_number
    if employee_in.department is not None:
        employee.department = employee_in.department
    if employee_in.designation is not None:
        employee.designation = employee_in.designation
    if employee_in.joining_date is not None:
        employee.joining_date = employee_in.joining_date
    if employee_in.duration is not None:
        employee.duration = employee_in.duration.lower()
    if employee_in.govt_id_type is not None:
        employee.govt_id_type = employee_in.govt_id_type.upper()
    if employee_in.govt_id_number is not None:
        employee.govt_id_number = employee_in.govt_id_number
    if employee_in.is_active is not None:
        employee.is_active = employee_in.is_active
        
    if employee_in.requires_parking is not None:
        employee.requires_parking = employee_in.requires_parking
        if not employee_in.requires_parking:
            employee.vehicle_type = None
            employee.vehicle_brand_model = None
            employee.vehicle_color = None
            employee.vehicle_registration = None
        else:
            if employee_in.vehicle_type is not None:
                employee.vehicle_type = employee_in.vehicle_type
            if employee_in.vehicle_brand_model is not None:
                employee.vehicle_brand_model = employee_in.vehicle_brand_model
            if employee_in.vehicle_color is not None:
                employee.vehicle_color = employee_in.vehicle_color
            if employee_in.vehicle_registration is not None:
                employee.vehicle_registration = employee_in.vehicle_registration
                
    db.commit()
    db.refresh(employee)
    return format_employee_response(employee)

@router.delete("/employees/{employee_id}")
def delete_employee(
    employee_id: UUID,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    employee = db.query(User).filter(User.id == employee_id, User.company_id == admin_profile.company_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    employee_name = employee.full_name
    company_id = employee.company_id
    
    from app.models.company import Company
    company = db.query(Company).filter(Company.id == company_id).first()
    company_name = company.company_name if company else "Unknown Company"
    
    title_text = f"Employee Deleted: {employee_name}"
    message_text = f"Employee {employee_name} has been permanently deleted from {company_name}."
    
    from app.models.audit import Notification
    
    superusers_list = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
    for su in superusers_list:
        notif = Notification(
            user_id=su.id,
            title=title_text,
            message=message_text,
            type="info"
        )
        db.add(notif)
        
    admins_list = db.query(AuthUser).filter(AuthUser.admin_profile.has()).all()
    for admin_user in admins_list:
        notif = Notification(
            user_id=admin_user.id,
            title=title_text,
            message=message_text,
            type="info"
        )
        db.add(notif)
        
    company_admins = db.query(CompanyAdmin).filter(CompanyAdmin.company_id == company_id).all()
    for ca in company_admins:
        notif = Notification(
            user_id=ca.auth_id,
            title=title_text,
            message=message_text,
            type="info"
        )
        db.add(notif)
        
    auth_user = db.query(AuthUser).filter(AuthUser.id == employee.auth_id).first()
    if auth_user:
        db.delete(auth_user)
    else:
        db.delete(employee)
        
    db.commit()
    return {"message": "Employee deleted successfully"}

@router.get("/attendance")
async def get_attendance(
    response: Response,
    date: Optional[str] = None,
    force: Optional[bool] = False,
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    # 1. Resolve date
    if not date:
        date_str = datetime.now().strftime("%Y-%m-%d")
    else:
        date_str = date.strip()

    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    
    # 2. Parse query date
    from datetime import datetime as dt_class
    try:
        query_date = dt_class.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        query_date = dt_class.now().date()
        date_str = query_date.strftime("%Y-%m-%d")

    # 3. Retrieve company employees once to build a fast lookup map
    employees = db.query(User).filter(User.company_id == admin_profile.company_id).all()
    employee_map = {emp.employee_id.strip(): emp for emp in employees if emp.employee_id}

    # 4. Fetch logs directly from the biometric API on the fly
    from app.services.biometric import fetch_biometric_logs, validate_biometric_response, parse_biometric_datetime
    
    base_url = settings.BIOMETRIC_API_URL.rstrip('/')
    token = settings.BIOMETRIC_API_KEY
    masked_token = f"{token[:8]}...{token[-4:]}" if token and len(token) > 12 else str(token)
    api_url = f"{base_url}/biometric/api/{masked_token}/attendance/daily-log"
    received_count = 0
    records = []
    
    try:
        raw_data = await fetch_biometric_logs(date_str)
        is_valid, err_msg = validate_biometric_response(raw_data)
        if not is_valid:
            logger.error(f"Response validation failed: {err_msg}")
            raise ValueError(f"Invalid API response layout: {err_msg}")
        
        records = raw_data.get("records", [])
        received_count = len(records)
    except Exception as e:
        logger.exception("Direct biometric API call failed with complete exception:")
        raise HTTPException(
            status_code=fastapi_status.HTTP_502_BAD_GATEWAY,
            detail=f"Biometric API is currently unavailable: {str(e)}"
        )

    # 5. Process and filter attendance records against the logged-in company's employees
    result = []
    for rec in records:
        pin = str(rec.get("pin", "")).strip()
        user = employee_map.get(pin)
        if not user:
            continue

        # Check if the record is a better match for a different user with the same pin
        other_users = db.query(User).filter(User.employee_id == pin, User.id != user.id).all()
        if other_users:
            # We have duplicate pins in the system. Check if the record's department or name matches our user
            dept = rec.get("department", "").strip().lower()
            name = rec.get("name", "").strip().lower()
            
            # Let's count matching score for our user vs other users
            def get_match_score(u):
                score = 0
                u_dept = (u.department or "").strip().lower()
                u_name = (u.full_name or "").strip().lower()
                if dept and u_dept == dept:
                    score += 10
                if name and (u_name == name or name in u_name or u_name in name):
                    score += 5
                return score
            
            our_score = get_match_score(user)
            best_other_score = max([get_match_score(ou) for ou in other_users]) if other_users else 0
            if best_other_score > our_score:
                # The record is a better match for someone else, skip it!
                continue

        # Match found! Parse check-in/out datetime objects
        checkin_time = parse_biometric_datetime(date_str, rec.get("first_in"))
        checkout_time = parse_biometric_datetime(date_str, rec.get("last_out"))
        
        # Parse float working hours
        working_hours = None
        wh_raw = rec.get("total_hours")
        if wh_raw is not None:
            try:
                working_hours = float(wh_raw)
            except (ValueError, TypeError):
                pass

        attendance_status = rec.get("status", "Present")
        
        # If employee is marked Absent with no checkin times, clear the parse values
        if not rec.get("first_in") and attendance_status.lower() == "absent":
            checkin_time = None
            checkout_time = None
            
        punch_log = rec.get("punch_log")
        # If punch_log is missing or invalid, construct a basic punch list from first_in and last_out
        if not punch_log or not isinstance(punch_log, list):
            punch_log = []
            if rec.get("first_in"):
                punch_log.append({"time": rec.get("first_in"), "type": "in"})
            if rec.get("last_out"):
                punch_log.append({"time": rec.get("last_out"), "type": "out"})
                
        credits = rec.get("credits")

        raw_desig = user.designation
        raw_dept = user.department
        desig = str(raw_desig) if raw_desig is not None else ""
        dept = str(raw_dept) if raw_dept is not None else ""
        if (not desig or not desig.strip()) and (dept and dept.strip().upper().endswith("INT")):
            desig = "Intern"

        result.append({
            "id": str(user.id),
            "employee_name": user.full_name,
            "employee_code": user.employee_id,
            "department": dept,
            "designation": desig,
            "checkin_time": checkin_time,
            "checkout_time": checkout_time,
            "status": attendance_status,
            "working_hours": working_hours,
            "punch_log": punch_log,
            "credits": credits
        })

    metrics_log = (
        f"Biometric Scoped Request Metrics:\n"
        f"  - API URL called: {api_url}\n"
        f"  - Requested date: {date_str}\n"
        f"  - Total API records received: {received_count}\n"
        f"  - Company employee lookup size: {len(employee_map)}\n"
        f"  - Scoped records returned to frontend: {len(result)}"
    )
    logger.info(metrics_log)
    print(metrics_log, flush=True)

    return result

@router.post("/request-seat-permission", response_model=CompanyInfoResponse)
def request_seat_permission(
    db: Session = Depends(deps.get_db),
    current_admin: AuthUser = Depends(deps.get_current_company_admin)
) -> Any:
    """Request permission to modify future seats allocation (Company Admin only)"""
    from app.api.v1.endpoints.invoices import verify_no_overdue_payment
    verify_no_overdue_payment(db, current_admin)
    admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_admin.id).first()
    if not admin_profile:
        raise HTTPException(status_code=403, detail="Admin profile not found")
    company = db.query(Company).filter(Company.id == admin_profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    if company.allow_future_seat_requests:
        raise HTTPException(status_code=400, detail="Permission to modify seat allocation is already granted.")
    if company.seat_allocation_permission_requested:
        raise HTTPException(status_code=400, detail="A permission request is already pending.")
        
    company.seat_allocation_permission_requested = True
    
    from app.models.audit import Notification
    # Notify admins
    admins_list = db.query(AuthUser).filter(AuthUser.admin_profile.has()).all()
    for admin_user in admins_list:
        notif = Notification(
            user_id=admin_user.id,
            title="Seat Allocation Access Request",
            message=f"Company {company.company_name} requested permission to modify seat allocation.",
            type="info"
        )
        db.add(notif)
        
    # Notify superusers
    superusers_list = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
    for su in superusers_list:
        notif = Notification(
            user_id=su.id,
            title="Seat Allocation Access Request",
            message=f"Company {company.company_name} requested permission to modify seat allocation.",
            type="info"
        )
        db.add(notif)
        
    db.commit()
    db.refresh(company)
    
    total_employees = db.query(User).filter(User.company_id == company.id).count()
    company_dict = company.__dict__.copy()
    company_dict.pop('_sa_instance_state', None)
    company_dict['admin_full_name'] = admin_profile.full_name
    company_dict['admin_mobile'] = admin_profile.mobile
    company_dict['employees_added'] = total_employees
    company_dict['approved_by_name'] = company.approved_by_name
    company_dict['approved_by_email'] = company.approved_by_email
    return company_dict
