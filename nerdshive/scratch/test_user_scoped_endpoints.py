import urllib.request
import urllib.parse
import json
import urllib.error
import random

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

def test_user_scoped():
    rand_suffix = str(random.randint(10000, 99999))
    email = f"scopetest_{rand_suffix}@example.com"
    password = "password123"

    print(f"--- Testing user-scoped endpoints with: {email} ---\n")

    # Register
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', {"email": email, "password": password})
    assert status == 200, f"Register failed: {body}"
    auth_id = body['user']['id']
    token = body['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[PASS] Register: {status}")

    # Create profile
    status, body = make_request(f"{BASE_URL}/users/", 'POST', {
        "auth_id": auth_id, "email": email,
        "full_name": "Scope Test User", "mobile": "9000000001",
        "gender": "male", "govt_id_type": "aadhaar", "govt_id_number": "111122223333"
    }, headers=headers.copy())
    assert status == 200, f"Create Profile failed: {body}"
    user_id = body['id']
    print(f"[PASS] Create Profile: {status} | user.id={user_id}")

    # GET /plans/my — should return [] for new user
    status, body = make_request(f"{BASE_URL}/plans/my", headers=headers.copy())
    assert status == 200, f"GET /plans/my failed: {body}"
    assert isinstance(body, list), f"Expected list, got: {body}"
    print(f"[PASS] GET /plans/my: {status} | count={len(body)}")

    # GET /checkins/my — should return [] for new user
    status, body = make_request(f"{BASE_URL}/checkins/my", headers=headers.copy())
    assert status == 200, f"GET /checkins/my failed: {body}"
    assert isinstance(body, list), f"Expected list, got: {body}"
    print(f"[PASS] GET /checkins/my: {status} | count={len(body)}")

    # GET /queries/my — should return [] for new user
    status, body = make_request(f"{BASE_URL}/queries/my", headers=headers.copy())
    assert status == 200, f"GET /queries/my failed: {body}"
    assert isinstance(body, list), f"Expected list, got: {body}"
    print(f"[PASS] GET /queries/my: {status} | count={len(body)}")

    # POST /queries — submit a query
    status, body = make_request(f"{BASE_URL}/queries", 'POST', {"message": "Test query from scope test"}, headers=headers.copy())
    assert status == 200, f"POST /queries failed: {body}"
    print(f"[PASS] POST /queries: {status} | query.id={body['id']}")

    # GET /queries/my — should now return 1 query belonging to this user
    status, body = make_request(f"{BASE_URL}/queries/my", headers=headers.copy())
    assert status == 200, f"GET /queries/my (post-create) failed: {body}"
    assert len(body) == 1, f"Expected 1 query, got {len(body)}"
    assert body[0]['message'] == "Test query from scope test"
    print(f"[PASS] GET /queries/my (post-create): {status} | count={len(body)} | message='{body[0]['message']}'")

    # Verify user-scoped endpoints are NOT accessible without token (401)
    status, body = make_request(f"{BASE_URL}/plans/my")
    assert status == 401, f"Expected 401 without auth, got {status}"
    print(f"[PASS] GET /plans/my without auth returns 401")

    print("\nALL USER-SCOPED ENDPOINT TESTS PASSED!")

if __name__ == "__main__":
    test_user_scoped()
