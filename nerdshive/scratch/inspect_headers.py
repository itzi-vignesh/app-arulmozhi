import urllib.request
import urllib.parse
import json
import urllib.error
import sys

BASE_URL = 'http://localhost:8000/api/v1'

def main():
    # 1. Login as Admin
    print("--- Logging in ---")
    login_data = urllib.parse.urlencode({"username": "admin@example.com", "password": "password123"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=login_data, method='POST', headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as res:
        body = json.loads(res.read().decode('utf-8'))
        admin_token = body['access_token']
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Get signed URL
    url = f"{BASE_URL}/storage/id-proofs/id-proofs/529c55b2-f17d-4434-873e-4deb2c0819e1/govt-id.jpg"
    req = urllib.request.Request(url, headers=admin_headers)
    with urllib.request.urlopen(req) as res:
        body = json.loads(res.read().decode('utf-8'))
        signed_url = body["signedUrl"]
        
    print(f"Signed URL: {signed_url}")
    
    # 3. Request raw URL and print headers
    req = urllib.request.Request(signed_url, headers=admin_headers)
    with urllib.request.urlopen(req) as res:
        print("\nResponse Status:", res.status)
        print("\nResponse Headers:")
        for k, v in res.info().items():
            print(f"  {k}: {v}")
        
        # Read a small snippet of the body
        body_snippet = res.read(100)
        print("\nBody Snippet (first 100 bytes):", body_snippet)
        
if __name__ == "__main__":
    main()
