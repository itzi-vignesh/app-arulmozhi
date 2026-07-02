import urllib.request
import urllib.parse
import json
import urllib.error

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

def run_tests():
    print("--- Running Pricing Restructure Verification ---")
    
    # 1. Public user - Customer plans
    status, customer_plans = make_request(f"{BASE_URL}/pricing/customer")
    print(f"\n1. GET /pricing/customer: Status {status}")
    for p in customer_plans:
        print(f"   - {p['plan_name']} (Category: {p['category']}, Price: Rs.{p['price']}, Features: {p['features_json']})")

    # 2. Get tokens for Superuser and Admin
    su_token = login("superuser@example.com", "password123")
    admin_token = login("admin@example.com", "password123")
    
    su_headers = {"Authorization": f"Bearer {su_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 3. Superuser: View all pricing plans
    status, su_plans = make_request(f"{BASE_URL}/superuser/pricing", headers=su_headers)
    print(f"\n2. GET /superuser/pricing: Status {status}")
    print(f"   Found {len(su_plans)} plans.")
    
    # Find hot desk plan and corporate plan IDs
    hot_desk_plan = next((p for p in su_plans if p['plan_name'] == "HOT DESK"), None)
    team_plan = next((p for p in su_plans if p['plan_name'] == "MONTHLY TEAM PLAN"), None)
    
    if not hot_desk_plan or not team_plan:
        print("Error: Default plans not found.")
        return
        
    # 4. Superuser: Edit Corporate plan price
    print(f"\n3. Superuser modifying MONTHLY TEAM PLAN price: Rs.{team_plan['price']} -> Rs.6000")
    status, res = make_request(
        f"{BASE_URL}/superuser/pricing/{team_plan['id']}", 
        'PUT', 
        {"price": 6000}, 
        headers=su_headers
    )
    print(f"   Status: {status}, New Price: Rs.{res.get('price') if status == 200 else 'FAILED'}")
    
    # 5. Admin: Try to edit Corporate plan (Should fail with 403)
    print(f"\n4. Admin modifying MONTHLY TEAM PLAN price: Rs.6000 -> Rs.5500 (Expected 403)")
    status, res = make_request(
        f"{BASE_URL}/admin/pricing/customer/{team_plan['id']}", 
        'PUT', 
        {"price": 5500}, 
        headers=admin_headers
    )
    print(f"   Status: {status}, Response: {res}")
    
    # 6. Admin: Edit Customer plan (HOT DESK) price
    print(f"\n5. Admin modifying HOT DESK price: Rs.{hot_desk_plan['price']} -> Rs.750")
    status, res = make_request(
        f"{BASE_URL}/admin/pricing/customer/{hot_desk_plan['id']}", 
        'PUT', 
        {"price": 750}, 
        headers=admin_headers
    )
    print(f"   Status: {status}, New Price: Rs.{res.get('price') if status == 200 else 'FAILED'}")
    
    # 7. Check if Activity Logs were populated
    status, logs = make_request(f"{BASE_URL}/activity_logs", headers=su_headers)
    print(f"\n6. GET /activity_logs: Status {status}")
    for log in logs[:5]:
        print(f"   - [{log['created_at']}] {log['performed_by_name']} ({log['performed_by_role']}): {log['action'].replace('₹', 'Rs.').replace('→', '->')}")

if __name__ == "__main__":
    run_tests()
