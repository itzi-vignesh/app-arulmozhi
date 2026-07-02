import urllib.request
import urllib.parse
import json
import urllib.error
import random
import os
import sys

# Add backend to sys.path to query DB directly for verification
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser, User
from app.models.audit import ActivityLog

BASE_URL = 'http://localhost:8000/api/v1'

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
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return 0, str(e)

def test_bulk_enroll():
    # 1. Login as Admin
    print("--- 1. Logging in as Admin ---")
    status, body = make_request(
        f"{BASE_URL}/auth/login",
        'POST',
        {"username": "admin@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert status == 200, f"Admin login failed: {body}"
    admin_token = body['access_token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin logged in successfully.")

    # 2. Test Invalid CSV Upload (e.g. Sales Data)
    print("\n--- 2. Testing Invalid CSV (Sales Data) ---")
    sales_csv = (
        "Date,Region,Product,Sales,Target,Profit,Quantity\n"
        "2024-01-01,South,Mobile,41969,37957,6143,5\n"
        "2024-01-02,East,Tablet,40475,39441,6152,10\n"
    )
    status, body = make_request(
        f"{BASE_URL}/users/bulk-enroll",
        'POST',
        {"csvData": sales_csv, "fileName": "electronics_sales.csv"},
        headers=admin_headers
    )
    print(f"Status: {status}")
    print(f"Body snippet: {str(body)[:300]}")
    # The endpoint parses the CSV, runs validation and returns status: true but summary with failed entries or raises HTTP status if parsing is wrong
    assert status == 200, f"Should return 200 OK for processing status, but got {status}: {body}"
    assert body.get("success") is True, f"Response success should be True: {body}"
    summary = body.get("summary", {})
    assert summary.get("failed") > 0, "Invalid rows should show up as failed"
    assert len(body.get("allErrors", [])) > 0, "Errors should be listed"
    print("[PASS] Invalid CSV successfully rejected with descriptive errors.")

    # 3. Test Valid CSV Upload
    print("\n--- 3. Testing Valid CSV Upload ---")
    rand_suffix = str(random.randint(1000, 9999))
    email1 = f"enroll_test_a_{rand_suffix}@example.com"
    email2 = f"enroll_test_b_{rand_suffix}@example.com"
    
    # Required columns: name, email, mobile, dateOfBirth, companyName, joiningDate, idProofType, idProofNumber, emergencyContactNumber
    valid_csv = (
        "S.No,Full Name,Gender,Date of Birth,Mobile No,Email ID,Emergency Contact Person,Emergency Contact No,"
        "Company Name,Department,Designation,Employee ID,Joining Date in NH,Duration,ID Proof Type,ID Proof Number,"
        "Do you require parking,Vehicle Type,Vehicle Brand & Model,Vehicle Color,Vehicle Registration Number\n"
        f"1,Alice Smith,female,15-08-1995,9876543210,{email1},Bob Smith,9876543211,"
        "Nerdshive,Engineering,Developer,EMP101,01-06-2026,permanent,Aadhaar,123456789012,"
        "Yes,Car,Tesla Model 3,Red,KA-01-MJ-1234\n"
        f"2,Charlie Brown,male,20-10-1990,9123456789,{email2},Snoopy,9123456780,"
        "Nerdshive,Operations,Manager,EMP102,15-06-2026,temporary,PAN,ABCDE1234F,"
        "No,,,,\n"
    )
    
    status, body = make_request(
        f"{BASE_URL}/users/bulk-enroll",
        'POST',
        {"csvData": valid_csv, "fileName": "valid_users.csv"},
        headers=admin_headers
    )
    print(f"Status: {status}")
    print(f"Body: {body}")
    assert status == 200, f"Valid CSV enrollment failed: {body}"
    assert body.get("success") is True
    summary = body.get("summary", {})
    assert summary.get("successful") == 2, f"Expected 2 successful enrollments, got: {summary}"
    
    # 4. Verify in DB
    print("\n--- 4. Verifying DB records for enrolled users ---")
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    for email, name, expected_customer_id_prefix in [(email1, "Alice Smith", "NH-"), (email2, "Charlie Brown", "NH-")]:
        user_record = session.query(User).filter_by(email=email).first()
        assert user_record is not None, f"User record not found for {email}"
        assert user_record.full_name == name
        assert user_record.customer_id.startswith(expected_customer_id_prefix)
        print(f"[PASS] User {name} exists with customer_id {user_record.customer_id}")
        
        auth_record = session.query(AuthUser).filter_by(id=user_record.auth_id).first()
        assert auth_record is not None, f"AuthUser record not found for {email}"
        assert auth_record.hashed_password is not None
        
        # Check ActivityLog
        activity = session.query(ActivityLog).filter_by(target_user_id=auth_record.id).first()
        assert activity is not None, f"Activity log not found for {name}"
        assert activity.action == "bulk_user_enrolled"
        print(f"[PASS] Activity log found for {name} with action {activity.action}")
        
    print("\nALL BULK ENROLLMENT TESTS PASSED!")

if __name__ == "__main__":
    test_bulk_enroll()
