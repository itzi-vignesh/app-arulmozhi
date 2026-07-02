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

def run():
    print("Starting Govt ID Validation Checks...")
    
    # 1. Register a new user
    email = f"test_id_{random.randint(1000, 9999)}@example.com"
    password = "password123"
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', {
        "email": email,
        "password": password
    })
    assert status == 200, f"Register failed: {body}"
        
    # 2. Login
    status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
        "username": email,
        "password": password
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    assert status == 200, f"Login failed: {body}"
    token = body.get('access_token')
    headers = {"Authorization": f"Bearer {token}"}

    # Get User ID from session
    s_status, s_body = make_request(f"{BASE_URL}/auth/session", 'GET', headers=headers.copy())
    assert s_status == 200, f"Session failed: {s_body}"
    auth_id = s_body.get('session', {}).get('user', {}).get('id')

    # Test A: Create Profile with invalid/legacy type (e.g. passport) -> Should be rejected
    print("\nTest A: Create Profile with 'passport' (legacy)...")
    p_status, p_body = make_request(f"{BASE_URL}/users/", 'POST', {
        "auth_id": auth_id,
        "email": email,
        "full_name": "Test User",
        "mobile": "9876543210",
        "gender": "male",
        "city": "Chennai",
        "location": "Adyar",
        "occupation": "Developer",
        "govt_id_type": "passport",
        "govt_id_number": "A1234567",
        "reimbursement": False
    }, headers=headers.copy())
    print(f"Result (Expected 422): Status={p_status}, Body={p_body}")
    assert p_status == 422, f"Should have failed with 422, but got {p_status}"
    
    # Test B: Create Profile with valid type in lowercase (e.g. aadhaar) -> Should succeed and coerce to uppercase AADHAAR
    print("\nTest B: Create Profile with 'aadhaar' (valid in lowercase)...")
    p_status2, p_body2 = make_request(f"{BASE_URL}/users/", 'POST', {
        "auth_id": auth_id,
        "email": email,
        "full_name": "Test User",
        "mobile": "9876543210",
        "gender": "male",
        "city": "Chennai",
        "location": "Adyar",
        "occupation": "Developer",
        "govt_id_type": "aadhaar",
        "govt_id_number": "123456789012",
        "reimbursement": False
    }, headers=headers.copy())
    print(f"Result (Expected 200/201): Status={p_status2}")
    assert p_status2 in (200, 201), f"Create profile failed: {p_body2}"
    assert p_body2.get("govt_id_type") == "AADHAAR", f"Expected 'AADHAAR', got {p_body2.get('govt_id_type')}"
    print("Coerced to AADHAAR successfully!")

    # Test C: Update Profile with legacy type (e.g. PASSPORT) -> Should be allowed for backward compatibility
    print("\nTest C: Update Profile with legacy type 'PASSPORT'...")
    u_status, u_body = make_request(f"{BASE_URL}/users/me", 'PUT', {
        "govt_id_type": "PASSPORT",
        "govt_id_number": "A9876543"
    }, headers=headers.copy())
    print(f"Result (Expected 200): Status={u_status}, Body={u_body}")
    assert u_status == 200, f"Update profile with legacy failed: {u_body}"
    assert u_body.get("govt_id_type") == "PASSPORT", f"Expected 'PASSPORT', got {u_body.get('govt_id_type')}"
    print("Legacy ID allowed on update successfully!")

    # Test D: Update Profile with invalid ID type -> Should be rejected
    print("\nTest D: Update Profile with completely invalid type 'DRIVER_CARD'...")
    u_status2, u_body2 = make_request(f"{BASE_URL}/users/me", 'PUT', {
        "govt_id_type": "DRIVER_CARD"
    }, headers=headers.copy())
    print(f"Result (Expected 422): Status={u_status2}, Body={u_body2}")
    assert u_status2 == 422, f"Should have failed with 422, but got {u_status2}"

    print("\nAll Backend Govt ID type validation checks passed successfully!")

if __name__ == '__main__':
    run()
