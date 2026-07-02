import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.api import deps
from app.models.user import AuthUser
import uuid

def override_get_current_superuser():
    return AuthUser(id=uuid.uuid4(), email="test@example.com")

app.dependency_overrides[deps.get_current_superuser] = override_get_current_superuser

client = TestClient(app)
response = client.get("/api/v1/admins/")
print("Status:", response.status_code)
print("JSON:", response.json())
