import uuid
from datetime import datetime, date, time
from typing import Any, Optional, TYPE_CHECKING
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, Date, Time, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.models.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import AuthUser

class MeetingRoom(Base):
    __tablename__ = "meeting_rooms"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False) # "ACTIVE", "INACTIVE"
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class MeetingRequest(Base):
    __tablename__ = "meeting_requests"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("meeting_rooms.id", ondelete="SET NULL"), nullable=True)
    
    meeting_title: Mapped[str] = mapped_column(String, nullable=False)
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    participants: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    status: Mapped[str] = mapped_column(String, default="PENDING", nullable=False) # "PENDING", "APPROVED", "REJECTED", "CANCELLED"
    conflict_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    decision_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    approved_role: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    rejected_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    rejected_role: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    
    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company")
    room: Mapped[Optional["MeetingRoom"]] = relationship("MeetingRoom")
    approver: Mapped[Optional["AuthUser"]] = relationship("AuthUser", foreign_keys=[approved_by])
    rejecter: Mapped[Optional["AuthUser"]] = relationship("AuthUser", foreign_keys=[rejected_by])
    canceler: Mapped[Optional["AuthUser"]] = relationship("AuthUser", foreign_keys=[cancelled_by])

    @property
    def conflict_info(self) -> Any:
        from sqlalchemy.orm import object_session
        session = object_session(self)
        if not session or not self.room_id:
            return None
        
        conflict = session.query(MeetingRequest).filter(
            MeetingRequest.status == "APPROVED",
            MeetingRequest.room_id == self.room_id,
            MeetingRequest.meeting_date == self.meeting_date,
            MeetingRequest.start_time < self.end_time,
            MeetingRequest.end_time > self.start_time,
            MeetingRequest.id != self.id
        ).first()
        
        if conflict:
            return {
                "id": conflict.id,
                "meeting_title": conflict.meeting_title,
                "start_time": conflict.start_time,
                "end_time": conflict.end_time,
                "company_name": conflict.company.company_name if conflict.company else "Unknown Company"
            }
        return None

