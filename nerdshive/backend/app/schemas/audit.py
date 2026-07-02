from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

# ---- Notification Schemas ----
class NotificationBase(BaseModel):
    title: str
    message: str
    type: str = "info"
    data: Optional[Dict[str, Any]] = None

class NotificationCreate(NotificationBase):
    user_id: UUID

class NotificationResponse(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ---- ActivityLog Schemas ----
class ActivityLogResponse(BaseModel):
    id: UUID
    action: str
    performed_by: Optional[UUID] = None
    performed_by_name: Optional[str] = None
    performed_by_role: Optional[str] = None
    target_user_id: Optional[UUID] = None
    target_user_name: Optional[str] = None
    target_user_email: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ---- UpdateLog Schemas ----
class UpdateLogCreate(BaseModel):
    message: str
    type: Optional[str] = None

class UpdateLogResponse(UpdateLogCreate):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ---- QueryLog Schemas ----
class QueryLogCreate(BaseModel):
    message: str

class QueryLogUser(BaseModel):
    full_name: str
    email: str

class QueryLogResponse(QueryLogCreate):
    id: UUID
    user_id: Optional[UUID] = None
    query_text: Optional[str] = None
    response: Optional[str] = None
    status: str
    created_at: datetime
    users: Optional[QueryLogUser] = None
    
    model_config = {"from_attributes": True}

# ---- UsageLog Schemas ----
class UsageLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {'from_attributes': True}


# ---- ContentSection Schemas ----
class ContentSectionCreate(BaseModel):
    section: str
    content: str

class ContentSectionResponse(ContentSectionCreate):
    id: UUID
    updated_at: datetime

    model_config = {'from_attributes': True}


class AdminTabViewCreate(BaseModel):
    tab_name: str


