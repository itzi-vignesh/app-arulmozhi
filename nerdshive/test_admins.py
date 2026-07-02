import requests
import json
token_resp = requests.post('http://localhost:8001/api/v1/auth/login', data={'username':'superuser@nerdshive.com', 'password':'password123'})
if token_resp.status_code != 200:
    print("Login failed:", token_resp.json())
else:
    token = token_resp.json()['access_token']
    resp = requests.get('http://localhost:8001/api/v1/admins/', headers={'Authorization': f'Bearer {token}'})
    print(json.dumps(resp.json(), indent=2))
