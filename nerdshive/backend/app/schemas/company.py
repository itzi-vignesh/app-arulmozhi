from pydantic import BaseModel, EmailStr, UUID4, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Company Schemas ---

class SeatRequestSchema(BaseModel):
    id: UUID4
    company_id: UUID4
    invoice_id: Optional[UUID4] = None
    current_seats: int
    requested_seats: int
    status: str
    created_at: datetime
    updated_at: datetime
    verified_by: Optional[UUID4] = None
    verified_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    transaction_reference: Optional[str] = None
    verification_notes: Optional[str] = None
    approved_by: Optional[UUID4] = None
    approved_at: Optional[datetime] = None
    remarks: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class CompanyBase(BaseModel):
    company_name: str
    gst_number: Optional[str] = None
    industry_type: Optional[str] = None
    company_email: str
    company_website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    max_employee_capacity: Optional[int] = 0
    seats_requested: Optional[int] = 0
    max_seats_required: Optional[int] = 0
    seats_required: Optional[int] = 0
    allow_future_seat_requests: Optional[bool] = False
    seat_allocation_permission_requested: Optional[bool] = False
    biometric_required: Optional[bool] = False
    biometric_requested: Optional[bool] = False
    biometric_status: Optional[str] = "NOT_REQUESTED"
    company_registration_doc_url: Optional[str] = None
    gst_cert_doc_url: Optional[str] = None
    auth_signatory_id_url: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = None
    selected_plan_id: Optional[UUID4] = None
    subscription_status: Optional[str] = "ACTIVE"
    plan_selected_at: Optional[datetime] = None
    active_seat_request: Optional[SeatRequestSchema] = None
    seat_upgrade_invoice_status: Optional[str] = "None"
    seat_upgrade_invoice_number: Optional[str] = None
    seat_upgrade_invoice_payment_status: Optional[str] = None
    seat_upgrade_invoice_status_str: Optional[str] = None
    seat_upgrade_invoice_is_voided: Optional[bool] = False
    company_logo_url: Optional[str] = None

class CompanyCreate(CompanyBase):
    # Additional fields needed during registration for the admin
    admin_full_name: str
    admin_email: str
    admin_mobile: str
    admin_designation: Optional[str] = None
    admin_password: str

class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    seats_requested: Optional[int] = None
    max_employee_capacity: Optional[int] = None
    status: Optional[str] = None
    biometric_status: Optional[str] = None
    selected_plan_id: Optional[UUID4] = None
    subscription_status: Optional[str] = None
    plan_selected_at: Optional[datetime] = None
    allow_future_seat_requests: Optional[bool] = None
    seat_allocation_permission_requested: Optional[bool] = None

class CompanyInfoUpdate(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    company_email: EmailStr
    industry_type: Optional[str] = None
    admin_full_name: str
    admin_mobile: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gst_number: Optional[str] = None
    max_employee_capacity: Optional[int] = None
    seats_requested: Optional[int] = None
    biometric_required: Optional[bool] = None
    biometric_status: Optional[str] = None
    selected_plan_id: Optional[UUID4] = None
    allow_future_seat_requests: Optional[bool] = None
    seat_allocation_permission_requested: Optional[bool] = None
    company_logo_url: Optional[str] = None

class CompanyInfoResponse(CompanyBase):
    id: UUID4
    status: str
    created_at: datetime
    updated_at: datetime
    approved_by: Optional[UUID4] = None
    approved_by_name: Optional[str] = None
    approved_by_email: Optional[str] = None
    admin_full_name: Optional[str] = None
    admin_mobile: Optional[str] = None
    employees_added: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class CompanyAdminResponseMin(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class CompanyResponse(CompanyBase):
    id: UUID4
    status: str
    created_at: datetime
    updated_at: datetime
    approved_by: Optional[UUID4] = None
    approved_by_name: Optional[str] = None
    approved_by_email: Optional[str] = None
    admins: Optional[List[CompanyAdminResponseMin]] = None

    model_config = ConfigDict(from_attributes=True)

# --- Company Admin Schemas ---

class CompanyAdminBase(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    designation: Optional[str] = None

class CompanyAdminCreate(CompanyAdminBase):
    auth_id: UUID4
    company_id: UUID4

class CompanyAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    designation: Optional[str] = None

class CompanyAdminResponse(CompanyAdminBase):
    id: UUID4
    auth_id: UUID4
    company_id: UUID4
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BulkEnrollmentRequest(BaseModel):
    employees: List[dict] # list of dicts from CSV

class DashboardStatsResponse(BaseModel):
    total_employees: int
    active_employees: int
    checked_in_today: int
    seats_requested: int
    seats_available: int
    pending_requests: int
    max_employee_capacity: int
    biometric_status: str
