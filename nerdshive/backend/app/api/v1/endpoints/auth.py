import pyotp
import json
import uuid
from typing import Any, Optional, Dict, cast
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.core.security import (
    verify_password, get_password_hash, create_access_token, 
    create_refresh_token, create_password_reset_token, verify_token,
    encrypt_value, decrypt_value, hash_backup_code, verify_backup_code
)
from app.core.mail import send_reset_password_email
from app.models.user import AuthUser, RevokedToken
from app.models.system_settings import SystemSetting
from app.models.audit import ActivityLog
from pydantic import BaseModel, EmailStr
from app.schemas.user import (
    AuthUserCreate, MfaSetupResponse, MfaVerifyRequest, 
    MfaLoginRequest, MfaDisableRequest, MfaStatusResponse, MfaPolicyUpdate
)
from app.api.validators import validate_email_str, validate_password_str

router = APIRouter()

class UserMin(BaseModel):
    id: Any

DEFAULT_MFA_POLICY = {
    "superuser": False,
    "finance": False,
    "admin": False,
    "corporate_admin": False,
    "customer": False,
    "employee": False
}

def log_mfa_event(db: Session, user: AuthUser, action: str, success: bool, ip: str = "127.0.0.1", browser: str = "Unknown", device: str = "Unknown", target_user: Optional[AuthUser] = None):
    details = {
        "success": success,
        "ip_address": ip,
        "browser": browser,
        "device": device
    }
    
    role = "user"
    if user.superuser_profile:
        role = "superuser"
    elif user.finance_profile:
        role = "finance"
    elif user.admin_profile:
        role = "admin"
    elif user.company_admin_profile:
        role = "company_admin"

    t_user = target_user if target_user else user
    log = ActivityLog(
        action=action,
        performed_by=user.id,
        performed_by_name=user.email,
        performed_by_role=role,
        details=details,
        target_user_id=t_user.id,
        target_user_name=t_user.email,
        target_user_email=t_user.email,
    )
    db.add(log)
    db.commit()

def get_mfa_policy(db: Session) -> dict:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "platform_security_policy").first()
    if not setting:
        return DEFAULT_MFA_POLICY
    try:
        data = json.loads(cast(str, setting.value))
        return data.get("mfa", DEFAULT_MFA_POLICY)
    except Exception:
        return DEFAULT_MFA_POLICY

def is_mfa_required_for_user(db: Session, user: AuthUser) -> bool:
    policy = get_mfa_policy(db)
    if user.superuser_profile:
        return policy.get("superuser", True)
    if user.finance_profile:
        return policy.get("finance", True)
    if user.admin_profile:
        return policy.get("admin", True)
    if user.company_admin_profile:
        return policy.get("corporate_admin", False)
    if user.customer_profile:
        return policy.get("customer", False)
    return False

def create_mfa_pending_token(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    to_encode = {"exp": expire, "sub": str(subject), "type": "mfa_pending"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_mfa_pending_or_current_user(
    db: Session = Depends(deps.get_db),
    token: str = Depends(deps.oauth2_scheme)
) -> AuthUser:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if user_id is None or token_type not in ["access", "mfa_pending"]:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(AuthUser).filter(AuthUser.id == uuid.UUID(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[UserMin] = None

@router.post("/login")
def login_access_token(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests, handles MFA requirements.
    """
    user = db.query(AuthUser).filter(AuthUser.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):  # type: ignore
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    if user.customer_profile and user.customer_profile.status == "INACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Please contact the administrator."
        )
    
    # Check if company is suspended
    if user.company_admin_profile and user.company_admin_profile.company and user.company_admin_profile.company.status == "suspended":
        raise HTTPException(status_code=400, detail="Your company is suspended.")
    if user.customer_profile and user.customer_profile.company and user.customer_profile.company.status == "suspended":
        raise HTTPException(status_code=400, detail="Your company is suspended.")
        
    mfa_required = is_mfa_required_for_user(db, user)
    
    if mfa_required:
        if user.mfa_enrollment_status == "ENROLLED":
            return {"mfa_required": True, "mfa_token": create_mfa_pending_token(user.id)}
        else:
            return {"mfa_setup_required": True, "mfa_token": create_mfa_pending_token(user.id)}
    else:
        if user.mfa_enrollment_status == "ENROLLED":
            return {"mfa_required": True, "mfa_token": create_mfa_pending_token(user.id)}
            
    return {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": {
            "id": user.id
        }
    }

@router.post("/refresh", response_model=Token)
def refresh_token(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Refresh access token"""
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    user = db.query(AuthUser).filter(AuthUser.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
        
    # Check if company is suspended
    if user.company_admin_profile and user.company_admin_profile.company and user.company_admin_profile.company.status == "suspended":
        raise HTTPException(status_code=401, detail="Your company is suspended.")
    if user.customer_profile and user.customer_profile.company and user.customer_profile.company.status == "suspended":
        raise HTTPException(status_code=401, detail="Your company is suspended.")
        
    return {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
    }

@router.post("/password-recovery")
def recover_password(email: str = Body(..., embed=True), db: Session = Depends(deps.get_db)) -> Any:
    """
    Password Recovery. Sends an email with a reset token.
    """
    user = db.query(AuthUser).filter(AuthUser.email == email).first()
    if user:
        token = create_password_reset_token(email=email)
        send_reset_password_email(email_to=user.email, token=token)  # type: ignore
    return {"msg": "If the email exists, a password recovery email has been sent."}

@router.post("/reset-password")
def reset_password(
    token: str = Body(...), new_password: str = Body(...), db: Session = Depends(deps.get_db)
) -> Any:
    """
    Reset password using a token.
    """
    payload = verify_token(token, "reset")
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    email = payload.get("sub")
    user = db.query(AuthUser).filter(AuthUser.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    from app.api.validators import validate_password_str
    validate_password_str(new_password, "New password")
    
    user.hashed_password = get_password_hash(new_password)  # type: ignore
    db.commit()
    return {"msg": "Password updated successfully"}

@router.post("/logout")
def logout(
    token: str = Depends(deps.oauth2_scheme),
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Logout user by adding the access token to the revoked tokens list.
    """
    revoked = RevokedToken(id=token)
    db.add(revoked)
    db.commit()
    return {"msg": "Successfully logged out"}


class RegisterBody(BaseModel):
    email: str
    password: str
    enable_mfa: bool = False

@router.post('/register')
def register(
    data: RegisterBody,
    db: Session = Depends(deps.get_db)
) -> Any:
    validate_email_str(data.email)
    validate_password_str(data.password)
    user = db.query(AuthUser).filter(AuthUser.email == data.email).first()
    if user:
        from app.models.user import User
        employee = db.query(User).filter(User.auth_id == user.id).first()
        if employee and employee.company_id:
            raise HTTPException(status_code=400, detail='This email is already associated with a corporate account.')
        raise HTTPException(status_code=400, detail='Email already registered')
        
    new_user = AuthUser(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        is_active=True
    )
    
    if data.enable_mfa:
        new_user.mfa_enrollment_status = "PENDING_SETUP"
    else:
        new_user.mfa_enrollment_status = "DEFERRED"
        new_user.mfa_remind_after = datetime.now(timezone.utc) + timedelta(days=1)
        new_user.mfa_reminder_count = 1
        
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    if data.enable_mfa:
        return {
            "mfa_setup_required": True,
            "mfa_token": create_mfa_pending_token(new_user.id),
            "user": {
                "id": str(new_user.id)
            }
        }
        
    return {
        'access_token': create_access_token(new_user.id),
        'refresh_token': create_refresh_token(new_user.id),
        'token_type': 'bearer',
        'user': {
            'id': new_user.id
        }
    }

@router.get('/session')
def get_session(
    current_user: AuthUser = Depends(deps.get_current_auth_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    is_admin = current_user.admin_profile is not None
    is_superuser = current_user.superuser_profile is not None
    is_company_admin = current_user.company_admin_profile is not None
    is_finance = current_user.finance_profile is not None
    
    is_payment_overdue = False
    try:
        from datetime import date
        from app.models.business import Invoice
        
        # Check customer profile
        if current_user.customer_profile:
            overdue = db.query(Invoice).filter(
                Invoice.user_id == current_user.customer_profile.id,
                Invoice.status == "unpaid",
                Invoice.invoice_status == "active",
                Invoice.due_date < date.today()
            ).first()
            if overdue:
                is_payment_overdue = True
            elif current_user.customer_profile.company_id:
                overdue_company = db.query(Invoice).filter(
                    Invoice.company_id == current_user.customer_profile.company_id,
                    Invoice.status == "unpaid",
                    Invoice.invoice_status == "active",
                    Invoice.due_date < date.today()
                ).first()
                if overdue_company:
                    is_payment_overdue = True
                    
        # Check company admin profile
        elif current_user.company_admin_profile:
            overdue_company = db.query(Invoice).filter(
                Invoice.company_id == current_user.company_admin_profile.company_id,
                Invoice.status == "unpaid",
                Invoice.invoice_status == "active",
                Invoice.due_date < date.today()
            ).first()
            if overdue_company:
                is_payment_overdue = True
    except Exception as e:
        print(f"Error checking overdue invoices in session: {e}")
        
    return {
        'session': {
            'user': {
                'id': current_user.id,
                'email': current_user.email
            }
        },
        'roles': {
            'is_admin': is_admin,
            'is_superuser': is_superuser,
            'is_company_admin': is_company_admin,
            'is_finance': is_finance,
            'is_payment_overdue': is_payment_overdue
        },
        'mfa_status': {
            'mfa_enabled': current_user.mfa_enrollment_status == "ENROLLED",
            'enrollment_status': current_user.mfa_enrollment_status,
            'mfa_remind_after': current_user.mfa_remind_after.isoformat() if current_user.mfa_remind_after else None,
            'mfa_reminder_count': current_user.mfa_reminder_count
        }
    }

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
def change_password(
    data: ChangePassword,
    current_user: AuthUser = Depends(deps.get_current_auth_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Change current user's password."""
    if not verify_password(data.current_password, current_user.hashed_password):  # type: ignore
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    from app.api.validators import validate_password_str
    validate_password_str(data.new_password, "New password")
    
    current_user.hashed_password = get_password_hash(data.new_password)  # type: ignore
    db.commit()
    return {"msg": "Password updated successfully"}


# Simple in-memory verification failure tracker for rate limiting
# mapping: user_id (str) -> { "failed_attempts": int, "locked_until": datetime }
MFA_LIMITS: Dict[str, Dict[str, Any]] = {}

@router.get("/mfa/status", response_model=MfaStatusResponse)
def get_mfa_status(
    current_user: AuthUser = Depends(get_mfa_pending_or_current_user)
) -> Any:
    return {
        "mfa_enabled": current_user.mfa_enrollment_status == "ENROLLED",
        "enrollment_status": current_user.mfa_enrollment_status,
        "mfa_remind_after": current_user.mfa_remind_after,
        "mfa_reminder_count": current_user.mfa_reminder_count
    }

@router.post("/mfa/setup", response_model=MfaSetupResponse)
def mfa_setup(
    current_user: AuthUser = Depends(get_mfa_pending_or_current_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    if current_user.mfa_enrollment_status == "ENROLLED":
        raise HTTPException(status_code=400, detail="MFA is already enrolled.")
        
    secret = pyotp.random_base32()
    encrypted_secret = encrypt_value(secret)
    current_user.mfa_secret = encrypted_secret
    current_user.mfa_enrollment_status = "PENDING_SETUP"
    db.commit()
    
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=cast(str, current_user.email),
        issuer_name="NerdShive"
    )
    
    log_mfa_event(db, current_user, "MFA Setup Started", True)
    
    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri
    }

@router.post("/mfa/verify")
def mfa_verify(
    data: MfaVerifyRequest,
    current_user: AuthUser = Depends(get_mfa_pending_or_current_user),
    token: str = Depends(deps.oauth2_scheme),
    db: Session = Depends(deps.get_db)
) -> Any:
    if current_user.mfa_enrollment_status == "ENROLLED":
        raise HTTPException(status_code=400, detail="MFA is already enrolled.")
        
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initiated.")
        
    secret = decrypt_value(cast(str, current_user.mfa_secret))
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code):
        log_mfa_event(db, current_user, "MFA Setup Completed", False)
        raise HTTPException(status_code=400, detail="Invalid verification code.")
        
    import secrets
    raw_backup_codes = []
    hashed_backup_codes = []
    for _ in range(10):
        part1 = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(4))
        part2 = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(4))
        code = f"{part1}-{part2}"
        raw_backup_codes.append(code)
        hashed_backup_codes.append(hash_backup_code(code))
        
    current_user.backup_codes = encrypt_value(json.dumps(hashed_backup_codes))
    current_user.mfa_enrollment_status = "ENROLLED"
    current_user.mfa_enabled_at = datetime.now(timezone.utc)
    current_user.last_mfa_verification = datetime.now(timezone.utc)
    db.commit()
    
    log_mfa_event(db, current_user, "MFA Enabled", True)
    
    payload = verify_token(token, "mfa_pending")
    response_data = {
        "msg": "MFA enabled successfully.",
        "backup_codes": raw_backup_codes
    }
    if payload:
        response_data["access_token"] = create_access_token(current_user.id)
        response_data["refresh_token"] = create_refresh_token(current_user.id)
        response_data["token_type"] = "bearer"
        
    return response_data

@router.post("/mfa/login")
def mfa_login(
    data: MfaLoginRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    payload = verify_token(data.mfa_token, "mfa_pending")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token.")
        
    user_id_str = cast(str, payload.get("sub"))
    user = db.query(AuthUser).filter(AuthUser.id == uuid.UUID(user_id_str)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive.")
        
    now = datetime.now(timezone.utc)
    limit_info = MFA_LIMITS.get(user_id_str)
    if limit_info and limit_info["locked_until"] > now:
        seconds_left = int((limit_info["locked_until"] - now).total_seconds()) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed verification attempts. Please try again in {seconds_left} seconds."
        )
        
    verified = False
    is_recovery = False
    
    if user.mfa_secret:
        secret = decrypt_value(cast(str, user.mfa_secret))
        totp = pyotp.TOTP(secret)
        if totp.verify(data.code):
            verified = True
            
    if not verified and user.backup_codes:
        try:
            hashed_codes = json.loads(decrypt_value(cast(str, user.backup_codes)))
            match_idx = -1
            for idx, hashed_code in enumerate(hashed_codes):
                if verify_backup_code(data.code.upper().strip(), hashed_code):
                    match_idx = idx
                    break
            if match_idx >= 0:
                verified = True
                is_recovery = True
                hashed_codes.pop(match_idx)
                user.backup_codes = encrypt_value(json.dumps(hashed_codes))
                db.commit()
        except Exception:
            pass
            
    if not verified:
        if not limit_info:
            limit_info = cast(Dict[str, Any], { "failed_attempts": 0, "locked_until": now })
        limit_info["failed_attempts"] += 1
        if limit_info["failed_attempts"] >= 5:
            limit_info["locked_until"] = now + timedelta(seconds=30)
            MFA_LIMITS[user_id_str] = limit_info
            log_mfa_event(db, user, "MFA Verification Failed (Rate Limit Lockout)", False)
            raise HTTPException(
                status_code=429,
                detail="Too many failed verification attempts. Account locked out for 30 seconds."
            )
        MFA_LIMITS[user_id_str] = limit_info
        log_mfa_event(db, user, "MFA Verification Failed", False)
        raise HTTPException(status_code=400, detail="Invalid verification code.")
        
    if user_id_str in MFA_LIMITS:
        del MFA_LIMITS[user_id_str]
        
    user.last_mfa_verification = datetime.now(timezone.utc)
    db.commit()
    
    event_name = "MFA Verification Successful (Backup Code)" if is_recovery else "MFA Verification Successful"
    log_mfa_event(db, user, event_name, True)
    
    return {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": {
            "id": user.id
        }
    }

@router.post("/mfa/disable")
def mfa_disable(
    data: MfaDisableRequest,
    current_user: AuthUser = Depends(deps.get_current_auth_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    if current_user.mfa_enrollment_status != "ENROLLED":
        raise HTTPException(status_code=400, detail="MFA is not enabled.")
        
    if not verify_password(data.password, current_user.hashed_password):
        log_mfa_event(db, current_user, "MFA Disabled", False)
        raise HTTPException(status_code=400, detail="Incorrect password.")
        
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup secret not found.")
        
    secret = decrypt_value(cast(str, current_user.mfa_secret))
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code):
        log_mfa_event(db, current_user, "MFA Disabled", False)
        raise HTTPException(status_code=400, detail="Invalid verification code.")
        
    # Use setattr to bypass type-narrowing error where Pyright thinks mfa_enrollment_status must be "ENROLLED"
    setattr(current_user, "mfa_enrollment_status", "DISABLED")
    setattr(current_user, "mfa_secret", None)
    setattr(current_user, "backup_codes", None)
    setattr(current_user, "mfa_enabled_at", None)
    db.commit()
    
    log_mfa_event(db, current_user, "MFA Disabled", True)
    return {"msg": "MFA disabled successfully."}

@router.post("/mfa/defer")
def mfa_defer(
    current_user: AuthUser = Depends(deps.get_current_auth_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    current_user.mfa_enrollment_status = "DEFERRED"
    current_user.mfa_last_reminder = datetime.now(timezone.utc)
    
    count = current_user.mfa_reminder_count
    if count <= 1:
        days = 2
    else:
        days = 7
        
    current_user.mfa_reminder_count = count + 1
    remind_after = datetime.now(timezone.utc) + timedelta(days=days)
    current_user.mfa_remind_after = remind_after
    db.commit()
    
    log_mfa_event(db, current_user, "MFA Deferred", True)
    return {
        "msg": "MFA configuration deferred successfully.",
        "next_reminder": remind_after.isoformat()
    }

@router.post("/mfa/regenerate-backup-codes")
def regenerate_backup_codes(
    data: MfaVerifyRequest,
    current_user: AuthUser = Depends(deps.get_current_auth_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    if current_user.mfa_enrollment_status != "ENROLLED":
        raise HTTPException(status_code=400, detail="MFA is not enabled.")
        
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA secret not found.")
        
    secret = decrypt_value(cast(str, current_user.mfa_secret))
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code):
        log_mfa_event(db, current_user, "Backup Codes Regenerated", False)
        raise HTTPException(status_code=400, detail="Invalid verification code.")
        
    import secrets
    raw_backup_codes = []
    hashed_backup_codes = []
    for _ in range(10):
        part1 = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(4))
        part2 = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(4))
        code = f"{part1}-{part2}"
        raw_backup_codes.append(code)
        hashed_backup_codes.append(hash_backup_code(code))
        
    setattr(current_user, "backup_codes", encrypt_value(json.dumps(hashed_backup_codes)))
    db.commit()
    
    log_mfa_event(db, current_user, "Backup Codes Regenerated", True)
    return {
        "backup_codes": raw_backup_codes
    }

@router.get("/mfa/recovery")
def get_backup_codes_status(
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    if not current_user.backup_codes:
        return {"remaining_count": 0}
    try:
        hashed_codes = json.loads(decrypt_value(cast(str, current_user.backup_codes)))
        return {"remaining_count": len(hashed_codes)}
    except Exception:
        return {"remaining_count": 0}

@router.get("/mfa/policy")
def get_platform_policy(
    current_user: AuthUser = Depends(deps.get_current_superuser),
    db: Session = Depends(deps.get_db)
) -> Any:
    policy_setting = db.query(SystemSetting).filter(SystemSetting.key == "platform_security_policy").first()
    if not policy_setting:
        return {"mfa": DEFAULT_MFA_POLICY, "password_policy": {}, "session_policy": {}, "login_policy": {}}
    try:
        return json.loads(cast(str, policy_setting.value))
    except Exception:
        return {"mfa": DEFAULT_MFA_POLICY, "password_policy": {}, "session_policy": {}, "login_policy": {}}

@router.post("/mfa/policy")
def update_platform_policy(
    data: Dict[str, Any],
    current_user: AuthUser = Depends(deps.get_current_superuser),
    db: Session = Depends(deps.get_db)
) -> Any:
    policy_setting = db.query(SystemSetting).filter(SystemSetting.key == "platform_security_policy").first()
    if not policy_setting:
        policy_setting = SystemSetting(key="platform_security_policy")
        db.add(policy_setting)
        
    policy_setting.value = json.dumps(data)
    db.commit()
    
    log_mfa_event(db, current_user, "Policy Changed", True)
    return {"msg": "Platform security policies updated successfully."}

