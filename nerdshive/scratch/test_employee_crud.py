import requests

BASE_URL = "http://localhost:8001/api/v1"

def run_tests():
    # 1. Login coadmin@gmail.com
    print("1. Logging in as coadmin@gmail.com...")
    login_data = {
        "username": "coadmin@gmail.com",
        "password": "password123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
    
    # Check token/cookie
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful! Token retrieved.")

    # 2. Create Employee
    print("\n2. Creating new employee...")
    emp_payload = {
        "employee_id": "EMPTEST999",
        "full_name": "Test Employee",
        "gender": "Male",
        "date_of_birth": "1995-05-15",
        "mobile": "9876543299",
        "email": "testemp999@example.com",
        "emergency_contact_name": None,
        "emergency_contact_number": None,
        "department": "Engineering",
        "designation": "Software Developer",
        "company": "ABC Technologies",
        "joining_date": "2025-01-01",
        "duration": "permanent",
        "govt_id_type": "PAN",
        "govt_id_number": "ABCDE1234F",
        "requires_parking": True,
        "vehicle_type": "car",
        "vehicle_brand_model": "Honda City",
        "vehicle_color": "White",
        "vehicle_registration": "TN01AB1234"
    }
    
    response = requests.post(f"{BASE_URL}/company-admin/employees", json=emp_payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Create employee failed: {response.text}")
        return
    
    emp_data = response.json()
    emp_id = emp_data["id"]
    print(f"Employee created successfully! ID: {emp_id}, Customer ID: {emp_data.get('customer_id')}")
    
    # 3. List Employees
    print("\n3. Listing employees...")
    response = requests.get(f"{BASE_URL}/company-admin/employees", headers=headers)
    if response.status_code != 200:
        print(f"List employees failed: {response.text}")
        return
    employees = response.json()
    found = any(e["id"] == emp_id for e in employees)
    print(f"Total employees: {len(employees)}. Found created employee: {found}")

    # 4. Get Employee by ID
    print(f"\n4. Fetching employee details for {emp_id}...")
    response = requests.get(f"{BASE_URL}/company-admin/employees/{emp_id}", headers=headers)
    if response.status_code != 200:
        print(f"Get employee by ID failed: {response.text}")
        return
    print(f"Details: Name={response.json().get('full_name')}, Dept={response.json().get('department')}")

    # 5. Update Employee (PUT)
    print("\n5. Updating employee name...")
    update_payload = {
        "full_name": "Updated Test Employee",
        "email": "testemp999@example.com"
    }
    response = requests.put(f"{BASE_URL}/company-admin/employees/{emp_id}", json=update_payload, headers=headers)
    if response.status_code != 200:
        print(f"Update failed: {response.text}")
        return
    print(f"Employee updated! New Name: {response.json().get('full_name')}")

    # 6. Delete Employee
    print("\n6. Deleting employee...")
    response = requests.delete(f"{BASE_URL}/company-admin/employees/{emp_id}", headers=headers)
    if response.status_code != 200:
        print(f"Delete failed: {response.text}")
        return
    print("Employee deleted successfully!")

    # 7. Verify deletion
    print("\n7. Verifying deletion...")
    response = requests.get(f"{BASE_URL}/company-admin/employees/{emp_id}", headers=headers)
    print(f"Fetch deleted employee status code: {response.status_code} (Expected: 404)")

if __name__ == "__main__":
    run_tests()
