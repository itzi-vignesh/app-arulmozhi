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

def test_flow():
    rand_suffix = str(random.randint(1000, 9999))
    email = f"user_{rand_suffix}@example.com"
    password = "password123"
    new_password = "new_password123"
    
    print(f"Testing with email: {email}")
    
    # 1. Register
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', {
        "email": email,
        "password": password
    })
    print(f"Register: {status}")
    if status != 200:
        print(f"Registration failed: {body}")
        return False
        
    auth_id = body['user']['id']
    
    # 2. Login
    status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
        "username": email,
        "password": password
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    print(f"Login: {status}")
    if status != 200:
        print(f"Login failed: {body}")
        return False
        
    token = body.get('access_token')
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Create User Profile
    status, profile_body = make_request(f"{BASE_URL}/users/", 'POST', {
        "auth_id": auth_id,
        "email": email,
        "full_name": "Test User",
        "mobile": "1234567890",
        "gender": "male",
        "city": "Chennai",
        "location": "Adayar",
        "occupation": "Engineer",
        "govt_id_type": "aadhaar",
        "govt_id_number": "123456789012"
    }, headers=headers.copy())
    print(f"Create Profile: {status}")
    if status != 200:
        print(f"Profile creation failed: {profile_body}")
        return False

    # 4. Update Profile via polymorphic PUT /users/me
    update_data = {
        "full_name": "Updated Test User",
        "mobile": "9876543210",
        "city": "Bangalore",
        "location": "Whitefield",
        "occupation": "Senior Engineer",
        "date_of_birth": "1995-05-15",
        "emergency_contact_name": "Emergency Person",
        "emergency_contact_number": "1122334455",
        "requires_parking": True,
        "vehicle_type": "four_wheeler",
        "vehicle_brand_model": "Tesla Model 3",
        "vehicle_color": "Red",
        "vehicle_registration": "KA03AB1234"
    }
    status, body = make_request(f"{BASE_URL}/users/me", 'PUT', update_data, headers=headers.copy())
    print(f"Update Profile: {status}")
    if status != 200:
        print(f"Profile update failed: {body}")
        return False
        
    # Verify the updated fields are correct in response
    for field, val in update_data.items():
        if body.get(field) != val:
            print(f"Field mismatch for '{field}': expected '{val}', got '{body.get(field)}'")
            return False
    print("Profile update verification: SUCCESS (all fields updated correctly)")
    
    # 5. Change Password
    status, body = make_request(f"{BASE_URL}/auth/change-password", 'POST', {
        "current_password": password,
        "new_password": new_password
    }, headers=headers.copy())
    print(f"Change Password: {status} - {body}")
    if status != 200:
        return False
        
    # 6. Verify Old Password Fails
    status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
        "username": email,
        "password": password
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    print(f"Login with old password (expect fail): {status}")
    if status == 200:
        print("Expected login with old password to fail, but it succeeded!")
        return False
        
    # 7. Verify New Password Succeeds
    status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
        "username": email,
        "password": new_password
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    print(f"Login with new password: {status}")
    if status != 200:
        print(f"Login with new password failed: {body}")
        return False
        
    print("ALL TESTS PASSED SUCCESSFULLY!")
    return True

if __name__ == "__main__":
    test_flow()
