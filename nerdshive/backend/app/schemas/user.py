from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator

# ---- AuthUser Schemas ----
class AuthUserBase(BaseModel):
    email: str
    is_active: bool = True

class AuthUserCreate(AuthUserBase):
    password: str = Field(..., min_length=8)

class AuthUserResponse(AuthUserBase):
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ---- User (Customer) Schemas ----
class UserBase(BaseModel):
    email: str
    full_name: str
    mobile: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = ""
    
    org_name: Optional[str] = ""
    department: Optional[str] = None
    designation: Optional[str] = None
    employee_id: Optional[str] = None
    joining_date: Optional[date] = None
    duration: Optional[str] = None
    
    govt_id_type: Optional[str] = ""
    govt_id_number: Optional[str] = ""
    
    requires_parking: bool = False
    vehicle_type: Optional[str] = None
    vehicle_brand_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_registration: Optional[str] = None
    
    enrollment_source: str = "self_registered"
    
    # New fields
    city: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    govt_id_copy_url: Optional[str] = None
    reimbursement: bool = False
    gst_number: Optional[str] = None
    org_location: Optional[str] = None
    status: str = "ACTIVE"

class UserCreate(BaseModel):
    auth_id: UUID
    email: str
    full_name: str
    mobile: str
    gender: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    govt_id_type: Optional[str] = None
    govt_id_number: Optional[str] = None
    govt_id_copy_url: Optional[str] = None
    customer_photo_url: Optional[str] = None
    reimbursement: bool = False
    org_name: Optional[str] = None
    gst_number: Optional[str] = None
    org_location: Optional[str] = None

    @field_validator('govt_id_type', mode='before')
    @classmethod
    def validate_govt_id_type(cls, v: Any) -> Any:
        if v is None or v == "":
            return v
        val = str(v).strip().upper()
        if val not in {"AADHAAR", "PAN", "OTHER"}:
            raise ValueError("Government ID type must be AADHAAR, PAN, or OTHER")
        return val

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    govt_id_type: Optional[str] = None
    govt_id_number: Optional[str] = None
    govt_id_copy_url: Optional[str] = None
    customer_photo_url: Optional[str] = None
    reimbursement: Optional[bool] = None
    org_name: Optional[str] = None
    gst_number: Optional[str] = None
    org_location: Optional[str] = None
    date_of_birth: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    requires_parking: Optional[bool] = None
    vehicle_type: Optional[str] = None
    vehicle_brand_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_registration: Optional[str] = None

    @field_validator('govt_id_type', mode='before')
    @classmethod
    def validate_govt_id_type(cls, v: Any) -> Any:
        if v is None or v == "":
            return v
        val = str(v).strip().upper()
        allowed_legacy = {"AADHAAR", "PAN", "OTHER", "PASSPORT", "VOTER", "DRIVING", "DRIVING_LICENSE", "VOTER_ID", "ANY OTHER ID PROOF"}
        if val not in allowed_legacy:
            raise ValueError("Government ID type must be AADHAAR, PAN, or OTHER")
        return val

class UserResponse(UserBase):
    id: UUID
    auth_id: UUID
    customer_id: Optional[str] = None
    customer_photo_url: Optional[str] = None
    is_approved: bool
    is_active: bool
    status: str = "ACTIVE"
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

# ---- Admin & Superuser Schemas ----
class AdminBase(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None

class AdminCreate(AdminBase):
    email: EmailStr
    password: str = Field(..., min_length=6)

class AdminResponse(AdminBase):
    id: UUID
    auth_id: UUID
    email: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def extract_email(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            # It's an ORM object
            email_val = getattr(data, 'email', None)
            if email_val is not None:
                # Get company details if they exist (for company admins)
                company = getattr(data, 'company', None)
                company_city = getattr(company, 'city', None) if company else None
                company_name = getattr(company, 'company_name', None) if company else None
                
                # Check for designation field mapping to occupation (for company admins)
                occupation = getattr(data, "designation", getattr(data, "occupation", None))
                
                return {
                    "id": getattr(data, "id", None),
                    "auth_id": getattr(data, "auth_id", None),
                    "full_name": getattr(data, "full_name", None),
                    "mobile": getattr(data, "mobile", None),
                    "city": company_city or getattr(data, "city", None),
                    "location": company_name or getattr(data, "location", None),
                    "occupation": occupation,
                    "created_at": getattr(data, "created_at", None),
                    "email": email_val
                }
        return data


# ---- Finance Schemas ----
class FinanceBase(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    status: str = "active"
    permissions: Optional[List[str]] = []

class FinanceCreate(FinanceBase):
    email: EmailStr
    password: str = Field(..., min_length=6)

class FinanceUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[str] = None
    status: Optional[str] = None
    permissions: Optional[List[str]] = None

class FinanceResponse(FinanceBase):
    id: UUID
    auth_id: UUID
    email: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def extract_email(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            # It's an ORM object
            email_val = getattr(data, 'email', None)
            if email_val is not None:
                return {
                    "id": getattr(data, "id", None),
                    "auth_id": getattr(data, "auth_id", None),
                    "full_name": getattr(data, "full_name", None),
                    "mobile": getattr(data, "mobile", None),
                    "city": getattr(data, "city", None),
                    "location": getattr(data, "location", None),
                    "occupation": getattr(data, "occupation", None),
                    "status": getattr(data, "status", "active"),
                    "permissions": getattr(data, "permissions", []),
                    "created_at": getattr(data, "created_at", None),
                    "email": email_val
                }
        return data

# ---- MFA Schemas ----
class MfaSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str

class MfaVerifyRequest(BaseModel):
    code: str

class MfaLoginRequest(BaseModel):
    mfa_token: str
    code: str

class MfaDisableRequest(BaseModel):
    password: str
    code: str

class MfaStatusResponse(BaseModel):
    mfa_enabled: bool
    enrollment_status: str
    mfa_remind_after: Optional[datetime] = None
    mfa_reminder_count: int = 0

class MfaPolicyUpdate(BaseModel):
    mfa_policy: Dict[str, bool]

