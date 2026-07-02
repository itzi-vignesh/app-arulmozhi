import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser, User, Admin, Superuser

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    print("--- Auth Users ---")
    users = session.query(AuthUser).all()
    for u in users:
        role = "customer"
        if session.query(Admin).filter_by(auth_id=u.id).first():
            role = "admin"
        elif session.query(Superuser).filter_by(auth_id=u.id).first():
            role = "superuser"
        print(f"ID: {u.id} | Email: {u.email} | Role: {role} | Active: {u.is_active}")

if __name__ == "__main__":
    main()
