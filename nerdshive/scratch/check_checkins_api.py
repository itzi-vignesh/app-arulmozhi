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

def check_checkins():
    # 1. Login as Admin
    status, body = make_request(
        f"{BASE_URL}/auth/login",
        'POST',
        {"username": "admin@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if status != 200:
        print(f"Admin login failed: {body}")
        return
    
    admin_token = body['access_token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("Admin logged in successfully.")

    # 2. Get check-ins
    status, checkins = make_request(
        f"{BASE_URL}/checkins/",
        'GET',
        headers=admin_headers
    )
    if status != 200:
        print(f"Failed to fetch check-ins: {checkins}")
        return

    print(f"Successfully fetched {len(checkins)} check-ins.")
    for idx, c in enumerate(checkins):
        print(f"[{idx}] Checkin ID: {c.get('id')}")
        print(f"    payment_status: {c.get('payment_status')}")
        plan = c.get('plan')
        if plan:
            print(f"    plan: {json.dumps(plan, indent=2)}")
        else:
            print("    plan: None")

if __name__ == "__main__":
    check_checkins()
