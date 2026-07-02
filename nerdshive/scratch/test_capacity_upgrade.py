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

def test_workflow():
    print("=== Starting Capacity Upgrade Workflow Verification ===")
    
    # 1. Register a test company with capacity 40
    rand_suffix = random.randint(1000, 9999)
    company_email = f"test_company_{rand_suffix}@example.com"
    admin_email = f"test_admin_{rand_suffix}@example.com"
    
    payload = {
        "company_name": f"Test Corp {rand_suffix}",
        "company_email": company_email,
        "gst_number": "33ABCDE1234F1Z5",
        "industry_type": "Technology",
        "company_website": "https://testcorp.com",
        "address": "123 Technology Park",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600001",
        "max_employee_capacity": 40,
        "seats_requested": 40,
        "admin_full_name": f"Test Admin {rand_suffix}",
        "admin_email": admin_email,
        "admin_mobile": "9876543210",
        "admin_designation": "Director",
        "admin_password": "password123"
    }
    
    print(f"\n1. Registering test company: {company_email}")
    status, company = make_request(f"{BASE_URL}/companies/register", 'POST', payload)
    if status != 200:
        print(f"Error registering company: {company}")
        return
    company_id = company["id"]
    print(f"   Registered successfully. ID: {company_id}, Status: {company['status']}")
    
    # 2. Approve company registration as Superuser
    su_token = login("superuser@example.com", "password123")
    su_headers = {"Authorization": f"Bearer {su_token}"}
    
    print(f"\n2. Approving company registration as Superuser")
    status, res = make_request(f"{BASE_URL}/companies/{company_id}/approve", 'PUT', headers=su_headers)
    if status != 200:
        print(f"Failed to approve company: {res}")
        return
    print("   Company approved.")
    
    # 3. Log in as Company Admin
    print(f"\n3. Logging in as Company Admin: {admin_email}")
    co_token = login(admin_email, "password123")
    co_headers = {"Authorization": f"Bearer {co_token}"}
    
    # 4. Check initial dashboard stats
    status, stats = make_request(f"{BASE_URL}/company-admin/dashboard", headers=co_headers)
    print(f"   Initial stats: capacity={stats.get('max_employee_capacity')}, requested={stats.get('seats_requested')}, available={stats.get('seats_available')}")
    assert stats.get('max_employee_capacity') == 40
    assert stats.get('seats_available') == 40
    
    # 5. Verify invalid requested_capacity <= maximum_capacity is rejected
    print(f"\n4. Requesting invalid capacity upgrade to 35 (<= 40)")
    # We update company details
    status, res = make_request(f"{BASE_URL}/company-admin/my-company", 'PUT', {
        "company_name": f"Test Corp {rand_suffix}",
        "company_email": company_email,
        "admin_full_name": f"Test Admin {rand_suffix}",
        "admin_mobile": "9876543210",
        "seats_requested": 35
    }, headers=co_headers)
    print(f"   Status: {status}, Detail: {res.get('detail')}")
    assert status == 400
    assert res.get('detail') == "Requested capacity must be greater than current approved capacity (40)."
    
    # Same for equal (40)
    print(f"\n5. Requesting invalid capacity upgrade to 40 (<= 40)")
    status, res = make_request(f"{BASE_URL}/company-admin/my-company", 'PUT', {
        "company_name": f"Test Corp {rand_suffix}",
        "company_email": company_email,
        "admin_full_name": f"Test Admin {rand_suffix}",
        "admin_mobile": "9876543210",
        "seats_requested": 40
    }, headers=co_headers)
    print(f"   Status: {status}, Detail: {res.get('detail')}")
    assert status == 400
    assert res.get('detail') == "Requested capacity must be greater than current approved capacity (40)."
    
    # 6. Request valid capacity upgrade to 50
    print(f"\n6. Requesting valid capacity upgrade to 50")
    status, res = make_request(f"{BASE_URL}/company-admin/my-company", 'PUT', {
        "company_name": f"Test Corp {rand_suffix}",
        "company_email": company_email,
        "admin_full_name": f"Test Admin {rand_suffix}",
        "admin_mobile": "9876543210",
        "seats_requested": 50
    }, headers=co_headers)
    print(f"   Status: {status}, seats_requested in response: {res.get('seats_requested')}")
    assert status == 200
    assert res.get('seats_requested') == 50
    
    # 7. Check stats BEFORE approval: max_employee_capacity must remain 40, available seats must remain 40
    status, stats = make_request(f"{BASE_URL}/company-admin/dashboard", headers=co_headers)
    print(f"   Stats BEFORE approval: capacity={stats.get('max_employee_capacity')}, requested={stats.get('seats_requested')}, available={stats.get('seats_available')}")
    assert stats.get('max_employee_capacity') == 40
    assert stats.get('seats_available') == 40
    
    # 8. Verify Superuser received notification
    status, su_notifs = make_request(f"{BASE_URL}/notifications", headers=su_headers)
    upgrade_notif = next((n for n in su_notifs if f"Test Corp {rand_suffix}" in n['message'] and "increase from 40 to 50" in n['message']), None)
    print(f"\n7. Checking Superuser notification: {'FOUND' if upgrade_notif else 'NOT FOUND'}")
    if upgrade_notif:
        print(f"   Message: '{upgrade_notif['message']}'")
    assert upgrade_notif is not None
    
    # Verify Admin received notification
    admin_token = login("admin@example.com", "password123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    status, admin_notifs = make_request(f"{BASE_URL}/notifications", headers=admin_headers)
    admin_upgrade_notif = next((n for n in admin_notifs if f"Test Corp {rand_suffix}" in n['message'] and "awaiting Superuser approval" in n['message']), None)
    print(f"   Checking Admin notification: {'FOUND' if admin_upgrade_notif else 'NOT FOUND'}")
    if admin_upgrade_notif:
        print(f"   Message: '{admin_upgrade_notif['message']}'")
    assert admin_upgrade_notif is not None
    
    # 9. Admin tries to approve (should fail with 403)
    print(f"\n8. Admin attempting to approve upgrade (Expected 403)")
    status, res = make_request(f"{BASE_URL}/companies/{company_id}/approve-seats", 'PUT', headers=admin_headers)
    print(f"   Status: {status}, Detail: {res.get('detail') if isinstance(res, dict) else res}")
    assert status == 403
    
    # 10. Superuser approves request
    print(f"\n9. Superuser approving capacity upgrade")
    status, res = make_request(f"{BASE_URL}/companies/{company_id}/approve-seats", 'PUT', headers=su_headers)
    print(f"   Status: {status}, max_employee_capacity: {res.get('max_employee_capacity')}")
    assert status == 200
    assert res.get('max_employee_capacity') == 50
    
    # 11. Check stats AFTER approval: max_employee_capacity must become 50, available seats must become 50
    status, stats = make_request(f"{BASE_URL}/company-admin/dashboard", headers=co_headers)
    print(f"   Stats AFTER approval: capacity={stats.get('max_employee_capacity')}, requested={stats.get('seats_requested')}, available={stats.get('seats_available')}")
    assert stats.get('max_employee_capacity') == 50
    assert stats.get('seats_available') == 50
    
    # 12. Check company notification
    status, co_notifs = make_request(f"{BASE_URL}/notifications", headers=co_headers)
    co_approved_notif = next((n for n in co_notifs if "request has been approved" in n['message']), None)
    print(f"\n10. Checking Company notification: {'FOUND' if co_approved_notif else 'NOT FOUND'}")
    if co_approved_notif:
        print(f"    Message: '{co_approved_notif['message']}'")
    assert co_approved_notif is not None
    
    print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_workflow()
