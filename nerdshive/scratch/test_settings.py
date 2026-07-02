import urllib.request
import urllib.parse
import json
import urllib.error
import random
import os
import sys

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

def test_settings():
    # Login as Admin
    status, body = make_request(
        f"{BASE_URL}/auth/login",
        'POST',
        {"username": "admin@nerdshive.local", "password": "Admin@123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert status == 200, f"Admin login failed: {body}"
    admin_token = body['access_token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin logged in.")

    # GET /users/me
    status, body = make_request(f"{BASE_URL}/users/me", headers=admin_headers)
    print(f"GET /users/me response status: {status}")
    print(f"GET /users/me response body: {body}")
    assert status == 200, f"GET /users/me failed: {body}"
    assert 'auth_id' in body, "Expected profile response containing auth_id"
    print("[PASS] GET /users/me returned admin profile successfully.")

    # PUT /users/me
    status, body = make_request(
        f"{BASE_URL}/users/me",
        'PUT',
        {"full_name": "Test Admin Updated"},
        headers=admin_headers
    )
    print(f"PUT /users/me response status: {status}")
    print(f"PUT /users/me response body: {body}")
    assert status == 200, f"PUT /users/me failed: {body}"
    assert body['full_name'] == "Test Admin Updated", "Expected updated name"
    print("[PASS] PUT /users/me updated admin profile successfully.")

    print("\nALL SETTINGS API TESTS PASSED!")

if __name__ == "__main__":
    test_settings()
