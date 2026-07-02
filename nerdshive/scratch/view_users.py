import sys
sys.path.append(r"e:\1\backend")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import AuthUser, User, Admin, Superuser, Finance

engine = create_engine("postgresql://app_user:password123@localhost:5435/app_db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

users = db.query(AuthUser).all()
print(f"Total AuthUsers: {len(users)}")
for u in users:
    roles = []
    if db.query(Admin).filter(Admin.auth_id == u.id).first():
        roles.append("Admin")
    if db.query(Superuser).filter(Superuser.auth_id == u.id).first():
        roles.append("Superuser")
    if db.query(Finance).filter(Finance.auth_id == u.id).first():
        roles.append("Finance")
    if db.query(User).filter(User.auth_id == u.id).first():
        roles.append("User/Customer")
    print(f"Email: {u.email} | Roles: {roles}")
