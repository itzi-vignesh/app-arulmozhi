import os
import sys
# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser

def main():
    # Replace localhost for running outside docker
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    print(f"Connecting to database: {db_url}")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    users = session.query(AuthUser).all()
    print(f"Found {len(users)} users:")
    for u in users:
        # Check profiles
        is_admin = u.admin_profile is not None
        is_superuser = u.superuser_profile is not None
        is_customer = u.customer_profile is not None
        print(f"ID: {u.id} | Email: {u.email} | Active: {u.is_active} | Admin: {is_admin} | Superuser: {is_superuser} | Customer: {is_customer}")

if __name__ == "__main__":
    main()
