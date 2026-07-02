from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import AuthUser, Admin, Superuser
from app.core.config import settings
import os
import shutil

router = APIRouter()

STORAGE_DIR = settings.STORAGE_DIR

@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Upload a file securely"""
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)
        
    file_location = f"{STORAGE_DIR}/{current_user.id}_{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    return {"info": f"file '{file.filename}' saved at '{file_location}'"}

@router.post("/id-proofs/{filename:path}")
def upload_id_proof(
    filename: str,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Upload a government ID proof securely"""
    bucket_dir = os.path.join(STORAGE_DIR, "id-proofs")
    file_location = os.path.join(bucket_dir, filename)
    
    os.makedirs(os.path.dirname(file_location), exist_ok=True)
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    return {"path": f"id-proofs/{filename}"}

@router.post("/customer-photos/{filename:path}")
def upload_customer_photo(
    filename: str,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Upload a customer profile photo securely"""
    bucket_dir = os.path.join(STORAGE_DIR, "customer-photos")
    file_location = os.path.join(bucket_dir, filename)
    
    os.makedirs(os.path.dirname(file_location), exist_ok=True)
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    return {"path": f"customer-photos/{filename}"}

@router.post("/company-documents/{filename:path}")
def upload_company_document(
    filename: str,
    file: UploadFile = File(...)
) -> Any:
    """Upload a company document securely (public during registration)"""
    bucket_dir = os.path.join(STORAGE_DIR, "company-documents")
    file_location = os.path.join(bucket_dir, filename)
    
    os.makedirs(os.path.dirname(file_location), exist_ok=True)
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    return {"path": f"company-documents/{filename}"}

def is_authorized_for_file(db: Session, current_user: AuthUser, bucket: str, path: str) -> bool:
    # 1. Superuser / Admin check
    is_superuser = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    is_admin = db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
    if is_superuser or is_admin:
        return True
        
    # 2. Owner of file (for id-proofs and customer-photos)
    if path.startswith(str(current_user.id)):
        return True
        
    # 3. Company Admin / Employee check (for company-documents)
    if bucket == "company-documents":
        from app.models.company import CompanyAdmin
        from app.models.user import User
        comp_admin = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id).first()
        if comp_admin:
            return True
        employee = db.query(User).filter(User.auth_id == current_user.id).first()
        if employee:
            return True
                            
    return False

@router.get("/raw/{bucket}/{path:path}")
def download_file_raw(
    bucket: str,
    path: str,
    request: Request,
    db: Session = Depends(deps.get_db)
) -> Any:
    """Download raw file content securely (with public access for logos)."""
    if path.startswith(f"{bucket}/"):
        path = path[len(bucket) + 1:]
        
    is_public_logo = bucket == "company-documents" and os.path.basename(path).startswith("logo_")
    
    if not is_public_logo:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        token = auth_header.split(" ")[1]
        try:
            from jose import jwt
            from uuid import UUID
            from app.models.user import AuthUser
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            token_type = payload.get("type")
            if user_id is None or token_type != "access":
                raise HTTPException(status_code=401, detail="Invalid token")
            current_user = db.query(AuthUser).filter(AuthUser.id == UUID(user_id)).first()
            if not current_user:
                raise HTTPException(status_code=401, detail="User not found")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")

        if not is_authorized_for_file(db, current_user, bucket, path):
            raise HTTPException(status_code=403, detail="Not authorized to access this file")

    file_location = os.path.join(STORAGE_DIR, bucket, path)
    if not os.path.exists(file_location):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(file_location)

@router.get("/{bucket}/{path:path}")
def get_file_signed_url(
    request: Request,
    bucket: str,
    path: str,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """Get a simulated signed URL for file download."""
    if path.startswith(f"{bucket}/"):
        path = path[len(bucket) + 1:]
        
    file_location = os.path.join(STORAGE_DIR, bucket, path)
    if not os.path.exists(file_location):
        raise HTTPException(status_code=404, detail="File not found")
        
    if not is_authorized_for_file(db, current_user, bucket, path):
        raise HTTPException(status_code=403, detail="Not authorized to access this file")
        
    # Generate relative/absolute API URL pointing to the raw file endpoint
    base_url = str(request.base_url).rstrip('/')
    signed_url = f"{base_url}{settings.API_V1_STR}/storage/raw/{bucket}/{path}"
    
    return {"signedUrl": signed_url}

@router.get("/{filename}")
def download_file(
    filename: str,
    db: Session = Depends(deps.get_db),
    current_user: AuthUser = Depends(deps.get_current_auth_user)
) -> Any:
    """
    Secure file access enforcing role-based permissions.
    Only the owner, admins, or superusers can download the file.
    """
    file_location = f"{STORAGE_DIR}/{filename}"
    
    if not os.path.exists(file_location):
        raise HTTPException(status_code=404, detail="File not found")
        
    is_owner = filename.startswith(str(current_user.id))
    
    is_admin = (
        db.query(Admin).filter(Admin.auth_id == current_user.id).first() is not None
        or db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() is not None
    )
        
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this file")

    return FileResponse(file_location)
