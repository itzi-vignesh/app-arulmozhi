import requests

BASE_URL = "http://localhost:8001/api/v1"

def test_attendance():
    # Login coadmin
    login_data = {
        "username": "coadmin@gmail.com",
        "password": "password123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
    
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Query attendance
    url = f"{BASE_URL}/company-admin/attendance?date=2026-07-01"
    print(f"Requesting GET {url}...")
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {response.headers}")
    print(f"Body: {response.text}")

if __name__ == "__main__":
    test_attendance()
