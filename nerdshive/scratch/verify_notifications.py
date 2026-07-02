import requests
import psycopg2

BASE_URL = "http://localhost:8000/api/v1"

# 1. Register a new company
payload = {
    "company_name": "Test Company Alpha",
    "gst_number": "22AAAAA0000A1Z5",
    "industry_type": "IT",
    "company_email": "alpha@example.com",
    "max_employee_capacity": 100,
    "seats_requested": 50,
    "admin_full_name": "Admin Alpha",
    "admin_email": "admin.alpha@example.com",
    "admin_mobile": "9876543210",
    "admin_password": "Password123!"
}

try:
    print("Registering company...")
    response = requests.post(f"{BASE_URL}/companies/register", json=payload)
    print("Registration response:", response.status_code)
    print(response.json())
except Exception as e:
    print("Error calling API:", e)

# 2. Check Database for Notifications
print("\n--- Verifying Notifications in Database ---")
try:
    conn = psycopg2.connect("postgresql://app_user:password123@localhost:5432/app_db")
    cur = conn.cursor()
    cur.execute("""
        SELECT n.id, n.title, n.message, n.type, u.email 
        FROM notifications n 
        JOIN auth_users u ON n.user_id = u.id 
        ORDER BY n.created_at DESC LIMIT 5
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"To: {row[4]} | Title: {row[1]} | Type: {row[3]}")
    cur.close()
    conn.close()
except Exception as e:
    print("DB connection failed:", e)
