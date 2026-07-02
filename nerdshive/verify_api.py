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

def run():
    results = []
    
    # 1. Register
    email = "test@example.com"
    password = "Password123!"
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', {
        "email": email,
        "password": password
    })
    results.append(f"Register: {status} - {body}")
        
    # 2. Login
    status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
        "username": email,
        "password": password
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    results.append(f"Login: {status} - {body if status != 200 else 'OK'}")
    
    token = None
    if status == 200 and isinstance(body, dict):
        token = body.get('access_token')

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Get User ID from session
    auth_id = None
    if token:
        s_status, s_body = make_request(f"{BASE_URL}/auth/session", 'GET', headers=headers.copy())
        if s_status == 200 and isinstance(s_body, dict):
            auth_id = s_body.get('session', {}).get('user', {}).get('id')
            results.append(f"Session Get: {s_status} - User ID: {auth_id}")
        else:
            results.append(f"Session Get Failed: {s_status} - {s_body}")

    # Create User Profile if auth_id obtained
    if auth_id:
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
        results.append(f"Profile Create: {p_status} - {p_body}")

    # 3. Settings Save
    status, body = make_request(f"{BASE_URL}/users/me", 'PUT', {"full_name": "Test User Updated"}, headers=headers.copy())
    results.append(f"Settings Save (users/me): {status} - {body}")

    # 4. Notifications
    status, body = make_request(f"{BASE_URL}/notifications/", 'GET', headers=headers.copy())
    results.append(f"Notifications: {status} - {body}")

    with open('e:/1/api_verify_results.txt', 'w') as f:
        f.write('\n'.join(results))

run()

