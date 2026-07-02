from pydantic import BaseModel, UUID4, Field, field_validator
from typing import Optional, List
from datetime import datetime, date, time

# --- Meeting Room Schemas ---

class MeetingRoomBase(BaseModel):
    room_name: str
    capacity: int
    location: Optional[str] = None
    status: Optional[str] = "ACTIVE" # "ACTIVE", "INACTIVE"

    @field_validator('room_name')
    @classmethod
    def validate_room_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Room name cannot be empty.")
        return v.strip()

    @field_validator('capacity')
    @classmethod
    def validate_capacity(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Room capacity must be at least 1.")
        return v

class MeetingRoomCreate(MeetingRoomBase):
    pass

class MeetingRoomUpdate(BaseModel):
    room_name: Optional[str] = None
    capacity: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = None

    @field_validator('room_name')
    @classmethod
    def validate_room_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v or not v.strip()):
            raise ValueError("Room name cannot be empty.")
        return v.strip() if v is not None else None

    @field_validator('capacity')
    @classmethod
    def validate_capacity(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("Room capacity must be at least 1.")
        return v

class MeetingRoomResponse(MeetingRoomBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Meeting Request Schemas ---

class CompanyShortResponse(BaseModel):
    id: UUID4
    company_name: str
    company_email: str

    class Config:
        from_attributes = True

class MeetingRequestCreate(BaseModel):
    room_id: Optional[UUID4] = None
    meeting_title: str
    purpose: str
    meeting_date: date
    start_time: time
    end_time: time
    participants: int = 1
    department: Optional[str] = None
    notes: Optional[str] = None

    @field_validator('meeting_title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Meeting title cannot be empty.")
        return v.strip()

    @field_validator('purpose')
    @classmethod
    def validate_purpose(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Purpose of meeting is required.")
        return v.strip()

    @field_validator('participants')
    @classmethod
    def validate_participants(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Participants must be 1 or more.")
        return v

class MeetingRequestCancel(BaseModel):
    cancel_reason: Optional[str] = None

class ConflictingMeetingInfo(BaseModel):
    id: UUID4
    meeting_title: str
    start_time: time
    end_time: time
    company_name: str

    class Config:
        from_attributes = True

class MeetingRequestResponse(BaseModel):
    id: UUID4
    company_id: UUID4
    room_id: Optional[UUID4] = None
    meeting_title: str
    purpose: str
    meeting_date: date
    start_time: time
    end_time: time
    participants: int
    department: Optional[str] = None
    notes: Optional[str] = None
    status: str
    conflict_detected: bool
    decision_notes: Optional[str] = None
    approved_by: Optional[UUID4] = None
    approved_role: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[UUID4] = None
    rejected_role: Optional[str] = None
    rejected_at: Optional[datetime] = None
    cancelled_by: Optional[UUID4] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    company: Optional[CompanyShortResponse] = None
    room: Optional[MeetingRoomResponse] = None
    conflict_info: Optional[ConflictingMeetingInfo] = None

    class Config:
        from_attributes = True


class MeetingAvailabilityResponse(BaseModel):
    start_time: str
    end_time: str
    status: str  # "BOOKED" or "PENDING"

