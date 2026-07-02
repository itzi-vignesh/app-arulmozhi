from typing import Optional
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel, model_validator
from decimal import Decimal

class InvoiceOwner(BaseModel):
    type: str  # 'company' or 'customer'
    name: str
    email: str
    address: str
    tax_number: Optional[str] = None

class InvoiceBase(BaseModel):
    company_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    plan_name: str
    billing_type: str
    price_per_seat: Decimal
    seats: int
    subtotal: Decimal
    gst_rate: Decimal
    gst_amount: Decimal
    total_amount: Decimal
    invoice_date: date
    status: str # 'unpaid', 'paid'

    @model_validator(mode='after')
    def validate_ownership(self):
        if (self.company_id is None) == (self.user_id is None):
            raise ValueError("Invoice must belong to either a Company or a User, but not both or neither.")
        return self

class InvoiceResponse(InvoiceBase):
    id: UUID
    created_at: datetime
    invoice_number: Optional[str] = None
    company_name: Optional[str] = None
    company_gst_number: Optional[str] = None
    billing_start_date: Optional[date] = None
    billing_end_date: Optional[date] = None
    due_date: Optional[date] = None
    payment_date: Optional[datetime] = None
    invoice_status: str = "active"
    voided_by: Optional[UUID] = None
    voided_at: Optional[datetime] = None
    void_reason: Optional[str] = None
    template_version: Optional[int] = None
    template_snapshot: Optional[dict] = None
    owner: Optional[InvoiceOwner] = None

    model_config = {"from_attributes": True}


# ---- Refund Schemas ----
class RefundBase(BaseModel):
    invoice_id: UUID
    amount: Decimal
    reason: str
    status: str = "pending"

class RefundCreate(RefundBase):
    pass

class RefundResponse(RefundBase):
    id: UUID
    approved_by: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}
