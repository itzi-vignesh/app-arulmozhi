import requests
import time

url = "http://localhost:8000/api/v1/auth/register"
# Use a unique email each run so we never hit "Email already registered"
unique_email = f"testuser_{int(time.time())}@example.com"
payload = {
    "email": unique_email,
    "password": "password1",  # 8 characters, matches min_length=8
}

print("Testing with 8-character password:")
res = requests.post(url, json=payload)
print("Status:", res.status_code)
print("Response:", res.text)

print("\nTesting with 6-character password:")
payload["password"] = "123456"
res = requests.post(url, json=payload)
print("Status:", res.status_code)
print("Response:", res.text)
