import uuid
from typing import Any, Optional, List, TYPE_CHECKING
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.models.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.business import Plan, Checkin

class AuthUser(Base):
    __tablename__ = "auth_users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    
    # MFA fields
    mfa_enrollment_status: Mapped[str] = mapped_column(String, default="NOT_STARTED", nullable=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mfa_enabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    backup_codes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mfa_remind_after: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    mfa_last_reminder: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    mfa_reminder_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_mfa_verification: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    customer_profile = relationship("User", back_populates="auth", uselist=False, cascade="all, delete-orphan")
    admin_profile = relationship("Admin", back_populates="auth", uselist=False, cascade="all, delete-orphan")
    superuser_profile = relationship("Superuser", back_populates="auth", uselist=False, cascade="all, delete-orphan")
    company_admin_profile = relationship("CompanyAdmin", back_populates="auth", uselist=False, cascade="all, delete-orphan")
    finance_profile = relationship("Finance", back_populates="auth", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class User(Base):
    """Customer profiles (originally public.users)"""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="CASCADE"), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False) # Duplicated from auth for easy querying
    
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    mobile: Mapped[str] = mapped_column(String, nullable=False)
    
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    emergency_contact_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    org_name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    employee_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    joining_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    duration: Mapped[Optional[str]] = mapped_column(String, nullable=True) # permanent/temporary
    
    govt_id_type: Mapped[str] = mapped_column(String, nullable=False)
    govt_id_number: Mapped[str] = mapped_column(String, nullable=False)
    
    requires_parking: Mapped[bool] = mapped_column(Boolean, default=False)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vehicle_brand_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vehicle_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vehicle_registration: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    customer_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    enrollment_source: Mapped[str] = mapped_column(String, default="self_registered")
    customer_photo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    govt_id_copy_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reimbursement: Mapped[bool] = mapped_column(Boolean, default=False)
    gst_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    org_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
    
    auth: Mapped["AuthUser"] = relationship("AuthUser", back_populates="customer_profile")
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="employees")
    plans: Mapped[List["Plan"]] = relationship("Plan", back_populates="user", cascade="all, delete-orphan")
    checkins: Mapped[List["Checkin"]] = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")

class Admin(Base):
    __tablename__ = "admins"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    
    auth: Mapped["AuthUser"] = relationship("AuthUser", back_populates="admin_profile")

    @property
    def email(self):
        return self.auth.email if self.auth else None

class Superuser(Base):
    __tablename__ = "superuser"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    
    auth: Mapped["AuthUser"] = relationship("AuthUser", back_populates="superuser_profile")

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

class Finance(Base):
    __tablename__ = "finance"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    permissions: Mapped[Optional[List[Any]]] = mapped_column(JSON, default=list, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    
    auth = relationship("AuthUser", back_populates="finance_profile")

    @property
    def email(self):
        return self.auth.email if self.auth else None