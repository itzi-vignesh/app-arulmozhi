import uuid
from datetime import datetime
from typing import Optional, Any, cast, List, TYPE_CHECKING
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.models.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.user import AuthUser, User
    from app.models.business import PricingPlan

class Company(Base):
    __tablename__ = "companies"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    gst_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    industry_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_email: Mapped[str] = mapped_column(String, nullable=False)
    company_website: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_logo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    max_employee_capacity: Mapped[int] = mapped_column(Integer, default=0)
    seats_requested: Mapped[int] = mapped_column(Integer, default=0)
    allow_future_seat_requests: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    seat_allocation_permission_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    biometric_required: Mapped[bool] = mapped_column(Boolean, default=False)
    biometric_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    biometric_status: Mapped[str] = mapped_column(String, default="NOT_REQUESTED", nullable=False)
    
    # Deprecated fields kept for backward compatibility
    company_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    registration_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    
    company_registration_doc_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    gst_cert_doc_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    auth_signatory_id_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    documents: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    subscription_status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False)
    plan_selected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=True)
    selected_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("pricing_plans.id", ondelete="SET NULL"), nullable=True)
    
    approver: Mapped[Optional["AuthUser"]] = relationship("AuthUser", foreign_keys=[approved_by])
    selected_plan: Mapped[Optional["PricingPlan"]] = relationship("PricingPlan")

    @property
    def approved_by_name(self) -> Optional[str]:
        if not self.approver:
            return None
        if self.approver.superuser_profile:
            return self.approver.superuser_profile.full_name
        if self.approver.admin_profile:
            return self.approver.admin_profile.full_name
        if self.approver.company_admin_profile:
            return self.approver.company_admin_profile.full_name
        if self.approver.customer_profile:
            return self.approver.customer_profile.full_name
        return self.approver.email

    @property
    def approved_by_email(self) -> Optional[str]:
        return self.approver.email if self.approver else None
    
    @property
    def active_seat_request(self) -> Optional[Any]:
        from app.models.business import SeatRequest
        from sqlalchemy.orm import object_session
        session = object_session(self)
        if session:
            return session.query(SeatRequest).filter(
                SeatRequest.company_id == self.id,
                SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED", "PAYMENT_VERIFIED"])
            ).order_by(SeatRequest.created_at.desc()).first()
        return None

    @property
    def seat_upgrade_invoice_status(self) -> str:
        req = self.active_seat_request
        if req:
            return req.status
        
        from app.models.business import SeatRequest
        from sqlalchemy.orm import object_session
        session = object_session(self)
        if session:
            latest = session.query(SeatRequest).filter(
                SeatRequest.company_id == self.id
            ).order_by(SeatRequest.created_at.desc()).first()
            if latest:
                return str(latest.status)
        return "None"
    
    @property
    def seat_upgrade_invoice_number(self) -> Optional[str]:
        req = self.active_seat_request
        if req and req.invoice_id:
            from app.models.business import Invoice
            from sqlalchemy.orm import object_session
            session = object_session(self)
            if session:
                inv = session.query(Invoice).filter(Invoice.id == req.invoice_id).first()
                if inv:
                    return cast(Optional[str], inv.invoice_number)
        return None

    @property
    def seat_upgrade_invoice_payment_status(self) -> Optional[str]:
        req = self.active_seat_request
        if req and req.invoice_id:
            from app.models.business import Invoice
            from sqlalchemy.orm import object_session
            session = object_session(self)
            if session:
                inv = session.query(Invoice).filter(Invoice.id == req.invoice_id).first()
                if inv:
                    if inv.status == "paid":
                        return "Paid"
                    return "Unpaid"
        # For reductions, we return Paid so that the superuser Approve button is enabled
        change = (self.seats_requested or 0) - (self.max_employee_capacity or 0)
        if change <= 0:
            return "Paid"
        return "Unpaid"

    @property
    def seat_upgrade_invoice_status_str(self) -> Optional[str]:
        req = self.active_seat_request
        if req and req.invoice_id:
            from app.models.business import Invoice
            from sqlalchemy.orm import object_session
            session = object_session(self)
            if session:
                inv = session.query(Invoice).filter(Invoice.id == req.invoice_id).first()
                if inv:
                    if inv.invoice_status == "voided":
                        return "Voided"
                    return "Active"
        return "Active"

    @property
    def seat_upgrade_invoice_is_voided(self) -> bool:
        req = self.active_seat_request
        if req and req.invoice_id:
            from app.models.business import Invoice
            from sqlalchemy.orm import object_session
            session = object_session(self)
            if session:
                inv = session.query(Invoice).filter(Invoice.id == req.invoice_id).first()
                if inv:
                    return cast(bool, inv.invoice_status == "voided")
        return False
    
    admins: Mapped[List["CompanyAdmin"]] = relationship("CompanyAdmin", back_populates="company", cascade="all, delete-orphan")
    employees: Mapped[List["User"]] = relationship("User", back_populates="company")

class CompanyAdmin(Base):
    __tablename__ = "company_admins"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="CASCADE"), unique=True, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    
    auth: Mapped["AuthUser"] = relationship("AuthUser", back_populates="company_admin_profile")
    company: Mapped["Company"] = relationship("Company", back_populates="admins")
    
    @property
    def email(self):
        return self.auth.email if self.auth else None
