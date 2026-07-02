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
from app.models.audit import QueryLog

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

def test_reject_user():
    # 1. Login as Admin
    print("--- 1. Logging in as Admin ---")
    status, body = make_request(
        f"{BASE_URL}/auth/login",
        'POST',
        {"username": "admin@nerdshive.local", "password": "Admin@123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert status == 200, f"Admin login failed: {body}"
    admin_token = body['access_token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin logged in successfully.")

    # 2. Register a temporary test user
    rand_suffix = str(random.randint(10000, 99999))
    email = f"reject_test_{rand_suffix}@example.com"
    password = "password123"
    print(f"\n--- 2. Registering test user: {email} ---")
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', {"email": email, "password": password})
    assert status == 200, f"User registration failed: {body}"
    user_auth_id = body['user']['id']
    user_token = body['access_token']
    user_headers = {"Authorization": f"Bearer {user_token}"}
    print(f"[PASS] User registered. auth_id={user_auth_id}")

    # 3. Create user profile
    print("\n--- 3. Creating user profile ---")
    status, body = make_request(f"{BASE_URL}/users/", 'POST', {
        "auth_id": user_auth_id,
        "email": email,
        "full_name": "Reject Test User",
        "mobile": "9876543210",
        "gender": "male",
        "govt_id_type": "aadhaar",
        "govt_id_number": "999988887777"
    }, headers=user_headers)
    assert status == 200, f"Profile creation failed: {body}"
    user_id = body['id']
    print(f"[PASS] User profile created. user_id={user_id}")

    # 3.5. Create a support query for this user
    print("\n--- 3.5. Submitting support query for user ---")
    status, body = make_request(
        f"{BASE_URL}/queries",
        'POST',
        {"message": "I need help with my parking space"},
        headers=user_headers
    )
    assert status == 200, f"Query creation failed: {body}"
    query_id = body['id']
    print(f"[PASS] Support query submitted. query_id={query_id}")

    # 4. Call PUT /api/v1/users/{user_id}/reject as Admin
    print(f"\n--- 4. Rejecting user via API ---")
    status, body = make_request(
        f"{BASE_URL}/users/{user_id}/reject",
        'PUT',
        {"reason": "Testing rejection cascade"},
        headers=admin_headers
    )
    print(f"Reject response status: {status}")
    print(f"Reject response body: {body}")
    assert status == 200, f"User rejection failed: {body}"
    print("[PASS] User rejected successfully via API.")

    # 5. Connect to database to verify records are completely removed
    print("\n--- 5. Verifying DB records ---")
    db_url = settings.DATABASE_URL
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    auth_record = session.query(AuthUser).filter(AuthUser.id == user_auth_id).first()
    user_record = session.query(User).filter(User.id == user_id).first()
    query_record = session.query(QueryLog).filter(QueryLog.id == query_id).first()

    assert auth_record is None, "AuthUser record still exists in database!"
    assert user_record is None, "User record still exists in database!"
    assert query_record is None, "QueryLog record still exists in database!"
    print("[PASS] Referencing QueryLog record deleted successfully from DB!")
    print("[PASS] Both AuthUser and User records deleted successfully from DB!")
    print("\nALL REJECTION CASCADE TESTS PASSED!")

if __name__ == "__main__":
    test_reject_user()
