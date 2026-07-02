from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, admins, checkins, dashboard, audit, notifications, business, storage, companies, company_admin, pricing, meetings, invoices, finance, attendance

api_router = APIRouter()

@api_router.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(admins.router, prefix="/admins", tags=["admins"])
api_router.include_router(checkins.router, prefix="/checkins", tags=["checkins"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(audit.router, tags=["audit"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(business.router, tags=["business"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(company_admin.router, prefix="/company-admin", tags=["company_admin"])
api_router.include_router(pricing.router, tags=["pricing"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])


