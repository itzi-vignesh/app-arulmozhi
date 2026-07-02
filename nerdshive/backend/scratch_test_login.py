import traceback
from app.db.session import SessionLocal
from app.api.v1.endpoints.auth import login_access_token
from fastapi.security import OAuth2PasswordRequestForm

class MockForm:
    def __init__(self, username, password):
        self.username = username
        self.password = password

def test_login():
    db = SessionLocal()
    form = MockForm("superuser@example.com", "password123")
    try:
        print("Invoking login_access_token...")
        res = login_access_token(db=db, form_data=form)
        print("Login result:", res)
    except Exception as e:
        print("Exception raised during login:")
        traceback.print_exc()

if __name__ == "__main__":
    test_login()
