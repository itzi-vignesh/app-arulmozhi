import uuid
from datetime import datetime, date, timedelta
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.user import AuthUser, User
from app.models.business import Checkin
from app.core.security import get_password_hash
from sqlalchemy import text

def main():
    db = SessionLocal()
    try:
        # Resolve company1 and a5cyber
        companies = db.query(Company).filter(Company.company_name.in_(["company1", "a5cyber"])).all()
        if not companies:
            print("No matching companies found.")
            return

        for company in companies:
            print(f"Processing company: {company.company_name} (ID: {company.id})")
            
            # Let's see if we already have employees
            existing_employees = db.query(User).filter(User.company_id == company.id).all()
            if len(existing_employees) >= 2:
                print(f"Company {company.company_name} already has {len(existing_employees)} employees.")
                employees = existing_employees
            else:
                print(f"Creating mock employees for {company.company_name}...")
                employees = []
                emp_details = [
                    {"name": f"{company.company_name.capitalize()} Dev 1", "email": f"{company.company_name}_dev1@example.com", "pin": f"PIN_{company.company_name}_1", "dept": "Engineering", "desig": "Senior Developer"},
                    {"name": f"{company.company_name.capitalize()} QA 1", "email": f"{company.company_name}_qa1@example.com", "pin": f"PIN_{company.company_name}_2", "dept": "QA", "desig": "Test Engineer"}
                ]
                
                for idx, details in enumerate(emp_details):
                    # Check if AuthUser exists
                    auth_user = db.query(AuthUser).filter(AuthUser.email == details["email"]).first()
                    if not auth_user:
                        auth_user = AuthUser(
                            email=details["email"],
                            hashed_password=get_password_hash("password123"),
                            is_active=True
                        )
                        db.add(auth_user)
                        db.flush()
                    
                    user = db.query(User).filter(User.auth_id == auth_user.id).first()
                    if not user:
                        # get next customer id sequence
                        next_val = db.execute(text("SELECT nextval('customer_id_seq')")).scalar()
                        customer_id = f"NH-{datetime.now().year}-{str(next_val).zfill(5)}"
                        
                        user = User(
                            auth_id=auth_user.id,
                            email=details["email"],
                            full_name=details["name"],
                            mobile=f"98765432{idx}0",
                            emergency_contact_number="9876543211",
                            org_name=company.company_name,
                            govt_id_type="PAN",
                            govt_id_number="ABCDE1234F",
                            company_id=company.id,
                            employee_id=details["pin"],
                            customer_id=customer_id,
                            enrollment_source="bulk_enrolled",
                            is_approved=True,
                            is_active=True,
                            status="ACTIVE",
                            department=details["dept"],
                            designation=details["desig"]
                        )
                        db.add(user)
                        db.flush()
                    employees.append(user)
            
            # Now let's add checkins for these employees
            for emp in employees:
                # Check if this user already has checkins
                existing_checkins = db.query(Checkin).filter(Checkin.user_id == emp.id).count()
                if existing_checkins > 0:
                    print(f"Employee {emp.full_name} already has {existing_checkins} checkins.")
                    continue
                
                print(f"Seeding checkins for employee {emp.full_name}...")
                
                # Checkin 1: Yesterday, checked out
                t1_in = datetime.now() - timedelta(days=1, hours=9)
                t1_out = datetime.now() - timedelta(days=1, hours=1)
                checkin1 = Checkin(
                    user_id=emp.id,
                    plan_id=None,
                    checkin_time=t1_in,
                    checkout_time=t1_out,
                    checkin_approved=True,
                    status="checked_out",
                    working_hours=8.0,
                    payment_status="paid"
                )
                db.add(checkin1)
                
                # Checkin 2: Today, currently checked in
                t2_in = datetime.now() - timedelta(hours=3)
                checkin2 = Checkin(
                    user_id=emp.id,
                    plan_id=None,
                    checkin_time=t2_in,
                    checkout_time=None,
                    checkin_approved=True,
                    status="checked_in",
                    working_hours=None,
                    payment_status="pending"
                )
                db.add(checkin2)
                
        db.commit()
        print("Successfully seeded employees and checkins!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding attendance: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    main()
