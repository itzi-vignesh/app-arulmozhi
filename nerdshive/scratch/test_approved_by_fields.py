import urllib.request
import urllib.parse
import json
import urllib.error
import random

BASE_URL = 'http://localhost:8001/api/v1'

def make_request(url, method='GET', data=None, headers=None):
    if headers is None: headers = {}
    if data is not None:
        if isinstance(data, dict) and headers.get('Content-Type') != 'application/x-www-form-urlencoded':
            data = json.dumps(data).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        elif headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            data = urllib.parse.urlencode(data).encode('utf-8')
            
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body)
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return 0, str(e)

def login(email, password):
    status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
        "username": email,
        "password": password
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    if status == 200:
        return body.get('access_token')
    return None

def test_approved_by_fields():
    print("=== Starting Approved By Fields Integration Test ===")
    
    # 1. Register a test company
    rand_suffix = random.randint(1000, 9999)
    company_email = f"approver_test_{rand_suffix}@example.com"
    admin_email = f"approver_admin_{rand_suffix}@example.com"
    
    payload = {
        "company_name": f"Approver Test Corp {rand_suffix}",
        "company_email": company_email,
        "gst_number": "33ABCDE1234F1Z5",
        "industry_type": "Technology",
        "company_website": "https://approvertest.com",
        "address": "123 Technology Park",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600001",
        "max_employee_capacity": 40,
        "seats_requested": 40,
        "admin_full_name": f"Approver Admin {rand_suffix}",
        "admin_email": admin_email,
        "admin_mobile": "9876543210",
        "admin_designation": "Director",
        "admin_password": "password123"
    }
    
    print(f"\n1. Registering test company: {company_email}")
    status, company = make_request(f"{BASE_URL}/companies/register", 'POST', payload)
    assert status == 200
    company_id = company["id"]
    
    # Check that approved_by is initially None
    assert company.get("approved_by") is None
    assert company.get("approved_by_name") is None
    assert company.get("approved_by_email") is None
    print("   Register success. Approver fields are initially None.")
    
    # 2. Approve company as Superuser
    su_token = login("superuser@example.com", "password123")
    su_headers = {"Authorization": f"Bearer {su_token}"}
    
    print("\n2. Approving company as Superuser")
    status, approved_co = make_request(f"{BASE_URL}/companies/{company_id}/approve", 'PUT', headers=su_headers)
    assert status == 200
    
    # Superuser ID is set, let's verify approved_by_name and approved_by_email are populated
    print(f"   Response from Superuser approve:")
    print(f"   approved_by: {approved_co.get('approved_by')}")
    print(f"   approved_by_name: {approved_co.get('approved_by_name')}")
    print(f"   approved_by_email: {approved_co.get('approved_by_email')}")
    
    assert approved_co.get("approved_by") is not None
    # Superuser full name in database is "Super User" (or whatever was seeded), but let's assert it's a string and email matches
    assert isinstance(approved_co.get("approved_by_name"), str)
    assert approved_co.get("approved_by_email") == "superuser@example.com"
    
    # 3. Log in as Company Admin and verify GET /my-company
    print(f"\n3. Logging in as Company Admin: {admin_email}")
    co_token = login(admin_email, "password123")
    co_headers = {"Authorization": f"Bearer {co_token}"}
    
    status, my_company = make_request(f"{BASE_URL}/company-admin/my-company", headers=co_headers)
    assert status == 200
    print(f"   Response from GET /company-admin/my-company:")
    print(f"   approved_by_name: {my_company.get('approved_by_name')}")
    print(f"   approved_by_email: {my_company.get('approved_by_email')}")
    
    assert my_company.get("approved_by_name") == approved_co.get("approved_by_name")
    assert my_company.get("approved_by_email") == "superuser@example.com"
    
    # 4. Perform an update and check response
    print("\n4. Performing profile update as Company Admin")
    status, updated_co = make_request(f"{BASE_URL}/company-admin/my-company", 'PUT', {
        "company_name": f"Approver Test Corp {rand_suffix} Updated",
        "company_email": company_email,
        "admin_full_name": f"Approver Admin {rand_suffix}",
        "admin_mobile": "9876543210"
    }, headers=co_headers)
    assert status == 200
    print(f"   Response from PUT /company-admin/my-company:")
    print(f"   approved_by_name: {updated_co.get('approved_by_name')}")
    print(f"   approved_by_email: {updated_co.get('approved_by_email')}")
    
    assert updated_co.get("approved_by_name") == approved_co.get("approved_by_name")
    assert updated_co.get("approved_by_email") == "superuser@example.com"
    
    print("\n--- ALL APPROVED BY TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_approved_by_fields()
