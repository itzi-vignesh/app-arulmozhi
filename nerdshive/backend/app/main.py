# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from typing import AsyncGenerator
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup logic: Run migrations
    try:
        import alembic.config
        import alembic.command
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic.command.upgrade(alembic_cfg, "head")
        print("Database migrations applied successfully via Alembic.")
    except Exception as e:
        print(f"Alembic migrations failed: {e}")

    try:
        from app.services.notification import start_reminder_scheduler
        start_reminder_scheduler()
        print("Daily overdue payment reminder background scheduler started.")
    except Exception as e:
        print(f"Failed to start reminder scheduler: {e}")

    from app.db.session import engine
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'ACTIVE' NOT NULL;"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS allow_future_seat_requests BOOLEAN DEFAULT FALSE NOT NULL;"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS seat_allocation_permission_requested BOOLEAN DEFAULT FALSE NOT NULL;"))
            
            try:
                conn.execute(text("ALTER TABLE checkins ADD COLUMN IF NOT EXISTS punch_log JSONB;"))
                conn.execute(text("ALTER TABLE checkins ADD COLUMN IF NOT EXISTS credits JSONB;"))
            except Exception as sql_e:
                print(f"Failed to add punch_log/credits columns: {sql_e}")
            
            # Create sequence for customer_id if it doesn't exist
            conn.execute(text("CREATE SEQUENCE IF NOT EXISTS customer_id_seq START WITH 1;"))
            
            # Create invoices table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS invoices (
                    id UUID PRIMARY KEY,
                    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    plan_name VARCHAR NOT NULL,
                    billing_type VARCHAR NOT NULL,
                    price_per_seat NUMERIC NOT NULL,
                    seats INTEGER NOT NULL,
                    subtotal NUMERIC NOT NULL,
                    gst_rate NUMERIC NOT NULL DEFAULT 18,
                    gst_amount NUMERIC NOT NULL,
                    total_amount NUMERIC NOT NULL,
                    invoice_date DATE NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'unpaid',
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
                );
            """))
            
            # Create finance table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS finance (
                    id UUID PRIMARY KEY,
                    auth_id UUID NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
                    full_name VARCHAR,
                    mobile VARCHAR,
                    city VARCHAR,
                    location VARCHAR,
                    occupation VARCHAR,
                    status VARCHAR DEFAULT 'active',
                    permissions JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # Create refunds table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS refunds (
                    id UUID PRIMARY KEY,
                    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    amount NUMERIC NOT NULL,
                    reason VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'pending',
                    approved_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # Create seat_requests table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS seat_requests (
                    id UUID PRIMARY KEY,
                    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
                    current_seats INTEGER NOT NULL,
                    requested_seats INTEGER NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'PENDING',
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    verified_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                    verified_at TIMESTAMP WITHOUT TIME ZONE,
                    payment_method VARCHAR,
                    transaction_reference VARCHAR,
                    verification_notes VARCHAR,
                    approved_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                    approved_at TIMESTAMP WITHOUT TIME ZONE,
                    remarks VARCHAR
                );
            """))
            conn.execute(text("ALTER TABLE invoices ALTER COLUMN company_id DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;"))
            
            # Clean up seeded placeholder checkins and users matching PIN_ prefix
            try:
                conn.execute(text("DELETE FROM checkins WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE 'PIN_%');"))
                conn.execute(text("DELETE FROM users WHERE employee_id LIKE 'PIN_%';"))
            except Exception as clean_e:
                print(f"Failed to clean up placeholder data: {clean_e}")
                
            conn.commit()
        print("Database migration check completed successfully.")

    except Exception as e:
        print(f"Database migration check failed: {e}")
    yield
    # Teardown / shutdown logic (none needed)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://localhost:6001",
        "http://localhost:6000",
        "http://localhost:9000",
        "http://localhost:9009",
        "http://localhost:9010",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:9000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "API is running"}

@app.get("/api/ext/v1/daily-log")
def mock_biometric_log(date: str):
    return {
        "date": date,
        "organisation": "nhtest",
        "generated_at": f"{date}T17:13:04",
        "total": 5,
        "records": [
            {
                "pin": "A52026001",
                "name": "Vignesh C",
                "department": "A5",
                "designation": "Associate Consultant Trainee",
                "status": "present",
                "first_in": "10:28",
                "last_out": None,
                "total_hours": 4.33,
                "punch_log": [
                    {"time": "10:28:13", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "13:11:12", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "15:34:23", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "16:39:55", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "16:42:02", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False}
                ],
                "credits": []
            },
            {
                "pin": "A52026002",
                "name": "Halish Richard J",
                "department": "A5",
                "designation": "Intrapreneur",
                "status": "absent",
                "first_in": None,
                "last_out": None,
                "total_hours": None,
                "punch_log": [],
                "credits": []
            },
            {
                "pin": "A5INT_26002",
                "name": "Yogeshwari C",
                "department": "A5INT",
                "designation": "",
                "status": "present",
                "first_in": "10:29",
                "last_out": None,
                "total_hours": 5.18,
                "punch_log": [
                    {"time": "10:29:59", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "13:12:10", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "14:44:10", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False}
                ],
                "credits": []
            },
            {
                "pin": "A5INT_26010",
                "name": "Hareeni Pavendan",
                "department": "A5INT",
                "designation": "Intern",
                "status": "present",
                "first_in": "09:51",
                "last_out": None,
                "total_hours": 6.29,
                "punch_log": [
                    {"time": "09:51:46", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "13:09:09", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "14:09:57", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "16:30:05", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "16:33:29", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False}
                ],
                "credits": []
            },
            {
                "pin": "A5INT_26011",
                "name": "Arulmozhi S",
                "department": "A5INT",
                "designation": "Intern",
                "status": "present",
                "first_in": "09:57",
                "last_out": None,
                "total_hours": 6.93,
                "punch_log": [
                    {"time": "09:57:18", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "13:11:24", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "13:44:11", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "16:13:30", "type": "check_out", "verify": "Fingerprint", "missed_checkout": False},
                    {"time": "16:15:26", "type": "check_in", "verify": "Fingerprint", "missed_checkout": False}
                ],
                "credits": [
                    {"type": "permission", "label": "Permission (15m)", "minutes": 15}
                ]
            }
        ]
    }

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        loc = error.get("loc", [])
        field = str(loc[-1]) if loc else "body"
        msg = error.get("msg", "Validation error")
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        errors.append({
            "field": field,
            "message": msg
        })
    return JSONResponse(
        status_code=422,
        content={"errors": errors}
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    if exc.status_code == 400:
        detail = exc.detail
        if isinstance(detail, list):
            return JSONResponse(status_code=400, content={"errors": detail})
        elif isinstance(detail, dict) and "errors" in detail:
            return JSONResponse(status_code=400, content=detail)
        else:
            field = "non_field_errors"
            detail_lower = str(detail).lower()
            if "email" in detail_lower:
                field = "email"
            elif "password" in detail_lower:
                field = "password"
            elif "mobile" in detail_lower or "phone" in detail_lower:
                field = "mobile"
            elif "gst" in detail_lower:
                field = "gst_number"
            elif "pincode" in detail_lower or "pin code" in detail_lower:
                field = "pincode"
            elif "name" in detail_lower:
                if "company" in detail_lower:
                    field = "company_name"
                elif "admin" in detail_lower:
                    field = "admin_full_name"
                else:
                    field = "full_name"
            elif "aadhaar" in detail_lower:
                field = "govt_id_number"
            elif "pan" in detail_lower:
                field = "govt_id_number"
            elif "reason" in detail_lower:
                field = "reason"
            elif "participants" in detail_lower:
                field = "participants"
            elif "website" in detail_lower:
                field = "company_website"
            
            return JSONResponse(
                status_code=400,
                content={
                    "errors": [
                        {
                            "field": field,
                            "message": str(detail)
                        }
                    ]
                }
            )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

from app.api.v1.api import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)
