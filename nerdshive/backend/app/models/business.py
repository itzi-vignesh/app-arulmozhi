import uuid
from datetime import datetime, date
from typing import Optional, TYPE_CHECKING, Any, cast
from sqlalchemy import Column, String, Boolean, Numeric, DateTime, Date, ForeignKey, JSON, Integer, event, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.models.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class Plan(Base):
    __tablename__ = "plans"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    plan_type: Mapped[str] = mapped_column(String, nullable=False) # 'day', 'week', 'month'
    amount: Mapped[Any] = mapped_column(Numeric, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    payment_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    user = relationship("User", back_populates="plans")
    checkins = relationship("Checkin", back_populates="plan", cascade="all, delete-orphan")

class Checkin(Base):
    __tablename__ = "checkins"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=True)
    
    checkin_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    checkout_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    checkin_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    checkin_approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    checkin_approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False) # 'pending', 'checked_in', 'checked_out'
    payment_status: Mapped[Optional[str]] = mapped_column(String, default="pending")
    payment_rejection_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expired: Mapped[bool] = mapped_column(Boolean, default=False)
    working_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    punch_log: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    credits: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    user: Mapped["User"] = relationship("User", back_populates="checkins")
    plan: Mapped[Optional["Plan"]] = relationship("Plan", back_populates="checkins")

class Pricing(Base):
    __tablename__ = "pricing"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_type: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    amount: Mapped[Any] = mapped_column(Numeric, nullable=False)
    gst_rate: Mapped[Any] = mapped_column(Numeric, default=18, nullable=False)
    
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

class PricingPlan(Base):
    __tablename__ = "pricing_plans"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String, nullable=False) # 'customer' or 'corporate'
    plan_name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    billing_type: Mapped[str] = mapped_column(String, nullable=False) # 'day', 'week', 'month', 'seat'
    features_json: Mapped[Any] = mapped_column(JSON, nullable=False) # list of features
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

class Invoice(Base):
    __tablename__ = "invoices"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    plan_name: Mapped[str] = mapped_column(String, nullable=False)
    billing_type: Mapped[str] = mapped_column(String, nullable=False)
    price_per_seat: Mapped[float] = mapped_column(Numeric, nullable=False)
    seats: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric, default=18, nullable=False)
    gst_amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, default="unpaid", nullable=False)  # 'unpaid', 'paid'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    
    invoice_number: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    billing_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    billing_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    invoice_status: Mapped[str] = mapped_column(String, default="active", nullable=False)  # 'active', 'voided'
    voided_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    void_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    notif_generated_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notif_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notif_due_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notif_overdue_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    template_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    template_snapshot: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    
    company: Mapped[Optional["Company"]] = relationship("Company")
    user: Mapped[Optional["User"]] = relationship("User")

    @property
    def owner_type(self) -> str:
        return "company" if self.company_id else "customer"

    @property
    def owner_name(self) -> str:
        name = "Unknown"
        if self.company:
            name = self.company.company_name
        elif self.user:
            name = self.user.full_name or self.user.email
            
        if name:
            for suffix in [" (Customer)", " (Company)", " (Individual Customer)"]:
                if name.endswith(suffix):
                    name = name[:-len(suffix)]
            if name.startswith("Customer "):
                name = name[len("Customer "):]
        return name

    @property
    def owner_email(self) -> str:
        if self.company:
            return self.company.company_email
        if self.user:
            return self.user.email
        return "Unknown"

    @property
    def owner_address(self) -> str:
        if self.company:
            name = cast(str, self.company.company_name or "")
            if name.endswith(" (Customer)") or name.startswith("Customer "):
                customer = self.user
                if not customer and self.company.employees:
                    customer = self.company.employees[0]
                if customer:
                    loc = cast(Optional[str], customer.location)
                    city = cast(Optional[str], customer.city)
                    parts = [loc, city]
                    addr = ", ".join(filter(None, parts))
                    return addr or "N/A"
            return cast(str, self.company.address or "N/A")
        if self.user:
            loc = cast(Optional[str], self.user.location)
            city = cast(Optional[str], self.user.city)
            parts = [loc, city]
            addr = ", ".join(filter(None, parts))
            return addr or "N/A"
        return "N/A"

    @property
    def owner_tax_number(self) -> Optional[str]:
        if self.company:
            return self.company.gst_number
        if self.user:
            return self.user.gst_number
        return None

    @property
    def owner(self) -> dict:
        return {
            "type": self.owner_type,
            "name": self.owner_name,
            "email": self.owner_email,
            "address": self.owner_address,
            "tax_number": self.owner_tax_number
        }

    @property
    def company_name(self) -> Optional[str]:
        return self.owner_name

    @property
    def company_gst_number(self) -> Optional[str]:
        return self.owner_tax_number

@event.listens_for(Invoice, 'before_insert')
@event.listens_for(Invoice, 'before_update')
def validate_invoice_ownership(mapper, connection, target):
    if (target.company_id is None) == (target.user_id is None):
        raise ValueError("Invoice must belong to either a Company or a User, but not both or neither.")


class Refund(Base):
    __tablename__ = "refunds"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[Any] = mapped_column(Numeric, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, approved, rejected
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    
    invoice = relationship("Invoice")


class SeatRequest(Base):
    __tablename__ = "seat_requests"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    
    current_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="PENDING", nullable=False)  # PENDING, INVOICE_GENERATED, PAYMENT_VERIFIED, APPROVED, REJECTED
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    # Finance verification
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    transaction_reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Superuser approval
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    company: Mapped["Company"] = relationship("Company")
    invoice: Mapped[Optional[Invoice]] = relationship("Invoice")


