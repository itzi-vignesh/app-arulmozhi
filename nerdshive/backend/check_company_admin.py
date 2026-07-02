from app.db.session import SessionLocal
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser

db = SessionLocal()
admins = db.query(CompanyAdmin).all()
print(f'Total company admins: {len(admins)}')
for admin in admins:
    print(f'Admin {admin.full_name}: auth_id={admin.auth_id}, company_id={admin.company_id}')
    company = db.query(Company).filter(Company.id == admin.company_id).first()
    print(f'  Company: {company.company_name if company else "None"}')
