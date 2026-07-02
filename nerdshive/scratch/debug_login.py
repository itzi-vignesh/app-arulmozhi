import os
import sys
import requests
# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser
from app.core.security import get_password_hash

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # 1. Update password
    email = "arulmozhi39sk@gmail.com"
    user = session.query(AuthUser).filter_by(email=email).first()
    if not user:
        print(f"User {email} not found!")
        return
        
    user.hashed_password = get_password_hash("password123")  # type: ignore
    session.commit()
    print(f"Updated password for {email} to 'password123'.")
    
    # 2. Call login endpoint
    login_url = "http://localhost:8000/api/v1/auth/login"
    data = {
        "username": email,
        "password": "password123"
    }
    
    print(f"Calling POST {login_url}...")
    # OAuth2 login requires application/x-www-form-urlencoded
    response = requests.post(login_url, data=data)
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response Body: {response.json()}")
    except Exception as e:
        print(f"Could not parse JSON: {e}")
        print(f"Raw Text: {response.text}")

if __name__ == "__main__":
    main()
