import os
os.environ["DATABASE_URL"] = "postgresql://app_user:password123@127.0.0.1:5435/app_db"

from app.db.session import SessionLocal
from app.models.business import PricingPlan

db = SessionLocal()
try:
    plans = db.query(PricingPlan).all()
    for plan in plans:
        print(f"ID: {plan.id} | Name: {plan.plan_name} | Price: {plan.price} | Billing: {plan.billing_type} | Category: {plan.category} | Active: {plan.is_active}")
finally:
    db.close()
