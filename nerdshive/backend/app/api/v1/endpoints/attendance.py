from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api import deps
from app.models.user import AuthUser
from app.services.biometric import sync_biometric_data

router = APIRouter()


@router.post("/biometric-sync", status_code=status.HTTP_200_OK)
async def sync_biometric_attendance(
    date: str,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_admin)
):
    """
    Manually triggers biometric attendance synchronization for a given date (format: YYYY-MM-DD).
    Only accessible by system administrators and superusers.
    """
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Expected YYYY-MM-DD."
        )

    result = await sync_biometric_data(db, target_date_str=date, current_user=current_user)
    
    if result.get("failed", 0) > 0 and result.get("imported", 0) == 0 and result.get("updated", 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Biometric synchronization failed. Check system logs for details."
        )

    return result
