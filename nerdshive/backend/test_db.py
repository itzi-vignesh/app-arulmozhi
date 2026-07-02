import asyncio
from app.db.session import SessionLocal
from app.models.user import Admin

db = SessionLocal()
admins = db.query(Admin).all()
for a in admins:
    print(f"Admin ID: {a.id}, Auth ID: {a.auth_id}, Email property: {a.email}")
db.close()
