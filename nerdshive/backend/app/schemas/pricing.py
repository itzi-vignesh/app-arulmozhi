from typing import Optional, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, field_validator
from decimal import Decimal

class PricingPlanBase(BaseModel):
    category: str # 'customer' or 'corporate'
    plan_name: str
    price: Decimal
    billing_type: str # 'day', 'week', 'month', 'seat'
    features_json: List[str]
    is_active: bool = True

    @field_validator('plan_name')
    @classmethod
    def validate_plan_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Plan Name is required and cannot be empty.")
        return v.strip()

    @field_validator('price')
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price must be non-negative.")
        return v

class PricingPlanCreate(PricingPlanBase):
    pass

class PricingPlanUpdate(BaseModel):
    category: Optional[str] = None
    plan_name: Optional[str] = None
    price: Optional[Decimal] = None
    billing_type: Optional[str] = None
    features_json: Optional[List[str]] = None
    is_active: Optional[bool] = None

    @field_validator('plan_name')
    @classmethod
    def validate_plan_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v or not v.strip()):
            raise ValueError("Plan Name cannot be empty.")
        return v.strip() if v is not None else None

    @field_validator('price')
    @classmethod
    def validate_price(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("Price must be non-negative.")
        return v

class PricingPlanResponse(PricingPlanBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
