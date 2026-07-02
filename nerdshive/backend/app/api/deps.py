from typing import Generator, Optional, cast
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.config import settings
from app.models.user import AuthUser, User, Admin, Superuser
from uuid import UUID

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_auth_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> AuthUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(AuthUser).filter(AuthUser.id == UUID(user_id)).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Check if company is suspended
    if user.company_admin_profile and user.company_admin_profile.company and user.company_admin_profile.company.status == "suspended":
        raise HTTPException(status_code=400, detail="Your company is suspended.")
    if user.customer_profile and user.customer_profile.company and user.customer_profile.company.status == "suspended":
        raise HTTPException(status_code=400, detail="Your company is suspended.")
        
    return user

def get_current_active_customer(
    current_user: AuthUser = Depends(get_current_auth_user),
    db: Session = Depends(get_db)
) -> User:
    customer = db.query(User).filter(User.auth_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=403, detail="Not a customer")
    return customer

def get_current_admin(
    current_user: AuthUser = Depends(get_current_auth_user),
    db: Session = Depends(get_db)
) -> AuthUser:
    # Check if admin or superuser
    admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first()
    superuser = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first()
    
    if not admin and not superuser:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user

def get_current_superuser(
    current_user: AuthUser = Depends(get_current_auth_user),
    db: Session = Depends(get_db)
) -> AuthUser:
    superuser = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first()
    if not superuser:
        raise HTTPException(status_code=403, detail="The user doesn't have superuser privileges")
    return current_user

def get_current_company_admin(
    current_user: AuthUser = Depends(get_current_auth_user),
    db: Session = Depends(get_db)
) -> AuthUser:
    from app.models.company import CompanyAdmin
    company_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id).first()
    if not company_admin:
        raise HTTPException(status_code=403, detail="The user is not a company admin")
    return current_user

def get_current_finance(
    current_user: AuthUser = Depends(get_current_auth_user),
    db: Session = Depends(get_db)
) -> AuthUser:
    from app.models.user import Finance
    finance = db.query(Finance).filter(Finance.auth_id == current_user.id).first()
    if not finance:
        raise HTTPException(status_code=403, detail="The user doesn't have finance privileges")
    if finance.status != "active":
        raise HTTPException(status_code=403, detail="Finance account is deactivated")
    return current_user

def has_meeting_access(db: Session, auth_user: AuthUser) -> bool:
    # 1. Superuser and admin always have access
    superuser = db.query(Superuser).filter(Superuser.auth_id == auth_user.id).first()
    if superuser:
        return True
    admin = db.query(Admin).filter(Admin.auth_id == auth_user.id).first()
    if admin:
        return True

    from app.models.company import CompanyAdmin, Company
    from app.models.business import PricingPlan
    
    # 2. Check if Corporate Admin
    comp_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == auth_user.id).first()
    if comp_admin:
        company = db.query(Company).filter(Company.id == comp_admin.company_id).first()
        if not company or not company.selected_plan_id:
            return False
        plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
        if not plan or not plan.features_json:
            return False
        return any("meeting room" in f.strip().lower() for f in plan.features_json)

    # 3. Check if normal customer user
    customer = db.query(User).filter(User.auth_id == auth_user.id).first()
    if customer:
        if customer.company_id is not None:
            company = db.query(Company).filter(Company.id == customer.company_id).first()
            if company:
                # Check if it is a dummy customer company
                if company.company_name.endswith(" (Customer)") or company.company_name.startswith("Customer "):
                    return _check_customer_active_plans_access(db, cast(UUID, customer.id))
                else:
                    if not company.selected_plan_id:
                        return False
                    plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
                    if not plan or not plan.features_json:
                        return False
                    return any("meeting room" in f.strip().lower() for f in plan.features_json)
        else:
            return _check_customer_active_plans_access(db, cast(UUID, customer.id))

    return False

def _check_customer_active_plans_access(db: Session, customer_id: UUID) -> bool:
    from app.models.business import Plan, PricingPlan
    from datetime import date
    today = date.today()
    
    active_plans = db.query(Plan).filter(
        Plan.user_id == customer_id,
        Plan.is_active == True,
        Plan.payment_verified == True,
        Plan.start_date <= today,
        Plan.end_date >= today
    ).all()
    
    for p in active_plans:
        pricing_plan = db.query(PricingPlan).filter(
            PricingPlan.category == "customer",
            PricingPlan.billing_type == p.plan_type,
            PricingPlan.is_active == True
        ).first()
        if pricing_plan and pricing_plan.features_json:
            if any("meeting room" in f.strip().lower() for f in pricing_plan.features_json):
                return True
    return False
