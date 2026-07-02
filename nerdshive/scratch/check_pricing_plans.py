import os
import sys
# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.business import Plan, Pricing

def main():
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    print(f"Connecting to database: {db_url}")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    plans = session.query(Plan).all()
    pricing = session.query(Pricing).all()
    
    print(f"\nNumber of Plans: {len(plans)}")
    for p in plans:
        print(f"  ID: {p.id} | User ID: {p.user_id} | Plan Type: {p.plan_type} | Payment Verified: {p.payment_verified}")
        
    print(f"\nNumber of Pricing Records: {len(pricing)}")
    for pr in pricing:
        print(f"  Plan Type: {pr.plan_type} | Amount: {pr.amount} | GST Rate: {pr.gst_rate}")

if __name__ == "__main__":
    main()
