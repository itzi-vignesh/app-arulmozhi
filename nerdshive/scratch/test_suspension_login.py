import urllib.request
import urllib.parse
import json
import urllib.error
import random
from app.db.session import SessionLocal
from app.models.company import Company, CompanyAdmin
from app.models.user import AuthUser
from app.core.security import get_password_hash

BASE_URL = 'http://localhost:8000/api/v1'

def make_request(url, method='GET', data=None, headers=None):
    if headers is None: headers = {}
    if data is not None:
        if isinstance(data, dict) and headers.get('Content-Type') != 'application/x-www-form-urlencoded':
            data = json.dumps(data).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        elif headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            data = urllib.parse.urlencode(data).encode('utf-8')
            
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body)
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return 0, str(e)

def run():
    print("Starting Corporate Suspension Login Integration Test...")
    db = SessionLocal()
    
    email = f"corp_admin_{random.randint(1000, 9999)}@example.com"
    password = "password123"
    
    company_id = None
    auth_id = None
    
    try:
        # 1. Create a company in the database with status='approved'
        company = Company(
            company_name="SuspendedTest Ltd",
            company_email="suspendedtest@example.com",
            status="approved"
        )
        db.add(company)
        db.flush()
        company_id = company.id
        
        # 2. Create an admin user for this company
        auth = AuthUser(
            email=email,
            hashed_password=get_password_hash(password),
            is_active=True
        )
        db.add(auth)
        db.flush()
        auth_id = auth.id
        
        comp_admin = CompanyAdmin(
            auth_id=auth.id,
            company_id=company.id,
            full_name="Suspended Test Admin",
            mobile="9876543211"
        )
        db.add(comp_admin)
        db.commit()
        
        print(f"Created company {company_id} and admin user {email}")
        
        # 3. Try to log in -> Should succeed
        print("Testing login with status='approved'...")
        status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
            "username": email,
            "password": password
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        
        assert status == 200, f"Login failed unexpectedly: Status={status}, Body={body}"
        token = body.get('access_token')
        refresh = body.get('refresh_token')
        print("Login successful! Token acquired.")
        
        # Verify authenticated endpoint works
        headers = {"Authorization": f"Bearer {token}"}
        s_status, s_body = make_request(f"{BASE_URL}/auth/session", 'GET', headers=headers.copy())
        assert s_status == 200, f"Session endpoint failed: {s_body}"
        print("Session request authorized.")
        
        # 4. Suspend the company
        print("\nSuspending company in database...")
        db.refresh(company)
        company.status = "suspended"
        db.commit()
        print("Company status updated to 'suspended'.")
        
        # 5. Try to log in again -> Should fail with 400 and detail="Your company is suspended."
        print("Testing login with status='suspended'...")
        status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
            "username": email,
            "password": password
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        
        print(f"Login Response: Status={status}, Body={body}")
        assert status == 400, f"Expected 400 Bad Request, got {status}"
        assert body.get('detail') == "Your company is suspended.", f"Expected suspension message, got: {body.get('detail')}"
        print("Login rejected correctly with suspension message!")
        
        # 6. Try to use previous valid token on deps-protected endpoint -> Should fail with 400
        print("Testing previously acquired token on authenticated endpoint...")
        s_status2, s_body2 = make_request(f"{BASE_URL}/auth/session", 'GET', headers=headers.copy())
        print(f"Session Response: Status={s_status2}, Body={s_body2}")
        assert s_status2 == 400, f"Expected 400 Bad Request, got {s_status2}"
        assert s_body2.get('detail') == "Your company is suspended.", f"Expected suspension message, got: {s_body2.get('detail')}"
        print("API requests with old token blocked correctly!")

        # 7. Try to refresh token -> Should fail with 401
        print("Testing token refresh with suspended status...")
        r_status, r_body = make_request(f"{BASE_URL}/auth/refresh", 'POST', {
            "refresh_token": refresh
        })
        print(f"Refresh Response: Status={r_status}, Body={r_body}")
        assert r_status == 401, f"Expected 401 Unauthorized, got {r_status}"
        assert r_body.get('detail') == "Your company is suspended.", f"Expected suspension message, got: {r_body.get('detail')}"
        print("Token refresh blocked correctly!")
        
        # 8. Activate the company again
        print("\nActivating company in database...")
        db.refresh(company)
        company.status = "approved"
        db.commit()
        print("Company status updated to 'approved'.")
        
        # 9. Try to log in -> Should succeed again
        print("Testing login with status='approved' again...")
        status, body = make_request(f"{BASE_URL}/auth/login", 'POST', {
            "username": email,
            "password": password
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        
        assert status == 200, f"Login failed after reactivation: Status={status}, Body={body}"
        print("Re-login successful! Token acquired.")
        
        print("\nAll integration checks for company suspension login blocks passed successfully!")
        
    except Exception as e:
        print(f"Test failed with exception: {e}")
        raise e
    finally:
        # Cleanup
        print("\nCleaning up database...")
        if company_id:
            c = db.query(Company).filter(Company.id == company_id).first()
            if c:
                db.delete(c)
        if auth_id:
            a = db.query(AuthUser).filter(AuthUser.id == auth_id).first()
            if a:
                db.delete(a)
        db.commit()
        db.close()

if __name__ == '__main__':
    run()
