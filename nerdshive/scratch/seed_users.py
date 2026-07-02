import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser, Admin, Superuser
from app.core.security import get_password_hash

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Seed predefined users
    users_to_seed = [
        {
            "email": "superuser@example.com",
            "password": "password123",
            "is_superuser": True,
            "full_name": "Default Superuser",
            "mobile": "9876543210"
        },
        {
            "email": "admin@example.com",
            "password": "password123",
            "is_admin": True,
            "full_name": "Default Admin",
            "mobile": "9876543211"
        },
        {
            "email": "super@nerdshive.com",
            "password": "Password123!",
            "is_superuser": True,
            "full_name": "Nerdshive Superuser",
            "mobile": "9876543212"
        },
        {
            "email": "admin@nerdshive.com",
            "password": "Password123!",
            "is_superuser": True,
            "full_name": "Nerdshive Admin",
            "mobile": "9876543213"
        },
        {
            "email": "superuser@nerdshive.com",
            "password": "password123",
            "is_superuser": True,
            "full_name": "Nerdshive Superuser 2",
            "mobile": "9876543214"
        }
    ]
    
    for u_data in users_to_seed:
        email = u_data["email"]
        existing = session.query(AuthUser).filter_by(email=email).first()
        if not existing:
            auth_user = AuthUser(
                email=email,
                hashed_password=get_password_hash(u_data["password"]),
                is_active=True
            )
            session.add(auth_user)
            session.flush()
            
            if u_data.get("is_superuser"):
                profile = Superuser(
                    auth_id=auth_user.id,
                    full_name=u_data["full_name"],
                    mobile=u_data["mobile"],
                    city="Chennai",
                    location="Adyar",
                    occupation="Super Administrator"
                )
                session.add(profile)
                print(f"Superuser {email} seeded successfully.")
            elif u_data.get("is_admin"):
                profile = Admin(
                    auth_id=auth_user.id,
                    full_name=u_data["full_name"],
                    mobile=u_data["mobile"],
                    city="Chennai",
                    location="T Nagar",
                    occupation="Administrator"
                )
                session.add(profile)
                print(f"Admin {email} seeded successfully.")
        else:
            print(f"User {email} already exists.")
            
    session.commit()

if __name__ == "__main__":
    main()
