from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json

DATABASE_URL = "postgresql://app_user:password123@localhost:5435/app_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

from app.models.user import AuthUser

users = db.query(AuthUser).all()
for u in users:
    print(f"Email: {u.email}")
    print(f"  MFA Enrollment Status: {u.mfa_enrollment_status}")
    print(f"  MFA Secret: {u.mfa_secret is not None}")
    print(f"  Backup Codes: {u.backup_codes is not None}")
    print(f"  Superuser Profile: {u.superuser_profile is not None}")
    print("-" * 40)
