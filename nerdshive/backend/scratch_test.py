import os
import sys

# Add backend directory to sys.path
sys.path.append(r"e:\1\backend")

from app.db.session import SessionLocal
from app.models.user import AuthUser, Admin, Superuser

db = SessionLocal()

admins_has = db.query(AuthUser).filter(AuthUser.admin_profile.has()).all()
admins_join = db.query(AuthUser).join(Admin).all()
admins_direct = db.query(Admin).all()

superusers_has = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
superusers_join = db.query(AuthUser).join(Superuser).all()
superusers_direct = db.query(Superuser).all()

print(f"Admins (has): {len(admins_has)}")
print(f"Admins (join): {len(admins_join)}")
print(f"Admins (direct): {len(admins_direct)}")

print(f"Superusers (has): {len(superusers_has)}")
print(f"Superusers (join): {len(superusers_join)}")
print(f"Superusers (direct): {len(superusers_direct)}")
