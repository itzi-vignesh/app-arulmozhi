from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import json
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class MonitorRegister(BaseModel):
    name: str
    url: str
    page_title: Optional[str] = None
    selector: str
    tag: str
    initial_value: Optional[str] = ""
    text_snapshot: Optional[str] = ""
    selector_confidence: Optional[str] = "LOW"
    monitor_mode: str = "server"
    check_interval: Optional[int] = 60
    interaction_steps: Optional[list] = []
    monitor_type: str = "element"
    image_url: Optional[str] = None

def get_or_create_default_user(db: Session) -> models.User:
    """
    SaaS ready helper: fetches or creates a default user
    so monitors are linked to a user table from day one.
    """
    default_email = "default@dommonitor.com"
    user = db.query(models.User).filter(models.User.email == default_email).first()
    if not user:
        user = models.User(
            id="00000000-0000-0000-0000-000000000000",
            email=default_email,
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_monitor(payload: MonitorRegister, db: Session = Depends(get_db)):
    print("[REGISTER REQUEST RECEIVED]")
    print(payload)
    user = get_or_create_default_user(db)
    
    check_interval = payload.check_interval if payload.check_interval is not None else 60
    if check_interval < 10:
        check_interval = 10
    
    # Log received interaction_steps and image monitoring attributes
    received_steps = json.dumps(payload.interaction_steps) if payload.interaction_steps is not None else "[]"
    print(f"[REGISTER]\ninteraction_steps={received_steps}")
    print("[REGISTER] interaction_steps =", payload.interaction_steps)
    print("[REGISTER] monitor_type =", payload.monitor_type)
    print("[REGISTER] image_url =", payload.image_url)
    print("[REGISTER] check_interval =", check_interval)
    
    # Check if a monitor already exists for the given URL + selector for this user
    db_monitor = db.query(models.Monitor).filter(
        models.Monitor.user_id == user.id,
        models.Monitor.url == payload.url,
        models.Monitor.selector == payload.selector
    ).first()

    if db_monitor:
        # Update existing monitor initial value, snapshots, page_title, status
        db_monitor.name = payload.name
        db_monitor.page_title = payload.page_title
        db_monitor.tag = payload.tag
        db_monitor.text_snapshot = payload.text_snapshot
        db_monitor.last_value = payload.initial_value
        db_monitor.selector_confidence = payload.selector_confidence
        db_monitor.interaction_steps = json.dumps(payload.interaction_steps) if payload.interaction_steps is not None else "[]"
        db_monitor.monitor_type = payload.monitor_type
        db_monitor.image_url = payload.image_url
        print(f"[DB]\nStored interaction_steps={db_monitor.interaction_steps}")
        db_monitor.status = "active"
        db_monitor.check_interval = check_interval
        db_monitor.next_check_at = datetime.utcnow()  # Check immediately
        db_monitor.last_error = None
        db_monitor.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_monitor)
        return {"message": "Monitor updated", "id": db_monitor.id}
    
    # Create new monitor
    new_monitor = models.Monitor(
        user_id=user.id,
        name=payload.name,
        url=payload.url,
        page_title=payload.page_title,
        selector=payload.selector,
        tag=payload.tag,
        text_snapshot=payload.text_snapshot,
        last_value=payload.initial_value,
        last_notified_value=payload.initial_value,
        selector_confidence=payload.selector_confidence,
        interaction_steps=json.dumps(payload.interaction_steps) if payload.interaction_steps is not None else "[]",
        monitor_type=payload.monitor_type,
        image_url=payload.image_url,
        monitor_mode=payload.monitor_mode,
        status="active",
        check_interval=check_interval,
        next_check_at=datetime.utcnow(),  # First check happens immediately
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_monitor)
    db.commit()
    db.refresh(new_monitor)
    print(f"[DB]\nStored interaction_steps={new_monitor.interaction_steps}")
    return {"message": "Monitor registered", "id": new_monitor.id}

@router.get("/list")
def list_monitors(db: Session = Depends(get_db)):
    monitors = db.query(models.Monitor).order_by(models.Monitor.created_at.desc()).all()
    return monitors

@router.get("/events")
def list_events(limit: int = 50, db: Session = Depends(get_db)):
    events = db.query(models.ChangeEvent).order_by(models.ChangeEvent.detected_at.desc()).limit(limit).all()
    result = []
    for event in events:
        monitor = db.query(models.Monitor).filter(models.Monitor.id == event.monitor_id).first()
        result.append({
            "id": event.id,
            "monitor_id": event.monitor_id,
            "monitor_name": monitor.name if monitor else "Unknown",
            "page_title": monitor.page_title if monitor else "",
            "url": monitor.url if monitor else "",
            "old_value": event.old_value,
            "new_value": event.new_value,
            "change_type": event.change_type,
            "diff_summary": event.diff_summary,
            "old_page_screenshot_path": event.old_page_screenshot_path,
            "new_page_screenshot_path": event.new_page_screenshot_path,
            "old_element_screenshot_path": event.old_element_screenshot_path,
            "new_element_screenshot_path": event.new_element_screenshot_path,
            "changed_fragment": event.changed_fragment,
            "detected_at": event.detected_at
        })
    return result

@router.get("/notifications")
def poll_notifications(db: Session = Depends(get_db)):
    """
    Polled by Chrome extension. Returns newly detected changes
    where last_notified_value != last_value, and then marks them as notified.
    """
    monitors_to_notify = db.query(models.Monitor).filter(
        models.Monitor.last_notified_value != models.Monitor.last_value,
        models.Monitor.last_value.isnot(None)
    ).all()
    
    notifications = []
    for monitor in monitors_to_notify:
        # Retrieve the latest ChangeEvent for this monitor
        latest_event = db.query(models.ChangeEvent).filter(
            models.ChangeEvent.monitor_id == monitor.id
        ).order_by(models.ChangeEvent.detected_at.desc()).first()
        
        if latest_event:
            # Format time like "10:45 AM"
            local_time_str = latest_event.detected_at.strftime("%I:%M %p")
            notifications.append({
                "id": latest_event.id,
                "monitor_name": monitor.name,
                "page_title": monitor.page_title or monitor.name,
                "url": monitor.url,
                "old_value": latest_event.old_value,
                "new_value": latest_event.new_value,
                "difference": latest_event.diff_summary,
                "timestamp": local_time_str
            })
        
        # Deduplicate: set last_notified_value equal to last_value
        monitor.last_notified_value = monitor.last_value
        db.commit()

    return notifications

@router.post("/{id}/pause")
def pause_monitor(id: str, db: Session = Depends(get_db)):
    monitor = db.query(models.Monitor).filter(models.Monitor.id == id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    monitor.status = "paused"
    db.commit()
    return {"message": "Monitor paused"}

@router.post("/{id}/resume")
def resume_monitor(id: str, db: Session = Depends(get_db)):
    monitor = db.query(models.Monitor).filter(models.Monitor.id == id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    monitor.status = "active"
    monitor.next_check_at = datetime.utcnow()  # Check immediately
    db.commit()
    return {"message": "Monitor resumed"}

@router.delete("/{id}")
def delete_monitor(id: str, db: Session = Depends(get_db)):
    monitor = db.query(models.Monitor).filter(models.Monitor.id == id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    db.delete(monitor)
    db.commit()
    return {"message": "Monitor deleted"}
