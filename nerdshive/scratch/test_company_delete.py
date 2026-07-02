import uuid
from app.db.session import SessionLocal
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser, User
from app.core.security import get_password_hash

def test_delete():
    db = SessionLocal()
    try:
        # 1. Create a dummy company for testing
        test_company = Company(
            company_name="DeleteTest Ltd",
            company_email="testdelete@example.com",
            status="approved"
        )
        db.add(test_company)
        db.flush()

        # 2. Create a dummy admin for this company
        admin_auth = AuthUser(
            email="admin_deletetest@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True
        )
        db.add(admin_auth)
        db.flush()

        test_admin = CompanyAdmin(
            auth_id=admin_auth.id,
            company_id=test_company.id,
            full_name="Admin DeleteTest",
            mobile="9876543299"
        )
        db.add(test_admin)

        # 3. Create a dummy employee for this company
        emp_auth = AuthUser(
            email="emp_deletetest@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True
        )
        db.add(emp_auth)
        db.flush()

        test_employee = User(
            auth_id=emp_auth.id,
            email="emp_deletetest@example.com",
            full_name="Employee DeleteTest",
            mobile="9876543298",
            emergency_contact_number="9876543297",
            govt_id_type="PAN",
            govt_id_number="ABCDE1234F",
            company_id=test_company.id,
            org_name="DeleteTest Ltd"
        )
        db.add(test_employee)
        db.commit()

        # Verify insertion
        company_id = test_company.id
        admin_auth_id = admin_auth.id
        emp_id = test_employee.id

        assert db.query(Company).filter(Company.id == company_id).first() is not None
        assert db.query(CompanyAdmin).filter(CompanyAdmin.company_id == company_id).first() is not None
        assert db.query(AuthUser).filter(AuthUser.id == admin_auth_id).first() is not None
        assert db.query(User).filter(User.id == emp_id).first().company_id == company_id

        # 4. Trigger delete logic (simulate DELETE /companies/{id} call)
        # Fetch fresh instances
        company_to_del = db.query(Company).filter(Company.id == company_id).first()
        admin_auth_ids = [admin.auth_id for admin in company_to_del.admins]
        db.delete(company_to_del)
        db.flush()

        for auth_id in admin_auth_ids:
            auth_user = db.query(AuthUser).filter(AuthUser.id == auth_id).first()
            if auth_user:
                db.delete(auth_user)
        db.commit()

        # 5. Assertions after deletion
        # Company should be deleted
        assert db.query(Company).filter(Company.id == company_id).first() is None
        # Company Admin relationship record should be deleted (cascade)
        assert db.query(CompanyAdmin).filter(CompanyAdmin.company_id == company_id).first() is None
        # Company Admin's AuthUser record should be deleted (explicit cleanup)
        assert db.query(AuthUser).filter(AuthUser.id == admin_auth_id).first() is None
        # Employee's company_id should be set to NULL (ForeignKey ondelete="SET NULL")
        emp = db.query(User).filter(User.id == emp_id).first()
        assert emp is not None
        assert emp.company_id is None

        print("Test passed successfully!")
        
        # Cleanup employee
        db.delete(emp)
        db.delete(db.query(AuthUser).filter(AuthUser.id == emp_auth.id).first())
        db.commit()

    except Exception as e:
        db.rollback()
        print("Test failed:", e)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    test_delete()
