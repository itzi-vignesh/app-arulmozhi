import os
import sys

# Add e:/1/backend to path
sys.path.append('e:/1/backend')

# Override DATABASE_URL to use localhost instead of db
os.environ['DATABASE_URL'] = "postgresql://app_user:password123@localhost:5432/app_db"

from app.db.session import SessionLocal
from app.models.business import Checkin, Plan
from app.models.user import User

db = SessionLocal()
checkins = db.query(Checkin).all()
print(f"Total checkins in db: {len(checkins)}")
for c in checkins:
    user = db.query(User).filter(User.id == c.user_id).first()
    user_name = user.full_name if user else "Unknown"
    print(f"Checkin ID: {c.id}")
    print(f"  User: {user_name}")
    print(f"  Payment Status: {c.payment_status}")
    print(f"  Checkin Approved: {c.checkin_approved}")
    if c.plan:
        print(f"  Plan: ID={c.plan.id}, Type={c.plan.plan_type}, Verified={c.plan.payment_verified}")
    else:
        print("  Plan: None")
    print("-" * 40)
db.close()
