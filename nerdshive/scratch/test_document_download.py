import urllib.request
import urllib.parse
import json
import urllib.error
import random
import os

BASE_URL = 'http://localhost:8001/api/v1'

def make_request(url, method='GET', data=None, headers=None):
    if headers is None: headers = {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body)
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return 0, str(e)

def login(email, password):
    # Form data request
    data = urllib.parse.urlencode({"username": email, "password": password}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=data, method='POST', headers={
        'Content-Type': 'application/x-www-form-urlencoded'
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            body = json.loads(response.read().decode('utf-8'))
            return body.get('access_token')
    except Exception as e:
        print(f"Login failed for {email}: {e}")
        return None

def test_document_permissions():
    print("=== Starting Document Download Permissions Verification ===")
    
    # 1. We register two companies: Company A (owner) and Company B (other)
    rand_a = random.randint(1000, 9999)
    rand_b = random.randint(1000, 9999)
    
    email_a = f"owner_a_{rand_a}@example.com"
    email_b = f"other_b_{rand_b}@example.com"
    
    # We will register them directly using python DB session so we can also set the document URL and approve them instantly.
    # We will run a command inside the container to do this, creating a mock file on disk:
    print("\n1. Preparing mock database records and documents...")
    setup_cmd = f"""
from app.db.session import SessionLocal
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser
from app.core.security import get_password_hash
import os

db = SessionLocal()

# Create dummy document file
os.makedirs('/app/storage/company-documents', exist_ok=True)
with open('/app/storage/company-documents/test_doc_{rand_a}.pdf', 'w') as f:
    f.write('PDF content dummy')

# Company A
co_a = Company(
    company_name='Company A {rand_a}',
    company_email='comp_a_{rand_a}@example.com',
    status='approved',
    max_employee_capacity=10,
    company_registration_doc_url='company-documents/test_doc_{rand_a}.pdf'
)
db.add(co_a)
db.flush()

auth_a = AuthUser(email='{email_a}', hashed_password=get_password_hash('password123'), is_active=True)
db.add(auth_a)
db.flush()

admin_a = CompanyAdmin(auth_id=auth_a.id, company_id=co_a.id, full_name='Owner A')
db.add(admin_a)

# Company B
co_b = Company(
    company_name='Company B {rand_b}',
    company_email='comp_b_{rand_b}@example.com',
    status='approved',
    max_employee_capacity=10
)
db.add(co_b)
db.flush()

auth_b = AuthUser(email='{email_b}', hashed_password=get_password_hash('password123'), is_active=True)
db.add(auth_b)
db.flush()

admin_b = CompanyAdmin(auth_id=auth_b.id, company_id=co_b.id, full_name='Owner B')
db.add(admin_b)

db.commit()
db.close()
print('Database mock setup completed successfully.')
"""
    # Write setup python snippet and run it inside the docker container
    with open('scratch/temp_setup_perm.py', 'w') as f:
        f.write(setup_cmd)
        
    os.system("docker compose cp scratch/temp_setup_perm.py backend:/app/temp_setup_perm.py")
    os.system("docker compose exec backend python /app/temp_setup_perm.py")
    os.remove("scratch/temp_setup_perm.py")
    
    # 2. Get JWT tokens
    print("\n2. Getting JWT tokens for all roles...")
    su_token = login("superuser@example.com", "password123")
    admin_token = login("admin@example.com", "password123")
    owner_a_token = login(email_a, "password123")
    owner_b_token = login(email_b, "password123")
    
    doc_url = f"{BASE_URL}/storage/raw/company-documents/test_doc_{rand_a}.pdf"
    
    # 3. Test Superuser Access (Expected 200)
    print(f"\n3. Testing Superuser Access to document: {doc_url}")
    status, res = make_request(doc_url, headers={"Authorization": f"Bearer {su_token}"})
    print(f"   Status: {status} (Expected: 200)")
    assert status == 200
    
    # 4. Test Admin Access (Expected 200)
    print(f"\n4. Testing Admin Access to document: {doc_url}")
    status, res = make_request(doc_url, headers={"Authorization": f"Bearer {admin_token}"})
    print(f"   Status: {status} (Expected: 200)")
    assert status == 200
    
    # 5. Test Owning Company A Admin Access (Expected 200)
    print(f"\n5. Testing Owning Company A Admin Access")
    status, res = make_request(doc_url, headers={"Authorization": f"Bearer {owner_a_token}"})
    print(f"   Status: {status} (Expected: 200)")
    assert status == 200
    
    # 6. Test Different Company B Admin Access (Expected 403 Forbidden)
    print(f"\n6. Testing Different Company B Admin Access")
    status, res = make_request(doc_url, headers={"Authorization": f"Bearer {owner_b_token}"})
    print(f"   Status: {status} (Expected: 403)")
    assert status == 403
    
    # 7. Test Unauthenticated Access (Expected 401 Unauthorized)
    print(f"\n7. Testing Unauthenticated Access")
    status, res = make_request(doc_url)
    print(f"   Status: {status} (Expected: 401)")
    assert status == 401
    
    print("\n--- ALL DOCUMENT PERMISSION TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_document_permissions()
