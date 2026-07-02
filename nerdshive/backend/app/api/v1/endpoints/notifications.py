from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.api import deps
from app.models.audit import Notification
from app.schemas.audit import NotificationResponse

router = APIRouter()

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
) -> Any:
    """Get current user's notifications"""
    skip = (page - 1) * limit
    return db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(desc(Notification.created_at)).offset(skip).limit(limit).all()

@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Mark a notification as read"""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True  # type: ignore
    db.commit()
    db.refresh(notif)
    return notif

@router.put('/read-all')
def mark_all_read(db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_auth_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({'is_read': True})
    db.commit()
    return {'msg': 'All notifications marked as read'}

