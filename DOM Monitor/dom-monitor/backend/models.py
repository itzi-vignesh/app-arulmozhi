import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    monitors = relationship("Monitor", back_populates="user", cascade="all, delete-orphan")

class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    page_title = Column(String, nullable=True)
    selector = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    text_snapshot = Column(String, nullable=True)
    last_value = Column(String, nullable=True)
    last_notified_value = Column(String, nullable=True)
    last_page_screenshot_path = Column(String, nullable=True)
    last_element_screenshot_path = Column(String, nullable=True)
    last_bounding_box_json = Column(String, nullable=True)
    selector_confidence = Column(String, default="LOW") # HIGH, MEDIUM, LOW
    interaction_steps = Column(String, nullable=True, default="[]")
    monitor_mode = Column(String, default="server")
    monitor_type = Column(String, default="element")
    image_url = Column(String, nullable=True)
    status = Column(String, default="active") # active, paused, failed
    check_interval = Column(Integer, default=60) # seconds
    next_check_at = Column(DateTime, default=datetime.utcnow)
    last_checked_at = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="monitors")
    change_events = relationship("ChangeEvent", back_populates="monitor", cascade="all, delete-orphan")

class ChangeEvent(Base):
    __tablename__ = "change_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    monitor_id = Column(String, ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    change_type = Column(String, nullable=False) # numeric, text, mixed
    diff_summary = Column(String, nullable=True)
    old_page_screenshot_path = Column(String, nullable=True)
    new_page_screenshot_path = Column(String, nullable=True)
    old_element_screenshot_path = Column(String, nullable=True)
    new_element_screenshot_path = Column(String, nullable=True)
    changed_fragment = Column(String, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    monitor = relationship("Monitor", back_populates="change_events")
