import urllib.request
import urllib.parse
import json
import urllib.error

BASE_URL = 'http://localhost:8001/api/v1'

def make_request(url, method='POST', data=None):
    headers = {'Content-Type': 'application/json'}
    if data is not None:
        data = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = response.read()
            return response.status, json.loads(res_data.decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return 0, str(e)

def test_registration_validation():
    # Attempt registration with a 6-character password (invalid backend length)
    payload = {
        "email": "validation_error_test@example.com",
        "password": "short"
    }
    print(f"Request payload: {json.dumps(payload, indent=2)}")
    
    status, body = make_request(f"{BASE_URL}/auth/register", 'POST', payload)
    
    print(f"Response status: {status}")
    print(f"Response body: {json.dumps(body, indent=2)}")

if __name__ == "__main__":
    test_registration_validation()
