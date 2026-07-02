import sys
from app.db.session import SessionLocal
from app.models.user import AuthUser
from app.models.company import Company, CompanyAdmin
from app.api.v1.endpoints.company_admin import get_my_company, get_dashboard_stats, get_employees, get_attendance

def run():
    db = SessionLocal()
    try:
        admin = db.query(CompanyAdmin).first()
        if not admin:
            print("No company admin found.")
            return
            
        auth_user = db.query(AuthUser).filter(AuthUser.id == admin.auth_id).first()
        
        print("Testing get_dashboard_stats...")
        try:
            get_dashboard_stats(db=db, current_admin=auth_user)
            print("OK")
        except Exception as e:
            print("FAIL:", e)
            
        print("Testing get_employees...")
        try:
            get_employees(db=db, current_admin=auth_user)
            print("OK")
        except Exception as e:
            print("FAIL:", e)
            
        print("Testing get_attendance...")
        try:
            get_attendance(db=db, current_admin=auth_user)
            print("OK")
        except Exception as e:
            print("FAIL:", e)
            
        print("Testing get_my_company...")
        try:
            get_my_company(db=db, current_admin=auth_user)
            print("OK")
        except Exception as e:
            print("FAIL:", e)

    finally:
        db.close()

if __name__ == "__main__":
    run()
