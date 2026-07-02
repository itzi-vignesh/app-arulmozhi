import os
os.environ["DATABASE_URL"] = "postgresql://app_user:password123@127.0.0.1:5435/app_db"

import sys
import uuid
from typing import Any, cast
from app.db.session import SessionLocal
from app.models.user import AuthUser
from app.models.company import Company, CompanyAdmin
from app.models.business import PricingPlan
from app.api.v1.endpoints.company_admin import update_my_company
from app.schemas.company import CompanyInfoUpdate

def run():
    db = SessionLocal()
    try:
        admin = db.query(CompanyAdmin).first()
        if not admin:
            print("No company admin found.")
            return
            
        auth_user = db.query(AuthUser).filter(AuthUser.id == admin.auth_id).first()
        if not auth_user:
            print("No auth user found.")
            return

        company = db.query(Company).filter(Company.id == admin.company_id).first()
        if not company:
            print("No company found.")
            return

        plan = db.query(PricingPlan).filter(PricingPlan.plan_name == "MONTHLY TEAM PLAN").first()
        if not plan:
            print("No pricing plan found.")
            return
        
        print(f"Using plan: {plan.plan_name} (ID: {plan.id})")
        print(f"Using company: {company.company_name} (ID: {company.id})")
        
        # Cast to Any to bypass SQLAlchemy static type-checking limitations on models
        c_any = cast(Any, company)
        a_any = cast(Any, admin)
        p_any = cast(Any, plan)

        # Build update request
        update_data = CompanyInfoUpdate(
            company_name=str(c_any.company_name or "Test Company"),
            company_website=str(c_any.company_website) if c_any.company_website else None,
            company_email=str(c_any.company_email or "test@company.com"),
            industry_type=str(c_any.industry_type) if c_any.industry_type else None,
            admin_full_name=str(a_any.full_name or "Admin"),
            admin_mobile=str(a_any.mobile or "1234567890"),
            address=str(c_any.address) if c_any.address else None,
            city=str(c_any.city) if c_any.city else None,
            state=str(c_any.state) if c_any.state else None,
            pincode=str(c_any.pincode) if c_any.pincode else None,
            gst_number=str(c_any.gst_number) if c_any.gst_number else None,
            seats_requested=c_any.seats_requested,
            selected_plan_id=p_any.id
        )
        
        print("Calling update_my_company...")
        res = update_my_company(
            request=update_data,
            db=db,
            current_admin=auth_user
        )
        print("Success!", res)
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run()
