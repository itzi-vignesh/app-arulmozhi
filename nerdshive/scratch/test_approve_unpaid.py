import requests

BASE_URL = "http://localhost:8001/api/v1"

def test_approve_unpaid():
    # 1. Login coadmin
    print("1. Logging in as coadmin...")
    login_coadmin = requests.post(f"{BASE_URL}/auth/login", data={"username": "coadmin@gmail.com", "password": "password123"})
    if login_coadmin.status_code != 200:
        print(f"Coadmin login failed: {login_coadmin.text}")
        return
    coadmin_headers = {"Authorization": f"Bearer {login_coadmin.json()['access_token']}"}

    # 2. Get current capacity
    comp_info = requests.get(f"{BASE_URL}/company-admin/my-company", headers=coadmin_headers).json()
    print("comp_info response:", comp_info)
    curr_capacity = comp_info.get("max_employee_capacity", 0)
    company_id = comp_info["id"]
    print(f"Current capacity for company {company_id} is: {curr_capacity}")

    # 3. Request seat increase (e.g. capacity + 2)
    target_capacity = curr_capacity + 2
    print(f"\n2. Requesting seat increase to {target_capacity}...")
    payload = {
        "company_name": comp_info["company_name"],
        "company_email": comp_info["company_email"],
        "admin_full_name": comp_info["admin_full_name"],
        "admin_mobile": comp_info["admin_mobile"],
        "seats_requested": target_capacity
    }
    req_res = requests.put(f"{BASE_URL}/company-admin/my-company", json=payload, headers=coadmin_headers)
    print(f"Status Code: {req_res.status_code}")
    if req_res.status_code != 200:
        print(f"Request failed: {req_res.text}")
        return
    print("Seat request successfully submitted.")

    # 4. Login superuser to approve
    print("\n3. Logging in as superuser...")
    login_su = requests.post(f"{BASE_URL}/auth/login", data={"username": "superuser@example.com", "password": "password123"})
    if login_su.status_code != 200:
        print(f"Superuser login failed: {login_su.text}")
        return
    su_headers = {"Authorization": f"Bearer {login_su.json()['access_token']}"}

    # 5. Approve seat request without payment check
    print(f"\n4. Approving seat request for company {company_id} as superuser...")
    app_res = requests.put(f"{BASE_URL}/companies/{company_id}/approve-seats", headers=su_headers)
    print(f"Status Code: {app_res.status_code}")
    print(f"Response: {app_res.text}")
    if app_res.status_code != 200:
        print("Seat approval failed!")
        return
    
    # 6. Verify capacity updated
    comp_info_updated = requests.get(f"{BASE_URL}/company-admin/my-company", headers=coadmin_headers).json()
    new_capacity = comp_info_updated.get("max_employee_capacity", 0)
    print(f"\n5. Verified new capacity is: {new_capacity} (Expected: {target_capacity})")
    
if __name__ == "__main__":
    test_approve_unpaid()
