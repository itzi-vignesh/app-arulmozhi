import urllib.request
import urllib.parse
import json
import urllib.error
import random
import os
import sys

# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.user import AuthUser
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
            res_data = response.read()
            try:
                return response.status, json.loads(res_data.decode('utf-8'))
            except Exception:
                return response.status, res_data.decode('utf-8')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return 0, str(e)

def test_query_response():
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

    # 2. Register/Login as Customer to submit a query
    print("\n--- 2. Registering Customer ---")
    rand_suffix = str(random.randint(10000, 99999))
    email = f"querytest_{rand_suffix}@example.com"
    password = "password123"
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', {"email": email, "password": password})
    assert status == 200, f"User registration failed: {body}"
    user_token = body['access_token']
    user_headers = {"Authorization": f"Bearer {user_token}"}
    print("[PASS] Customer registered and logged in.")

    # 3. Create a query
    print("\n--- 3. Submitting query ---")
    status, body = make_request(
        f"{BASE_URL}/queries",
        'POST',
        {"message": "This is a test query"},
        headers=user_headers
    )
    assert status == 200, f"Query creation failed: {body}"
    query_id = body['id']
    print(f"[PASS] Query created with ID: {query_id}")

    # 4. Respond to query as Admin
    print("\n--- 4. Responding to query as Admin ---")
    status, body = make_request(
        f"{BASE_URL}/queries/{query_id}",
        'PUT',
        {"response": "Here is the response", "status": "answered"},
        headers=admin_headers
    )
    print(f"Status: {status}")
    print(f"Body: {body}")
    
if __name__ == "__main__":
    test_query_response()
