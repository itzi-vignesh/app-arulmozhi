from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.models.user import User
from app.models.business import Plan, Checkin

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    """Get high-level dashboard stats (Admin/Superuser)"""
    total_users = db.query(User).count()
    from datetime import date
    active_plans = db.query(Plan).filter(
        Plan.is_active == True,
        Plan.start_date <= date.today(),
        Plan.end_date >= date.today()
    ).count()
    pending_checkins = db.query(Checkin).filter(Checkin.checkin_approved == False).count()
    
    return {
        "total_users": total_users,
        "active_plans": active_plans,
        "pending_checkins": pending_checkins
    }

@router.get("/metrics")
def get_dashboard_metrics(
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    """Get time-series metrics (Admin/Superuser)"""
    # Placeholder for actual time-series logic
    # In a real app, this would group by date.
    return {
        "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        "datasets": [
            {
                "label": "New Users",
                "data": [10, 20, 15, 30, 25, 40]
            }
        ]
    }
