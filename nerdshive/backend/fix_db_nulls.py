import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.company import Company
from app.models.user import AuthUser, User
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

companies = db.query(Company).all()
for c in companies:
    changed = False
    print(f"Company: {c.company_name}, ID: {c.id}")
    print(f"  seats_requested: {c.seats_requested}")
    print(f"  biometric_required: {c.biometric_required}")
    print(f"  biometric_requested: {c.biometric_requested}")
    if c.biometric_required is None:
        c.biometric_required = False  # type: ignore
        changed = True
    if c.biometric_requested is None:
        c.biometric_requested = False  # type: ignore
        changed = True
    if changed:
        print("  -> Fixed NULL booleans")
        
    total_emps = db.query(User).filter(User.company_id == c.id).count()
    print(f"  employees_added: {total_emps}")
    if c.seats_requested is not None:
        print(f"  seats_available: {c.seats_requested - total_emps}")
    else:
        print("  seats_available: N/A")
        
db.commit()
db.close()
