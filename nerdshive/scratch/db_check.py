import requests
import json
import uuid

BASE_URL = "http://localhost:8001/api/v1"

def test_registration_flow():
    print("Testing file upload...")
    # 1. Upload file
    files = {'file': ('test_doc.txt', b'test content', 'text/plain')}
    upload_res = requests.post(f"{BASE_URL}/storage/company-documents/test_doc.txt", files=files)
    if upload_res.status_code != 200:
        print(f"Failed to upload file: {upload_res.status_code} {upload_res.text}")
        return False
    
    doc_path = upload_res.json()['path']
    print(f"File uploaded to {doc_path}")

    # 2. Register company
    print("Registering company...")
    test_uuid = str(uuid.uuid4())[:8]
    payload = {
        "company_name": f"Test Corp {test_uuid}",
        "registration_number": f"REG{test_uuid}",
        "gst_number": f"GST{test_uuid}",
        "company_email": f"test{test_uuid}@example.com",
        "company_phone": "1234567890",
        "company_registration_doc_url": doc_path,
        "admin_full_name": "Admin Tester",
        "admin_email": f"admin{test_uuid}@example.com",
        "admin_mobile": "0987654321",
        "admin_password": "securepassword123",
        "max_employee_capacity": 100,
        "seats_purchased": 10
    }
    
    headers = {'Content-Type': 'application/json'}
    reg_res = requests.post(f"{BASE_URL}/companies/register", json=payload, headers=headers)
    
    if reg_res.status_code != 200:
        print(f"Failed to register company: {reg_res.status_code} {reg_res.text}")
        return False
        
    company_data = reg_res.json()
    print(f"Company registered successfully: {company_data['id']} - {company_data['company_name']}")
    return True

if __name__ == "__main__":
    test_registration_flow()
