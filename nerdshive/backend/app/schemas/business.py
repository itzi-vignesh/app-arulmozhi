from typing import Optional, List
from datetime import datetime, date, timezone
from uuid import UUID
from pydantic import BaseModel, field_validator
from decimal import Decimal

# ---- Plan Schemas ----
class PlanBase(BaseModel):
    plan_type: str
    amount: Decimal
    start_date: date
    end_date: date

class PlanCreate(PlanBase):
    user_id: UUID

class PlanUpdate(BaseModel):
    is_active: Optional[bool] = None
    payment_verified: Optional[bool] = None

class PlanResponse(PlanBase):
    id: UUID
    user_id: UUID
    is_active: bool
    payment_verified: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

# ---- Checkin Schemas ----
class CheckinBase(BaseModel):
    pass

class CheckinCreate(CheckinBase):
    user_id: UUID
    plan_id: Optional[UUID] = None

class CheckinUpdate(BaseModel):
    checkin_time: Optional[datetime] = None
    checkout_time: Optional[datetime] = None
    status: Optional[str] = None
    checkin_approved: Optional[bool] = None

class CheckinResponse(CheckinBase):
    id: UUID
    user_id: UUID
    plan_id: Optional[UUID] = None
    checkin_time: Optional[datetime] = None
    checkout_time: Optional[datetime] = None
    checkin_approved: bool
    checkin_approved_by: Optional[UUID] = None
    checkin_approved_at: Optional[datetime] = None
    status: str
    payment_status: str
    payment_rejection_date: Optional[datetime] = None
    expired: bool
    working_hours: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    @field_validator(
        "checkin_time",
        "checkout_time",
        "checkin_approved_at",
        "payment_rejection_date",
        "created_at",
        "updated_at",
        mode="after"
    )
    @classmethod
    def ensure_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v
    
    model_config = {"from_attributes": True}

# ---- Pricing Schemas ----
class PricingBase(BaseModel):
    plan_type: str
    amount: Decimal
    gst_rate: Decimal

class PricingCreate(PricingBase):
    pass

class PricingUpdate(PricingBase):
    pass

class PricingResponse(PricingBase):
    id: UUID
    updated_by: Optional[UUID] = None
    updated_at: datetime
    
    model_config = {"from_attributes": True}

# Add nested users and plans
from app.schemas.user import UserBase
class CheckinResponseNested(CheckinResponse):
    user: Optional[UserBase] = None
    plan: Optional[PlanResponse] = None
    model_config = {'from_attributes': True, 'populate_by_name': True}

