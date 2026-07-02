from app.db.session import SessionLocal
from app.models.company import Company, CompanyAdmin
from app.schemas.company import CompanyInfoResponse

db = SessionLocal()
admins = db.query(CompanyAdmin).all()
for admin in admins:
    company = db.query(Company).filter(Company.id == admin.company_id).first()
    if company:
        total_employees = 0
        company_dict = company.__dict__.copy()
        company_dict.pop('_sa_instance_state', None)
        company_dict['admin_full_name'] = admin.full_name
        company_dict['admin_mobile'] = admin.mobile
        company_dict['employees_added'] = total_employees
        try:
            CompanyInfoResponse(**company_dict)
            print(f"Success for {company.company_name}")
        except Exception as e:
            print(f"Validation failed for {company.company_name}: {e}")
