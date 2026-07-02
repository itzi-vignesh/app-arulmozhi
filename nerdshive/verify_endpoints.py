import requests
import json
import time

BASE_URL = "http://localhost:8001/api/v1"
unique_suffix = int(time.time())

# 1. Register a new company
print("--- 1. Registering a company ---")
company_payload = {
    "company_name": f"Test Company {unique_suffix}",
    "gst_number": f"22ABCDE{unique_suffix % 10000:04d}F1Z5",
    "industry_type": "IT Services",
    "company_email": f"test{unique_suffix}@company.com",
    "company_website": f"https://test{unique_suffix}.com",
    "address": "123 Test St",
    "city": "Testville",
    "state": "Test State",
    "pincode": "123456",
    "max_employee_capacity": 10,
    "seats_requested": 5,
    "admin_full_name": "Test Admin",
    "admin_email": f"admin{unique_suffix}@company.com",
    "admin_mobile": f"9{unique_suffix % 1000000000:09d}",
    "admin_password": "Password123!"
}

res = requests.post(f"{BASE_URL}/companies/register", json=company_payload)
print(f"Status Code: {res.status_code}")
if res.status_code != 200:
    print(res.text)
    exit(1)
company_id = res.json()["id"]
print(f"Company ID: {company_id}")

# 2. Login as Superuser
print("\n--- 2. Login as Superuser ---")
res = requests.post(f"{BASE_URL}/auth/login", data={"username": "superuser@example.com", "password": "password123"})

if res.status_code != 200:
    print(f"Superuser login failed: {res.status_code}")
    exit(1)
su_token = res.json()["access_token"]
su_headers = {"Authorization": f"Bearer {su_token}"}
print("Superuser logged in.")

# 3. Approve Company
print("\n--- 3. Approve Company ---")
res = requests.put(f"{BASE_URL}/companies/{company_id}/approve", headers=su_headers)
print(f"Approve Status: {res.status_code}")
if res.status_code != 200:
    print(res.text)
    exit(1)

# 4. Login as Company Admin
print("\n--- 4. Login as Company Admin ---")
res = requests.post(f"{BASE_URL}/auth/login", data={"username": f"admin{unique_suffix}@company.com", "password": "Password123!"})
print(f"Admin Login Status: {res.status_code}")
if res.status_code != 200:
    print(res.text)
    exit(1)
admin_token = res.json()["access_token"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}

# 5. Get Dashboard Stats
print("\n--- 5. Get Dashboard Stats (Before Enrollment) ---")
res = requests.get(f"{BASE_URL}/company-admin/dashboard", headers=admin_headers)
print(f"Dashboard Stats Status: {res.status_code}")
print(json.dumps(res.json(), indent=2))

# 6. Bulk Enroll (within capacity)
print("\n--- 6. Bulk Enroll (Within Capacity: 3 employees, seats requested: 5) ---")
enroll_payload = {
    "employees": [
        {"email": f"emp1_{unique_suffix}@company.com", "name": "Emp 1", "mobile": "0000000001", "department": "IT", "designation": "Dev"},
        {"email": f"emp2_{unique_suffix}@company.com", "name": "Emp 2", "mobile": "0000000002", "department": "IT", "designation": "Dev"},
        {"email": f"emp3_{unique_suffix}@company.com", "name": "Emp 3", "mobile": "0000000003", "department": "IT", "designation": "Dev"}
    ]
}
res = requests.post(f"{BASE_URL}/company-admin/bulk-enroll", headers=admin_headers, json=enroll_payload)
print(f"Bulk Enroll Status: {res.status_code}")
print(res.text)

# 7. Get Dashboard Stats
print("\n--- 7. Get Dashboard Stats (After Successful Enrollment) ---")
res = requests.get(f"{BASE_URL}/company-admin/dashboard", headers=admin_headers)
print(json.dumps(res.json(), indent=2))

# 8. Bulk Enroll (Exceeding capacity)
print("\n--- 8. Bulk Enroll (Exceeding Capacity: 3 more employees, but only 2 seats remaining) ---")
enroll_payload_exceed = {
    "employees": [
        {"email": f"emp4_{unique_suffix}@company.com", "name": "Emp 4", "mobile": "0000000004", "department": "IT", "designation": "Dev"},
        {"email": f"emp5_{unique_suffix}@company.com", "name": "Emp 5", "mobile": "0000000005", "department": "IT", "designation": "Dev"},
        {"email": f"emp6_{unique_suffix}@company.com", "name": "Emp 6", "mobile": "0000000006", "department": "IT", "designation": "Dev"}
    ]
}
res = requests.post(f"{BASE_URL}/company-admin/bulk-enroll", headers=admin_headers, json=enroll_payload_exceed)
print(f"Exceed Bulk Enroll Status: {res.status_code}")
print(res.text)

# 9. Finance Audit Logs Regression Test
print("\n--- 9. Finance Audit Logs Regression Test ---")
finance_login_payload = {
    "username": "arulfinance@gmail.com",
    "password": "password123"
}
res = requests.post(f"{BASE_URL}/auth/login", data=finance_login_payload)
print(f"Finance Login Status: {res.status_code}")
if res.status_code != 200:
    print("Finance Login Failed!")
    print(res.text)
    exit(1)
finance_token = res.json()["access_token"]
finance_headers = {"Authorization": f"Bearer {finance_token}"}

# Fetch audit logs
res = requests.get(f"{BASE_URL}/finance/audit", headers=finance_headers)
print(f"Finance Audit Logs Fetch Status: {res.status_code}")
if res.status_code != 200:
    print("Failed to fetch finance audit logs!")
    print(res.text)
    exit(1)

logs = res.json()
print(f"Retrieved {len(logs)} audit logs.")

# Find log entries for INV-00041 or INV-00040
target_refs = ["INV-00041", "INV-00040"]
validated_count = 0

for log in logs:
    ref = log.get("entity_reference")
    if ref in target_refs:
        entity_name = log.get("entity_name")
        print(f"Found log with reference {ref}: entity_name='{entity_name}'")
        assert entity_name == "company1", f"Regression Bug! {ref} resolved to '{entity_name}' instead of 'company1'"
        validated_count += 1

print(f"Successfully validated {validated_count} target logs.")
assert validated_count > 0, "No target audit logs found for validation!"

print("\n--- Verification Complete ---")
