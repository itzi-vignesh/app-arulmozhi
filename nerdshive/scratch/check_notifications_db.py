import os
import sys

# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))
os.environ['DATABASE_URL'] = "postgresql://app_user:password123@localhost:5432/app_db"

from app.db.session import SessionLocal
from app.models.audit import Notification, UpdateLog
from app.models.user import User

db = SessionLocal()

print("--- 1. NOTIFICATIONS TABLE ---")
notifs = db.query(Notification).all()
print(f"Total notifications: {len(notifs)}")
for n in notifs:
    user = db.query(User).filter(User.auth_id == n.user_id).first()
    user_name = user.full_name if user else f"Auth ID: {n.user_id}"
    print(f"ID: {n.id}")
    print(f"  User: {user_name}")
    print(f"  Message: {n.message}")
    print(f"  Is Read: {n.is_read}")
    print(f"  Created At: {n.created_at}")
    print("-" * 40)

print("\n--- 2. UPDATES TABLE ---")
updates = db.query(UpdateLog).all()
print(f"Total updates: {len(updates)}")
for u in updates:
    print(f"ID: {u.id}")
    print(f"  Message: {u.message}")
    print(f"  Type: {u.type}")
    print(f"  Created At: {u.created_at}")
    print("-" * 40)

db.close()
