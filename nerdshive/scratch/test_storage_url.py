import urllib.request
import urllib.parse
import json
import urllib.error
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

def test_storage():
    # 1. Login as Admin
    print("--- 1. Logging in as Admin ---")
    status, body = make_request(
        f"{BASE_URL}/auth/login",
        'POST',
        {"username": "admin@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if status != 200:
        print(f"Login failed! Status: {status}, Body: {body}")
        sys.exit(1)
    admin_token = body['access_token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin logged in successfully.")

    # 2. Get signed URL for the existing document
    # Path: id-proofs/529c55b2-f17d-4434-873e-4deb2c0819e1/govt-id.jpg
    # Since we support both raw suffix and doubled path (due to prefix stripping):
    # Try calling GET /api/v1/storage/id-proofs/id-proofs/529c55b2-f17d-4434-873e-4deb2c0819e1/govt-id.jpg
    print("\n--- 2. Requesting signed URL with doubled path ---")
    status, body = make_request(
        f"{BASE_URL}/storage/id-proofs/id-proofs/529c55b2-f17d-4434-873e-4deb2c0819e1/govt-id.jpg",
        'GET',
        headers=admin_headers
    )
    print(f"Status: {status}")
    print(f"Body: {body}")
    assert status == 200, f"Failed to get signed URL: {body}"
    assert "signedUrl" in body, "signedUrl key not present in response"
    signed_url = body["signedUrl"]
    print(f"[PASS] Successfully generated signed URL: {signed_url}")

    # 3. Access raw image URL
    print("\n--- 3. Fetching raw image from signed URL ---")
    req = urllib.request.Request(signed_url, headers=admin_headers)
    with urllib.request.urlopen(req) as res:
        img_bytes = res.read()
        status = res.status
    print(f"Raw fetch status: {status}")
    assert status == 200, f"Failed to fetch raw image: {status}"
    assert len(img_bytes) > 0, "Returned image payload is empty"
    print(f"[PASS] Successfully fetched raw image bytes (size: {len(img_bytes)} bytes)")
    
    print("\nALL STORAGE URL TESTS PASSED!")

if __name__ == "__main__":
    test_storage()
