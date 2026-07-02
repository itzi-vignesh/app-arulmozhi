import uuid
from uuid import UUID
from typing import Any, List, Optional, cast
from datetime import date, time, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_

from app.api import deps
from app.models.meeting import MeetingRoom, MeetingRequest
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser, User, Admin, Superuser
from app.models.base import utc_now
from app.schemas.meeting import (
    MeetingRoomCreate,
    MeetingRoomUpdate,
    MeetingRoomResponse,
    MeetingRequestCreate,
    MeetingRequestResponse,
    MeetingRequestCancel,
    MeetingAvailabilityResponse,
)
from app.services.notification import (
    notify_meeting_requested,
    notify_meeting_approved,
    notify_meeting_rejected,
    notify_meeting_cancelled,
)

router = APIRouter()

def _company_has_meeting_access(db: Session, company: Company) -> bool:
    if not company:
        return False
    # Check if it is a dummy customer company
    if company.company_name.endswith(" (Customer)") or company.company_name.startswith("Customer "):
        customer = db.query(User).filter(User.company_id == company.id).first()
        if not customer:
            return False
        return deps._check_customer_active_plans_access(db, cast(UUID, customer.id))
    else:
        if not company.selected_plan_id:
            return False
        from app.models.business import PricingPlan
        plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
        if not plan or not plan.features_json:
            return False
        return any("meeting room" in f.strip().lower() for f in plan.features_json)

@router.get("/check-access")
def check_meeting_access(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """Check if current user/company has Meeting Room Access."""
    access = deps.has_meeting_access(db, current_user)
    return {"has_access": access}

# --- Room Management (Admins & Superusers) ---

@router.get("/rooms", response_model=List[MeetingRoomResponse])
def get_rooms(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """List meeting rooms. Admins/Superusers get all rooms, others get active ones."""
    if not deps.has_meeting_access(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="Your current workspace plan no longer includes Meeting Room Access."
        )
    # Check if admin or superuser
    is_admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
    is_su = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    
    if is_admin or is_su:
        return db.query(MeetingRoom).order_by(MeetingRoom.room_name).all()
    else:
        return db.query(MeetingRoom).filter(MeetingRoom.status == "ACTIVE").order_by(MeetingRoom.room_name).all()


@router.post("/rooms", response_model=MeetingRoomResponse)
def create_room(
    room_in: MeetingRoomCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin),
) -> Any:
    """Create a new meeting room (Admins and Superusers only)"""
    existing = db.query(MeetingRoom).filter(MeetingRoom.room_name == room_in.room_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Room with this name already exists")
        
    room = MeetingRoom(**room_in.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.put("/rooms/{room_id}", response_model=MeetingRoomResponse)
def update_room(
    room_id: uuid.UUID,
    room_in: MeetingRoomUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin),
) -> Any:
    """Update a meeting room (Admins and Superusers only)"""
    room = db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    for field, val in room_in.model_dump(exclude_unset=True).items():
        setattr(room, field, val)
        
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}")
def delete_room(
    room_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin),
) -> Any:
    """Delete a meeting room (Admins and Superusers only)"""
    room = db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    db.delete(room)
    db.commit()
    return {"msg": "Room deleted successfully"}


# --- Workspace Meeting Availability Check ---

@router.get("/availability", response_model=List[MeetingAvailabilityResponse])
def get_availability(
    date: date = Query(...),
    room_id: uuid.UUID = Query(..., alias="room"),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """Get unavailable time slots for a given date and room preserving privacy."""
    if not deps.has_meeting_access(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="Your current workspace plan no longer includes Meeting Room Access."
        )
    meetings_raw = db.query(MeetingRequest).filter(
        MeetingRequest.meeting_date == date,
        MeetingRequest.status.in_(["APPROVED", "PENDING"]),
        MeetingRequest.room_id == room_id
    ).order_by(MeetingRequest.start_time).all()
    meetings = [m for m in meetings_raw if m.company and _company_has_meeting_access(db, m.company)]
    
    unavailable_intervals = []
    for m in meetings:
        status_str = "BOOKED" if m.status == "APPROVED" else "PENDING"
        unavailable_intervals.append({
            "start_time": m.start_time.strftime("%H:%M"),
            "end_time": m.end_time.strftime("%H:%M"),
            "status": status_str
        })
    return unavailable_intervals


# --- Room Availability Check ---

@router.get("/available-rooms", response_model=List[MeetingRoomResponse])
def get_available_rooms(
    meeting_date: date = Query(...),
    start_time: time = Query(...),
    end_time: time = Query(...),
    participants: int = Query(1),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """Get active rooms that have capacity and are not booked by APPROVED meetings."""
    if not deps.has_meeting_access(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="Your current workspace plan no longer includes Meeting Room Access."
        )
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")
        
    # Get all active rooms with capacity
    rooms = db.query(MeetingRoom).filter(
        MeetingRoom.status == "ACTIVE",
        MeetingRoom.capacity >= participants
    ).all()
    
    # Filter out rooms with overlapping approved meetings from active plan holders
    available = []
    for r in rooms:
        overlapping_meetings = db.query(MeetingRequest).filter(
            MeetingRequest.status == "APPROVED",
            MeetingRequest.room_id == r.id,
            MeetingRequest.meeting_date == meeting_date,
            MeetingRequest.start_time < end_time,
            MeetingRequest.end_time > start_time
        ).all()
        
        has_overlap = False
        for m in overlapping_meetings:
            if m.company and _company_has_meeting_access(db, m.company):
                has_overlap = True
                break
                
        if not has_overlap:
            available.append(r)
            
    return available


# --- Meeting Request Booking & Actions ---

@router.post("/request", response_model=MeetingRequestResponse)
def request_meeting(
    request_in: MeetingRequestCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """Submit a meeting request. Automatically checks availability if room_id is omitted."""
    from app.api.v1.endpoints.invoices import verify_no_overdue_payment
    verify_no_overdue_payment(db, current_user)
    if not deps.has_meeting_access(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="Your current workspace plan no longer includes Meeting Room Access."
        )
    comp_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id).first()
    if not comp_admin:
        # Fallback to check normal user's company
        customer = db.query(User).filter(User.auth_id == current_user.id).first()
        if customer:
            is_individual = False
            if customer.company_id is None:
                is_individual = True
            else:
                company = db.query(Company).filter(Company.id == customer.company_id).first()
                if company and (company.company_name.endswith(" (Customer)") or company.company_name.startswith("Customer ")):
                    is_individual = True
            
            if is_individual:
                if request_in.participants != 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Individual customers can only book meeting rooms for 1 participant."
                    )
                if customer.company_id is None:
                    company_name = f"{customer.full_name} (Customer)" if customer.full_name else f"Customer {current_user.email}"
                    dummy_company = db.query(Company).filter(Company.company_name == company_name).first()
                    if not dummy_company:
                        dummy_company = Company(
                            company_name=company_name,
                            company_email=current_user.email,
                            address="Nerdshive Coworking Space",
                            max_employee_capacity=1,
                            seats_requested=0,
                            status="approved"
                        )
                        db.add(dummy_company)
                        db.commit()
                        db.refresh(dummy_company)
                    customer.company_id = dummy_company.id
                    db.commit()
                    company_id = dummy_company.id
                else:
                    company_id = customer.company_id
            else:
                company_id = customer.company_id
        else:
            raise HTTPException(status_code=403, detail="User profile not found")
    else:
        company_id = comp_admin.company_id
        
    if request_in.start_time >= request_in.end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")
        
    room_id = request_in.room_id
    
    # Automatic Room Assignment
    if not room_id:
        rooms = db.query(MeetingRoom).filter(
            MeetingRoom.status == "ACTIVE",
            MeetingRoom.capacity >= request_in.participants
        ).all()
        
        available = []
        for r in rooms:
            overlapping_meetings = db.query(MeetingRequest).filter(
                MeetingRequest.status.in_(["APPROVED", "PENDING"]),
                MeetingRequest.room_id == r.id,
                MeetingRequest.meeting_date == request_in.meeting_date,
                MeetingRequest.start_time < request_in.end_time,
                MeetingRequest.end_time > request_in.start_time
            ).all()
            
            has_overlap = False
            for m in overlapping_meetings:
                if m.company and _company_has_meeting_access(db, m.company):
                    has_overlap = True
                    break
                    
            if not has_overlap:
                available.append(r)
                
        if len(available) == 0:
            raise HTTPException(
                status_code=409,
                detail="This meeting slot is already booked or has already been requested."
            )
        elif len(available) == 1:
            room_id = available[0].id
        else:
            room_list = [{"id": str(r.id), "room_name": r.room_name, "capacity": r.capacity, "location": r.location} for r in available]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "MULTIPLE_ROOMS_AVAILABLE",
                    "message": "Multiple rooms are available. Please select one.",
                    "rooms": room_list
                }
            )

    # Validate room if provided
    room = db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Selected meeting room not found")
    if room.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Selected meeting room is currently inactive")
        
    # Check capacity warning
    if room.capacity < request_in.participants:
         raise HTTPException(status_code=400, detail="Selected room capacity is less than expected participants")

    # Conflict detection (Overlapping approved or pending meeting from active plan holders)
    overlapping_meetings = db.query(MeetingRequest).filter(
        MeetingRequest.status.in_(["APPROVED", "PENDING"]),
        MeetingRequest.room_id == room_id,
        MeetingRequest.meeting_date == request_in.meeting_date,
        MeetingRequest.start_time < request_in.end_time,
        MeetingRequest.end_time > request_in.start_time
    ).all()
    
    for m in overlapping_meetings:
        if m.company and _company_has_meeting_access(db, m.company):
            raise HTTPException(
                status_code=409,
                detail="This meeting slot is already booked or has already been requested."
            )
    
    meeting = MeetingRequest(
        company_id=company_id,
        room_id=room_id,
        meeting_title=request_in.meeting_title,
        purpose=request_in.purpose,
        meeting_date=request_in.meeting_date,
        start_time=request_in.start_time,
        end_time=request_in.end_time,
        participants=request_in.participants,
        department=request_in.department,
        notes=request_in.notes,
        status="PENDING",
        conflict_detected=False
    )
    
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    
    # Centralized Notification helper call
    notify_meeting_requested(db, meeting)
    
    return meeting


@router.get("/", response_model=List[MeetingRequestResponse])
def get_meetings(
    status: Optional[str] = None,
    room_id: Optional[uuid.UUID] = None,
    date: Optional[date] = None,
    search_company: Optional[str] = None,
    search_title: Optional[str] = None,
    sort_by: Optional[str] = "date",
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """Retrieve meetings. Admins/Superusers see all, companies see their own (or anonymized room bookings)."""
    is_admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
    is_su = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    
    query = db.query(MeetingRequest).join(Company)
    
    # Keep a flag to anonymize if non-admin fetches room bookings
    anonymize_room_bookings = False
    
    if not (is_admin or is_su):
        if room_id:
            # Let corporate users fetch bookings for a specific room but anonymize them
            query = query.filter(
                MeetingRequest.room_id == room_id,
                MeetingRequest.status.in_(["APPROVED", "PENDING"])
            )
            anonymize_room_bookings = True
        else:
            # Normal logic filtering by company_id
            comp_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id).first()
            if comp_admin:
                company_id = comp_admin.company_id
            else:
                customer = db.query(User).filter(User.auth_id == current_user.id).first()
                if customer and customer.company_id is not None:
                    company_id = customer.company_id
                else:
                    return []
            query = query.filter(MeetingRequest.company_id == company_id)
        
    # Filters
    if status:
        query = query.filter(MeetingRequest.status == status)
    if room_id and not anonymize_room_bookings: # Already filtered above if anonymizing
        query = query.filter(MeetingRequest.room_id == room_id)
    if date:
        query = query.filter(MeetingRequest.meeting_date == date)
    if (search_title or search_company) and not anonymize_room_bookings:
        search_conditions = []
        if search_title:
            search_conditions.append(MeetingRequest.meeting_title.ilike(f"%{search_title}%"))
        if search_company:
            search_conditions.append(Company.company_name.ilike(f"%{search_company}%"))
        query = query.filter(or_(*search_conditions))
        
    # Sort
    if sort_by == "company" and not anonymize_room_bookings:
        query = query.order_by(Company.company_name, MeetingRequest.meeting_date, MeetingRequest.start_time)
    else: # Default: date
        query = query.order_by(MeetingRequest.meeting_date, MeetingRequest.start_time)
        
    meetings_raw = query.all()
    meetings = [m for m in meetings_raw if m.company and _company_has_meeting_access(db, m.company)]
    
    if anonymize_room_bookings:
        anonymized_list = []
        for m in meetings:
            # Create a shallow copy with dummy/anonymized fields
            anonymized_m = MeetingRequest(
                id=m.id,
                room_id=m.room_id,
                meeting_date=m.meeting_date,
                start_time=m.start_time,
                end_time=m.end_time,
                status=m.status,
                meeting_title="Booked" if m.status == "APPROVED" else "Pending Request",
                purpose="",
                department="",
                notes="",
                participants=0,
                conflict_detected=False,
                company_id=uuid.UUID("00000000-0000-4000-8000-000000000000"),
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            anonymized_m.company = None
            anonymized_m.room = m.room
            anonymized_list.append(anonymized_m)
        return anonymized_list
        
    return meetings


@router.put("/{meeting_id}/approve", response_model=MeetingRequestResponse)
def approve_meeting(
    meeting_id: uuid.UUID,
    decision_notes: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin),
) -> Any:
    """Approve a meeting request (Admins & Superusers only). Enforces single approval."""
    meeting = db.query(MeetingRequest).filter(MeetingRequest.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting request not found")
        
    if meeting.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Meeting is already approved")
    if meeting.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cancelled meetings cannot be approved")
        
    # Check if superuser or admin
    is_su = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    role = "SUPERUSER" if is_su else "ADMIN"
    
    meeting.status = "APPROVED"
    meeting.approved_by = current_user.id
    meeting.approved_role = role
    meeting.approved_at = utc_now()
    meeting.decision_notes = decision_notes
    
    db.commit()
    db.refresh(meeting)
    
    # Notify company admin
    notify_meeting_approved(db, meeting)
    
    return meeting


@router.put("/{meeting_id}/reject", response_model=MeetingRequestResponse)
def reject_meeting(
    meeting_id: uuid.UUID,
    decision_notes: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin),
) -> Any:
    """Reject a meeting request (Admins & Superusers only)."""
    meeting = db.query(MeetingRequest).filter(MeetingRequest.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting request not found")
        
    if meeting.status in ("APPROVED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a meeting with status {meeting.status}")
        
    is_su = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    role = "SUPERUSER" if is_su else "ADMIN"
    
    meeting.status = "REJECTED"
    meeting.rejected_by = current_user.id
    meeting.rejected_role = role
    meeting.rejected_at = utc_now()
    meeting.decision_notes = decision_notes
    
    db.commit()
    db.refresh(meeting)
    
    # Notify company admin
    notify_meeting_rejected(db, meeting)
    
    return meeting


@router.put("/{meeting_id}/cancel", response_model=MeetingRequestResponse)
def cancel_meeting(
    meeting_id: uuid.UUID,
    cancel_in: MeetingRequestCancel,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user),
) -> Any:
    """Cancel a meeting request (Company Admins / corporate users associated with company)."""
    meeting = db.query(MeetingRequest).filter(MeetingRequest.id == meeting_id).first()
    if not deps.has_meeting_access(db, current_user):
        raise HTTPException(
            status_code=403,
            detail="Your current workspace plan no longer includes Meeting Room Access."
        )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting request not found")
        
    # Check if admin or superuser to bypass company validation
    is_admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
    is_su = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None

    if not (is_admin or is_su):
        # Check permissions (must belong to the company that requested it)
        comp_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id).first()
        if comp_admin:
            company_id = comp_admin.company_id
        else:
            customer = db.query(User).filter(User.auth_id == current_user.id).first()
            if customer and customer.company_id is not None:
                company_id = customer.company_id
            else:
                raise HTTPException(status_code=403, detail="Not authorized to cancel this meeting")
                
        if meeting.company_id != company_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this company's meeting")
        
    if meeting.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Meeting is already cancelled")
        
    # Rules: can cancel pending at any time; approved before scheduled start.
    if meeting.status == "APPROVED":
        # Check date
        today = date.today()
        if meeting.meeting_date < today:
             raise HTTPException(status_code=400, detail="Cannot cancel a meeting that is in the past")
        elif meeting.meeting_date == today:
             # Check time if needed
             now_time = datetime.now().time()
             if meeting.start_time <= now_time:
                 raise HTTPException(status_code=400, detail="Cannot cancel a meeting after it has started")
                 
    meeting.status = "CANCELLED"
    meeting.cancelled_by = current_user.id
    meeting.cancelled_at = utc_now()
    meeting.cancel_reason = cancel_in.cancel_reason
    
    db.commit()
    db.refresh(meeting)
    
    # Notify Admin and Superuser
    notify_meeting_cancelled(db, meeting)
    
    return meeting
