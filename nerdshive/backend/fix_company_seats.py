from app.db.session import SessionLocal
from app.models.company import Company

def fix_seats():
    db = SessionLocal()
    companies = db.query(Company).all()
    for c in companies:
        if not c.seats_requested or c.seats_requested == 0:
            if c.max_employee_capacity and c.max_employee_capacity > 0:
                print(f"Fixing seats for {c.company_name}: setting to {c.max_employee_capacity}")
                c.seats_requested = c.max_employee_capacity
            else:
                # Default to some reasonable number if both are 0 or None
                print(f"Fixing seats for {c.company_name}: setting to 100")
                c.seats_requested = 100
                c.max_employee_capacity = 100
    db.commit()
    print("Done")

if __name__ == "__main__":
    fix_seats()
