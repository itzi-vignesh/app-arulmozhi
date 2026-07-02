from typing import Any, List, Optional, cast
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.models.audit import UsageLog, QueryLog, ActivityLog, ContentSection, AdminTabView, UpdateLog
from app.schemas.audit import (
    UsageLogResponse, QueryLogResponse, QueryLogCreate, QueryLogUser,
    ActivityLogResponse, ContentSectionResponse, ContentSectionCreate,
    AdminTabViewCreate, UpdateLogResponse
)
from app.models.user import User, AuthUser, Superuser, Admin, Finance
from app.services.notification import notify_admins, create_notification

router = APIRouter()

# ---- Usage Logs ----
@router.get("/usage_logs", response_model=List[UsageLogResponse])
def get_usage_logs(
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort: str = Query("created_at")
) -> Any:
    """Get usage logs with pagination (Admin/Superuser)"""
    skip = (page - 1) * limit
    order_by_col = desc(getattr(UsageLog, sort, UsageLog.created_at)) if sort.startswith("-") else getattr(UsageLog, sort.lstrip("-"), UsageLog.created_at)
    if not sort.startswith("-"): order_by_col = desc(order_by_col) # default descending for logs
    return db.query(UsageLog).order_by(order_by_col).offset(skip).limit(limit).all()

# ---- Updates ----
@router.get("/updates", response_model=List[UpdateLogResponse])
def get_updates(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Get all updates/announcements"""
    return db.query(UpdateLog).order_by(desc(UpdateLog.created_at)).all()

class QueryUpdateSchema(BaseModel):
    status: str
    response: Optional[str] = None

# ---- Queries ----
@router.get("/queries/my", response_model=List[QueryLogResponse])
def get_my_queries(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Get only the currently authenticated user's own queries (any authenticated user)."""
    queries = (
        db.query(QueryLog)
        .filter(QueryLog.user_id == current_user.id)
        .order_by(desc(QueryLog.created_at))
        .all()
    )
    results = []
    for q in queries:
        customer = db.query(User).filter(User.auth_id == current_user.id).first()
        full_name = str(customer.full_name) if customer and customer.full_name else "Unknown"
        users_info = QueryLogUser(full_name=full_name, email=str(current_user.email))
        results.append({
            "id": q.id,
            "user_id": q.user_id,
            "message": q.message,
            "query_text": q.message,
            "response": q.response,
            "status": q.status,
            "created_at": q.created_at,
            "users": users_info
        })
    return results

@router.get("/queries", response_model=List[QueryLogResponse])
def get_queries(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort: str = Query("created_at")
) -> Any:
    skip = (page - 1) * limit
    order_by_col = getattr(QueryLog, sort.lstrip("-"), QueryLog.created_at)
    order_by_col = desc(order_by_col) if sort.startswith("-") or sort == "created_at" else order_by_col
    query = db.query(QueryLog)
    if status:
        query = query.filter(QueryLog.status == status)
    queries = query.order_by(order_by_col).offset(skip).limit(limit).all()
    results = []
    for q in queries:
        users_info = None
        if q.user_id:
            auth_user = db.query(AuthUser).filter(AuthUser.id == q.user_id).first()
            if auth_user:
                customer = db.query(User).filter(User.auth_id == auth_user.id).first()
                full_name = str(customer.full_name) if customer and customer.full_name else "Unknown"
                users_info = QueryLogUser(full_name=full_name, email=str(auth_user.email))
        
        results.append({
            "id": q.id,
            "user_id": q.user_id,
            "message": q.message,
            "query_text": q.message,
            "response": q.response,
            "status": q.status,
            "created_at": q.created_at,
            "users": users_info
        })
    return results


@router.post("/queries", response_model=QueryLogResponse)
def create_query(
    query_in: QueryLogCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    new_query = QueryLog(
        user_id=current_user.id,
        message=query_in.message
    )
    db.add(new_query)
    db.commit()
    db.refresh(new_query)
    
    # Notify admins about the new query
    customer = db.query(User).filter(User.auth_id == current_user.id).first()
    customer_name = str(customer.full_name) if customer and customer.full_name else "A customer"
    notify_admins(
        db=db,
        title="New Customer Query",
        message=f"{customer_name} has submitted a new query.",
        type="info"
    )
    
    return {
        "id": new_query.id,
        "user_id": new_query.user_id,
        "message": new_query.message,
        "query_text": new_query.message,
        "response": new_query.response,
        "status": new_query.status,
        "created_at": new_query.created_at,
        "users": QueryLogUser(full_name=customer_name, email=str(current_user.email))
    }

@router.put("/queries/{query_id}", response_model=QueryLogResponse)
def update_query(
    query_id: UUID,
    query_update: QueryUpdateSchema,
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin)
) -> Any:
    q = db.query(QueryLog).filter(QueryLog.id == query_id).first()
    if q:
        q.status = query_update.status  # type: ignore
        if query_update.response is not None:
            q.response = query_update.response  # type: ignore
        db.commit()
        db.refresh(q)
        
        # Notify the customer if a response was provided
        if query_update.response is not None and q.user_id:
            create_notification(
                db=db,
                user_id=q.user_id,  # type: ignore
                title="Query Response Received",
                message="Your query has been answered by an admin.",
                type="success"
            )
            
    # Format the response exactly as expected
    users_info = None
    if q and q.user_id:
        auth_user = db.query(AuthUser).filter(AuthUser.id == q.user_id).first()
        if auth_user:
            customer = db.query(User).filter(User.auth_id == auth_user.id).first()
            full_name = str(customer.full_name) if customer and customer.full_name else "Unknown"
            users_info = QueryLogUser(full_name=full_name, email=str(auth_user.email))
            
    return {
        "id": q.id,
        "user_id": q.user_id,
        "message": q.message,
        "query_text": q.message,
        "response": q.response,
        "status": q.status,
        "created_at": q.created_at,
        "users": users_info
    } if q else None

# ---- Activity Logs ----
@router.get("/activity_logs/count")
def get_new_activity_count(
    db: Session = Depends(deps.get_db),
    current_admin = Depends(deps.get_current_admin)
) -> Any:
    """Get the count of new activity logs since last viewed"""
    tab_view = db.query(AdminTabView).filter(
        AdminTabView.admin_id == current_admin.id,
        AdminTabView.tab_name == 'activity'
    ).first()
    
    if not tab_view:
        return db.query(ActivityLog).count()
    
    return db.query(ActivityLog).filter(ActivityLog.created_at > tab_view.last_viewed_at).count()

@router.get("/activity_logs", response_model=List[ActivityLogResponse])
def get_activity_logs(
    db: Session = Depends(deps.get_db),
    admin = Depends(deps.get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort: str = Query("-created_at")
) -> Any:
    skip = (page - 1) * limit
    order_by_col = desc(getattr(ActivityLog, sort.lstrip("-"), ActivityLog.created_at)) if sort.startswith("-") else getattr(ActivityLog, sort.lstrip("-"), ActivityLog.created_at)
    return db.query(ActivityLog).order_by(order_by_col).offset(skip).limit(limit).all()

@router.post("/activity_logs", response_model=ActivityLogResponse)
def create_activity_log(
    action: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    new_log = ActivityLog(
        action=action,
        performed_by=current_user.id
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

# ---- Content Sections ----
@router.get("/content_sections", response_model=List[ContentSectionResponse])
def get_content_sections(
    db: Session = Depends(deps.get_db)
) -> Any:
    return db.query(ContentSection).all()

@router.post("/content_sections", response_model=ContentSectionResponse)
def upsert_content_section(
    content_in: ContentSectionCreate,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    # Allow Superuser, Admin, or Finance roles
    superuser = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first()
    admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first()
    finance = db.query(Finance).filter(Finance.auth_id == current_user.id).first()
    
    if not superuser and not admin and not finance:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")

    if content_in.section == "invoice_template":
        import json
        try:
            config = json.loads(content_in.content)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON format for invoice template.")
        
        # 1. Validate Business info
        business = config.get("business", {})
        if not isinstance(business, dict):
            raise HTTPException(status_code=400, detail="Business settings must be an object.")
        if not business.get("name") or not str(business.get("name")).strip():
            raise HTTPException(status_code=400, detail="Business Name is required.")
        if not business.get("address") or not str(business.get("address")).strip():
            raise HTTPException(status_code=400, detail="Business Address is required.")
        
        # GST (gstin)
        gstin = business.get("gstin")
        if not gstin or not str(gstin).strip():
            raise HTTPException(status_code=400, detail="GST registration number (GSTIN) is required.")
        
        # 2. Validate Currency settings
        currency = config.get("currency", {})
        if not isinstance(currency, dict):
            raise HTTPException(status_code=400, detail="Currency settings must be an object.")
        if not currency.get("symbol") or not str(currency.get("symbol")).strip():
            raise HTTPException(status_code=400, detail="Currency symbol is required.")
        if not currency.get("code") or len(str(currency.get("code")).strip()) != 3:
            raise HTTPException(status_code=400, detail="Currency code must be a 3-letter code (e.g. INR, USD).")
        try:
            precision = int(currency.get("precision", 2))
            if precision < 0 or precision > 4:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Currency precision must be a non-negative integer (between 0 and 4).")
        
        # 3. Validate Invoice Settings
        invoice_settings = config.get("invoice", {})
        if not isinstance(invoice_settings, dict):
            raise HTTPException(status_code=400, detail="Invoice settings must be an object.")
        if not invoice_settings.get("prefix") or not str(invoice_settings.get("prefix")).strip():
            raise HTTPException(status_code=400, detail="Invoice prefix is required.")
        try:
            padding = int(invoice_settings.get("numberPadding", 5))
            if padding < 1 or padding > 10:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invoice number padding must be an integer between 1 and 10.")
            
        # Versioning: Compare with existing
        existing_section = db.query(ContentSection).filter(ContentSection.section == "invoice_template").first()
        current_version = 1
        if existing_section:
            try:
                existing_config = json.loads(cast(str, existing_section.content))
                current_version = int(existing_config.get("version", 1))
                
                # Compare without version key
                cfg_copy = dict(config)
                cfg_copy.pop("version", None)
                exist_copy = dict(existing_config)
                exist_copy.pop("version", None)
                
                if cfg_copy != exist_copy:
                    current_version += 1
            except Exception:
                current_version += 1
        
        config["version"] = current_version
        content_in.content = json.dumps(config)

    section = db.query(ContentSection).filter(ContentSection.section == content_in.section).first()
    if section:
        section.content = content_in.content  # type: ignore
    else:
        section = ContentSection(section=content_in.section, content=content_in.content)
        db.add(section)
    db.commit()
    db.refresh(section)
    
    # Notify admins about the content update
    notify_admins(
        db=db,
        title="Content Updated",
        message=f"The {section.section} section has been updated.",
        type="info"
    )
    
    return section

@router.post("/admin_tab_views")
def log_admin_tab_view(
    tab_view_in: AdminTabViewCreate,
    db: Session = Depends(deps.get_db),
    current_admin = Depends(deps.get_current_admin)
) -> Any:
    """Log an admin viewing a dashboard tab (Admin only)."""
    tab_view = db.query(AdminTabView).filter(
        AdminTabView.admin_id == current_admin.id,
        AdminTabView.tab_name == tab_view_in.tab_name
    ).first()
    
    if tab_view:
        tab_view.last_viewed_at = datetime.now(timezone.utc)  # type: ignore
    else:
        tab_view = AdminTabView(
            admin_id=current_admin.id,
            tab_name=tab_view_in.tab_name,
            last_viewed_at=datetime.now(timezone.utc)
        )
        db.add(tab_view)
        
    db.commit()
    return {"msg": "Tab view logged successfully"}
