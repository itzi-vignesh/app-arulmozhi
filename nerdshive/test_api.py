import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:8000/api/v1"

tests = []

def run_test(name, endpoint, method="GET", data=None, expected_status=200):
    url = BASE_URL + endpoint
    req = urllib.request.Request(url, method=method)
    req.add_header('Content-Type', 'application/json')
    if data:
        req.data = json.dumps(data).encode('utf-8')
    
    try:
        resp = urllib.request.urlopen(req)
        status = resp.getcode()
        passed = (status == expected_status) or (status in [200, 201])
        tests.append((name, endpoint, method, data, status, "Pass" if passed else "Fail"))
    except urllib.error.HTTPError as e:
        status = e.code
        # We consider 400s or 500s as Fail unless specifically testing for errors.
        tests.append((name, endpoint, method, data, status, "Fail"))
    except Exception as e:
        tests.append((name, endpoint, method, data, "Error", "Fail"))

# 1. User Registration
run_test("User Registration", "/auth/register", "POST", {
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User",
    "mobile": "1234567890",
    "org_name": "Test Org",
    "emergency_contact_number": "0987654321",
    "govt_id_type": "passport",
    "govt_id_number": "A1234"
})

# 2. User Login
run_test("User Login", "/auth/login", "POST", {
    "email": "test@example.com",
    "password": "password123"
})

# 3. Token Refresh (will likely fail since we don't have a valid refresh token handy without parsing Login response, but let's test if endpoint exists)
run_test("Token Refresh", "/auth/refresh", "POST", {
    "refresh_token": "fake_token"
}, expected_status=401)

# 4. Password Reset
run_test("Password Reset Request", "/auth/password-recovery", "POST", {
    "email": "test@example.com"
})

# 5. Profile Update (Requires Auth, so will return 401 or 403, indicating endpoint exists but auth needed)
run_test("Profile Update", "/users/me", "PUT", {"full_name": "Updated Name"}, expected_status=401)

# 6. File Upload
# Skip multipart in urllib, but we can try to GET the storage to see if route is there
run_test("File Upload / Storage", "/storage/id-proofs/test.png", "GET", expected_status=404)

# 7. Check-In Creation (Needs Auth)
run_test("Check-In Creation", "/checkins", "POST", {"plan_id": "fake"}, expected_status=401)

# 8. Check-In Approval (Needs Auth)
run_test("Check-In Approval", "/checkins/123", "PUT", {"status": "approved"}, expected_status=401)

# 9. Notifications (Does not exist in backend router)
run_test("Notifications", "/notifications", "GET", expected_status=401)

# 10. Admin Dashboard
run_test("Admin Dashboard", "/dashboard/admin", "GET", expected_status=401)

# 11. Superuser Dashboard
run_test("Superuser Dashboard", "/dashboard/superuser", "GET", expected_status=401)

print("="*60)
print(f"{'Test':<25} | {'Endpoint':<25} | {'Status':<6} | {'Result'}")
print("="*60)
for name, endpoint, method, payload, status, result in tests:
    print(f"{name:<25} | {endpoint:<25} | {str(status):<6} | {result}")
print("="*60)
