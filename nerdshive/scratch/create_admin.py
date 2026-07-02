import os
import sys
import requests
# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser, Admin
from app.core.security import get_password_hash

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    print(f"Connecting to database: {db_url}")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    email = "admin@nerdshive.local"
    password = "Admin@123"
    full_name = "Test Admin"
    
    # 1. Create or Update AuthUser
    auth_user = session.query(AuthUser).filter_by(email=email).first()
    if auth_user:
        print(f"User {email} already exists. Resetting password and activating...")
        auth_user.hashed_password = get_password_hash(password)  # type: ignore
        auth_user.is_active = True  # type: ignore
    else:
        print(f"Creating new AuthUser for {email}...")
        auth_user = AuthUser(
            email=email,
            hashed_password=get_password_hash(password),
            is_active=True
        )
        session.add(auth_user)
    
    session.commit()
    session.refresh(auth_user)
    user_id = str(auth_user.id)
    print(f"AuthUser ID: {user_id}")
    
    # 2. Create or Update Admin profile
    admin_profile = session.query(Admin).filter_by(auth_id=auth_user.id).first()
    if admin_profile:
        print("Admin profile already exists. Updating details...")
        admin_profile.full_name = full_name  # type: ignore
    else:
        print("Creating corresponding Admin profile record...")
        admin_profile = Admin(
            auth_id=auth_user.id,
            full_name=full_name
        )
        session.add(admin_profile)
        
    session.commit()
    print("Admin profile committed successfully.")
    
    # 3. Verify Login via POST /api/v1/auth/login
    print("\n--- Verifying Authentication ---")
    login_url = "http://localhost:8000/api/v1/auth/login"
    login_data = {
        "username": email,
        "password": password
    }
    
    # OAuth2 login requires application/x-www-form-urlencoded
    login_resp = requests.post(login_url, data=login_data)
    print(f"Login POST status: {login_resp.status_code}")
    if login_resp.status_code == 200:
        login_body = login_resp.json()
        print("Login Succeeded!")
        token = login_body.get("access_token")
        
        # 4. Verify GET /api/v1/auth/session
        headers = {"Authorization": f"Bearer {token}"}
        session_resp = requests.get("http://localhost:8000/api/v1/auth/session", headers=headers)
        print(f"GET /auth/session status: {session_resp.status_code}")
        print(f"GET /auth/session body: {session_resp.json()}")
        
        # 5. Verify GET /api/v1/users/me
        me_resp = requests.get("http://localhost:8000/api/v1/users/me", headers=headers)
        print(f"GET /users/me status: {me_resp.status_code}")
        print(f"GET /users/me body: {me_resp.json() if me_resp.status_code == 200 else me_resp.text}")
        
        # 6. Check Admin Permissions by accessing an admin-only endpoint
        # Let's try GET /api/v1/users/ (Retrieve all users - Admin only)
        users_list_resp = requests.get("http://localhost:8000/api/v1/users/", headers=headers)
        print(f"GET /users/ (Admin Only) status: {users_list_resp.status_code}")
        
    else:
        print(f"Login Failed: {login_resp.text}")

if __name__ == "__main__":
    main()
