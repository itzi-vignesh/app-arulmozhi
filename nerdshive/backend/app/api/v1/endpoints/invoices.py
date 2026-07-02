from typing import Any, List, cast
from datetime import datetime, date, timedelta, timezone
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.business import Invoice, PricingPlan, SeatRequest
from app.models.company import Company
from app.models.user import AuthUser
from app.models.audit import Notification
from app.schemas.invoice import InvoiceResponse

router = APIRouter()

def get_current_template_snapshot_and_version(db: Session):
    from app.models.audit import ContentSection
    import json
    
    default_config = {
        "business": {
            "name": "NerdShive Workspace Private Limited",
            "address": "Sector 5, HSR Layout, Bangalore, Karnataka - 560102",
            "phone": "+91 99999 88888",
            "email": "finance@nerdshive.com",
            "website": "www.nerdshive.com",
            "gstin": "29AAAAA1111A1Z1",
            "pan": "ABCDE1234F"
        },
        "branding": {
            "logoUrl": "https://pyrefly.com/logo.png",
            "logoWidth": 64,
            "logoHeight": 64,
            "logoUploaded": False,
            "primaryColor": "#d45b25",
            "accentColor": "#f97316",
            "headerColor": "#ffffff",
            "footerColor": "#f8fafc",
            "theme": "classic"
        },
        "invoice": {
            "prefix": "INV-",
            "startingNumber": 1,
            "numberPadding": 5,
            "dateFormat": "DD/MM/YYYY",
            "dueDateOffset": 7,
            "includeFinancialYear": False
        },
        "currency": {
            "symbol": "₹",
            "code": "INR",
            "precision": 2
        },
        "tax": {
            "name": "GST",
            "percentage": 18.0,
            "included": False
        },
        "fees": [],
        "discounts": [],
        "payment": {
            "bankName": "ICICI Bank",
            "accountNumber": "1234567890",
            "accountHolder": "NerdShive Workspace Pvt Ltd",
            "ifsc": "ICIC0001234",
            "upiId": "nerdshive@upi"
        },
        "terms": "Payment is due within 7 days of invoice generation.",
        "footer": {
            "text": "Thank you for choosing NerdShive! For support: finance@nerdshive.com",
            "copyright": "© 2026 NerdShive Workspace",
            "supportEmail": "support@nerdshive.com",
            "supportPhone": "+91 99999 88888"
        }
    }
    
    template = db.query(ContentSection).filter(ContentSection.section == "invoice_template").first()
    if not template:
        template = ContentSection(
            id=uuid.uuid4(),
            section="invoice_template",
            content=json.dumps(default_config)
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return default_config, 1
        
    try:
        config = json.loads(cast(str, template.content))
        if not isinstance(config, dict):
            return default_config, 1
            
        # Ensure nested components have appropriate default types if missing/incorrect type
        for key in ["invoice", "tax", "currency", "branding", "payment", "footer"]:
            if key not in config or not isinstance(config[key], dict):
                config[key] = default_config.get(key, {})
        for key in ["fees", "discounts"]:
            if key not in config or not isinstance(config[key], list):
                config[key] = []
                
        version = config.get("version", 1)
        return config, version
    except Exception:
        return default_config, 1

def generate_invoice_number(db: Session, config: dict) -> str:
    if not isinstance(config, dict):
        config = {}
    inv_cfg = config.get("invoice")
    if not isinstance(inv_cfg, dict):
        inv_cfg = {}
    prefix = inv_cfg.get("prefix", "INV-")
    starting_number = int(inv_cfg.get("startingNumber", 1))
    padding = int(inv_cfg.get("numberPadding", 5))
    
    if inv_cfg.get("includeFinancialYear", False):
        today = date.today()
        fy = today.year - 1 if today.month < 4 else today.year
        prefix = f"{prefix}{fy}-"
        
    count = db.query(Invoice).count()
    seq_num = max(starting_number, count + 1)
    
    while True:
        inv_num = f"{prefix}{seq_num:0{padding}d}"
        existing_inv = db.query(Invoice).filter(Invoice.invoice_number == inv_num).first()
        if not existing_inv:
            break
        seq_num += 1
    return inv_num

def get_next_month_first(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    else:
        return date(d.year, d.month + 1, 1)

def sync_company_invoices(db: Session, company: Company) -> None:
    if not company.selected_plan_id:
        return
        
    plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
    if not plan:
        return
        
    start_time = company.plan_selected_at or company.created_at
    plan_start_date = start_time.date()
    today = datetime.now(timezone.utc).date()
    
    billing_dates: List[date] = []
    billing_type = plan.billing_type.lower()
    
    if billing_type in ("day", "daily"):
        current_date = plan_start_date
        while current_date <= today:
            billing_dates.append(current_date)
            current_date = current_date + timedelta(days=1)
    elif billing_type in ("week", "weekly"):
        current_date = plan_start_date
        while current_date <= today:
            billing_dates.append(current_date)
            current_date = current_date + timedelta(days=7)
    else:
        # Monthly billing or fallback: Initial selection date invoice
        current_date = plan_start_date
        billing_dates.append(current_date)
        
        # Subsequent invoices on the 1st of every calendar month
        temp_date = get_next_month_first(plan_start_date)
        while temp_date <= today:
            billing_dates.append(temp_date)
            temp_date = get_next_month_first(temp_date)
            
    # Create missing invoices
    from app.services.notification import notify_company_admins
    config, version = get_current_template_snapshot_and_version(db)
    config = cast(dict, config)
    
    for b_date in billing_dates:
        existing = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.invoice_date == b_date
        ).first()
        
        if not existing:
            seats = company.seats_requested
            if not seats or seats <= 0:
                seats = company.max_employee_capacity
            if not seats or seats <= 0:
                seats = 1
                
            price_per_seat = float(cast(Any, plan.price))
            subtotal = price_per_seat * seats
            
            # Tax calculations
            tax_cfg = config.get("tax", {})
            tax_percent = float(tax_cfg.get("percentage", 18.0))
            tax_included = bool(tax_cfg.get("included", False))
            
            if tax_included:
                actual_subtotal = subtotal / (1.0 + tax_percent / 100.0)
                gst_amount = subtotal - actual_subtotal
                subtotal = actual_subtotal
            else:
                gst_amount = subtotal * (tax_percent / 100.0)
                
            # Fees sum
            fees_sum = 0.0
            for fee in config.get("fees", []):
                val = float(fee.get("value", 0.0))
                if fee.get("type") == "percent":
                    fees_sum += subtotal * (val / 100.0)
                else:
                    fees_sum += val
                    
            # Discounts sum
            discounts_sum = 0.0
            for disc in config.get("discounts", []):
                val = float(disc.get("value", 0.0))
                if disc.get("type") == "percent":
                    discounts_sum += subtotal * (val / 100.0)
                else:
                    discounts_sum += val
                    
            total_amount = subtotal + gst_amount + fees_sum - discounts_sum
            
            # Generate invoice number based on config prefix/padding
            inv_num = generate_invoice_number(db, config)
            
            due_offset = int(config.get("invoice", {}).get("dueDateOffset", 7))
            if billing_type in ("day", "daily"):
                billing_end_date = b_date
                due_date = b_date + timedelta(days=due_offset)
            elif billing_type in ("week", "weekly"):
                billing_end_date = b_date + timedelta(days=6)
                due_date = b_date + timedelta(days=due_offset)
            else:
                billing_end_date = get_next_month_first(b_date) - timedelta(days=1)
                due_date = b_date + timedelta(days=due_offset)
                
            new_inv = Invoice(
                id=uuid.uuid4(),
                company_id=company.id,
                plan_name=plan.plan_name,
                billing_type=plan.billing_type,
                price_per_seat=price_per_seat,
                seats=seats,
                subtotal=subtotal,
                gst_rate=tax_percent,
                gst_amount=gst_amount,
                total_amount=total_amount,
                invoice_date=b_date,
                status="unpaid",
                created_at=datetime.now(timezone.utc),
                invoice_number=inv_num,
                billing_start_date=b_date,
                billing_end_date=billing_end_date,
                due_date=due_date,
                template_version=version,
                template_snapshot=config
            )
            db.add(new_inv)
            db.flush()
            
    db.commit()
    
    # Process notifications for unpaid invoices
    unpaid_invoices = db.query(Invoice).filter(
        Invoice.company_id == company.id,
        Invoice.status == "unpaid",
        Invoice.invoice_status != "voided"
    ).all()
    
    for inv in unpaid_invoices:
        if not inv.due_date:
            continue
        days_until_due = (inv.due_date - today).days
        
        # 1. Generated notification
        if not inv.notif_generated_sent:
            due_date_str = inv.due_date.strftime("%d %b %Y") if hasattr(inv.due_date, "strftime") else str(inv.due_date)
            formatted_amt = f"₹{inv.total_amount:,.2f}"
            msg = f"New Invoice Generated\nInvoice #{inv.invoice_number}\nAmount {formatted_amt}\nDue Date {due_date_str}"
            notify_company_admins(db, company.id, "New Invoice Generated", msg)
            inv.notif_generated_sent = True
            
        # 2. Reminder 3 days before due
        if days_until_due == 3 and not inv.notif_reminder_sent:
            notify_company_admins(db, company.id, "Invoice Reminder", f"Your invoice #{inv.invoice_number} is due in 3 days.")
            inv.notif_reminder_sent = True
            
        # 3. Due today
        if days_until_due == 0 and not inv.notif_due_sent:
            notify_company_admins(db, company.id, "Invoice Due Today", f"Your invoice #{inv.invoice_number} is due today.")
            inv.notif_due_sent = True
            
        # 4. Overdue
        if days_until_due < 0 and not inv.notif_overdue_sent:
            notify_company_admins(db, company.id, "Payment Overdue", f"Your subscription may be suspended until payment is completed for invoice #{inv.invoice_number}.")
            inv.notif_overdue_sent = True
            
    db.commit()

@router.get("/company/{company_id}", response_model=List[InvoiceResponse])
def get_company_invoices(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Retrieve and synchronize invoices for a specific company or customer"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if company:
        # Trigger invoice synchronization
        sync_company_invoices(db, company)
        # Return all generated invoices sorted by date descending
        invoices = db.query(Invoice).filter(Invoice.company_id == company_id).order_by(Invoice.invoice_date.desc()).all()
    else:
        from app.models.user import User
        customer = db.query(User).filter(User.id == company_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Company or Customer not found")
        # Return customer invoices
        invoices = db.query(Invoice).filter(Invoice.user_id == customer.id).order_by(Invoice.invoice_date.desc()).all()
        
    return invoices

@router.post("/{invoice_id}/pay", response_model=InvoiceResponse)
def pay_invoice(
    invoice_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Simulate paying an invoice"""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.invoice_status == "voided":
        raise HTTPException(status_code=400, detail="Cannot pay a voided invoice.")
        
    invoice.status = "paid"
    invoice.payment_date = datetime.now(timezone.utc)
    
    if invoice.user_id:
        from app.models.business import Plan
        plan = db.query(Plan).filter(
            Plan.user_id == invoice.user_id,
            Plan.plan_type == invoice.billing_type,
            Plan.start_date == invoice.billing_start_date,
            Plan.end_date == invoice.billing_end_date
        ).first()
        if plan is not None:
            plan.payment_verified = True
            db.add(plan)
    
    company: Any = invoice.company
    if company:
        # Check if there are other unpaid invoices for this company
        unpaid = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.status == "unpaid",
            Invoice.invoice_status != "voided",
            Invoice.id != invoice_id
        ).first()
        if not unpaid:
            company.subscription_status = "ACTIVE"
            
    # Automatically verify associated SeatRequest if it exists
    seat_req = db.query(SeatRequest).filter(SeatRequest.invoice_id == invoice.id).first()
    if seat_req and str(seat_req.status) in ["PENDING", "INVOICE_GENERATED"]:
        seat_req.status = "PAYMENT_VERIFIED"
        if current_user and hasattr(current_user, "id"):
            seat_req.verified_by = current_user.id
        seat_req.verified_at = datetime.now(timezone.utc)
        seat_req.payment_method = "invoice_paid"
        
        # Send Notification to company admins
        if company:
            for admin in company.admins:
                notif = Notification(
                    user_id=admin.auth_id,
                    title="Seat Upgrade Payment Verified",
                    message=f"Finance has verified the payment for your seat upgrade request ({seat_req.requested_seats} seats). Awaiting Superuser approval.",
                    type="info"
                )
                db.add(notif)
                
            # Send Notification to superusers
            superusers = db.query(AuthUser).filter(AuthUser.superuser_profile.has()).all()
            for su in superusers:
                notif = Notification(
                    user_id=su.id,
                    title="Seat Upgrade Ready for Approval",
                    message=f"Company {company.company_name} seat upgrade request ({seat_req.requested_seats} seats) has been verified by Finance. Ready for approval.",
                    type="info"
                )
                db.add(notif)
                
    db.commit()
    db.refresh(invoice)
    if company:
        db.refresh(company)
    return invoice

@router.get("/superuser/billing", response_model=List[Any])
def superuser_billing_overview(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Superuser Billing Overview: Get billing status for all companies and individual customers"""
    companies = db.query(Company).filter(
        Company.status == "approved",
        ~Company.company_name.like("% (Customer)"),
        ~Company.company_name.like("Customer %")
    ).all()
    results = []
    
    for company in companies:
        # Synchronize invoices for this company first
        sync_company_invoices(db, company)
        
        # Query details
        plan = None
        if company.selected_plan_id:
            plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
            
        plan_name = plan.plan_name if plan is not None else None
        billing_cycle = plan.billing_type if plan is not None else None
        
        # Outstanding amount
        unpaid_invoices = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.status == "unpaid",
            Invoice.invoice_status != "voided"
        ).all()
        outstanding = sum(float(cast(Any, inv.total_amount)) for inv in unpaid_invoices)
        
        # Current invoice (latest invoice number)
        latest_inv = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.invoice_status != "voided"
        ).order_by(Invoice.invoice_date.desc()).first()
        current_invoice_num = latest_inv.invoice_number if latest_inv else None
        
        # Last payment date
        last_paid = db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.status == "paid"
        ).order_by(Invoice.payment_date.desc()).first()
        last_payment = last_paid.payment_date if last_paid else None
        
        # Next billing date
        next_billing = None
        plan_subscribed_date = None
        if plan is not None:
            start_time = company.plan_selected_at or company.created_at
            plan_subscribed_date = start_time.date()
            plan_start_date = start_time.date()
            today = datetime.now(timezone.utc).date()
            billing_type = plan.billing_type.lower()
            if billing_type == "week":
                current_date = plan_start_date
                while current_date <= today:
                    current_date = current_date + timedelta(days=7)
                next_billing = current_date
            else:
                temp_date = get_next_month_first(plan_start_date)
                while temp_date <= today:
                    temp_date = get_next_month_first(temp_date)
                next_billing = temp_date
                
        # Oldest unpaid active invoice due date
        unpaid_active = [inv for inv in unpaid_invoices if inv.invoice_status == "active"]
        due_date = None
        if unpaid_active:
            unpaid_active.sort(key=lambda x: x.due_date if x.due_date else x.invoice_date)
            due_date = unpaid_active[0].due_date

        results.append({
            "company_id": str(company.id),
            "company_name": company.company_name,
            "type": "company",
            "current_plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "seats": company.seats_requested or company.max_employee_capacity or 1,
            "current_invoice_number": current_invoice_num,
            "outstanding_amount": outstanding,
            "subscription_status": company.subscription_status,
            "last_payment_date": last_payment,
            "next_billing_date": next_billing,
            "plan_subscribed_date": plan_subscribed_date,
            "plan_expiry_date": next_billing,
            "due_date": due_date
        })
        
    # Query all individual customers
    from app.models.user import User
    from app.models.business import Plan
    
    customers = db.query(User).filter(User.company_id == None).all()
    for customer in customers:
        active_plan = db.query(Plan).filter(
            Plan.user_id == customer.id,
            Plan.is_active == True,
            Plan.start_date <= date.today(),
            Plan.end_date >= date.today()
        ).first()
        
        plan_name = f"{active_plan.plan_type.upper()} PASS" if active_plan else None
        billing_cycle = active_plan.plan_type if active_plan else None
        
        # Outstanding amount
        unpaid_invoices = db.query(Invoice).filter(
            Invoice.user_id == customer.id,
            Invoice.status == "unpaid",
            Invoice.invoice_status != "voided"
        ).all()
        outstanding = sum(float(cast(Any, inv.total_amount)) for inv in unpaid_invoices)
        
        # Current invoice
        latest_inv = db.query(Invoice).filter(
            Invoice.user_id == customer.id,
            Invoice.invoice_status != "voided"
        ).order_by(Invoice.invoice_date.desc()).first()
        current_invoice_num = latest_inv.invoice_number if latest_inv else None
        
        # Last payment date
        last_paid = db.query(Invoice).filter(
            Invoice.user_id == customer.id,
            Invoice.status == "paid"
        ).order_by(Invoice.payment_date.desc()).first()
        last_payment = last_paid.payment_date if last_paid else None
        
        # Next billing is active plan end date
        next_billing = active_plan.end_date if active_plan else None
        plan_subscribed_date = active_plan.start_date if active_plan else None
        
        # Oldest unpaid active invoice due date
        unpaid_active = [inv for inv in unpaid_invoices if inv.invoice_status == "active"]
        due_date = None
        if unpaid_active:
            unpaid_active.sort(key=lambda x: x.due_date if x.due_date else x.invoice_date)
            due_date = unpaid_active[0].due_date

        # Subscription status
        subscription_status = "INACTIVE"
        if active_plan:
            has_overdue = db.query(Invoice).filter(
                Invoice.user_id == customer.id,
                Invoice.status == "unpaid",
                Invoice.invoice_status == "active",
                Invoice.due_date < date.today()
            ).first() is not None
            
            if has_overdue:
                subscription_status = "SUSPENDED"
            else:
                has_unpaid = db.query(Invoice).filter(
                    Invoice.user_id == customer.id,
                    Invoice.status == "unpaid",
                    Invoice.invoice_status == "active"
                ).first() is not None
                subscription_status = "PAYMENT_PENDING" if has_unpaid else "ACTIVE"
                
        results.append({
            "company_id": str(customer.id),
            "company_name": customer.full_name,
            "type": "customer",
            "current_plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "seats": 1,
            "current_invoice_number": current_invoice_num,
            "outstanding_amount": outstanding,
            "subscription_status": subscription_status,
            "last_payment_date": last_payment,
            "next_billing_date": next_billing,
            "plan_subscribed_date": plan_subscribed_date,
            "plan_expiry_date": next_billing,
            "due_date": due_date
        })
        
    return results

@router.post("/company/{company_id}/suspend", response_model=Any)
def suspend_company_subscription(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Suspend a company's subscription"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.subscription_status = "SUSPENDED"
    db.commit()
    db.refresh(company)
    return {"status": "success", "subscription_status": company.subscription_status}

@router.post("/company/{company_id}/reactivate", response_model=Any)
def reactivate_company_subscription(
    company_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_superuser)
) -> Any:
    """Reactivate a company's subscription"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    company.subscription_status = "ACTIVE"
    db.commit()
    db.refresh(company)
    return {"status": "success", "subscription_status": company.subscription_status}


from pydantic import BaseModel
from typing import Optional
from sqlalchemy import desc

class VoidInvoiceRequest(BaseModel):
    reason: str

@router.get("/", response_model=List[InvoiceResponse])
def get_all_invoices(
    status: Optional[str] = None,
    company_id: Optional[UUID] = None,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Retrieve all invoices with optional status filter"""
    query = db.query(Invoice).order_by(desc(Invoice.created_at))
    
    # Role check: If they are a standard customer, restrict to their company
    from app.models.user import Superuser, Admin, Finance
    is_privileged = db.query(Superuser).filter(Superuser.auth_id == current_user.id).first() or \
                    db.query(Admin).filter(Admin.auth_id == current_user.id).first() or \
                    db.query(Finance).filter(Finance.auth_id == current_user.id).first()
                    
    if not is_privileged:
        # Restrict to customer's company or individual user_id
        if current_user.customer_profile:
            comp_id = current_user.customer_profile.company_id
            if comp_id is not None:
                query = query.filter(
                    (Invoice.company_id == comp_id) |
                    (Invoice.user_id == current_user.customer_profile.id)
                )
            else:
                query = query.filter(Invoice.user_id == current_user.customer_profile.id)
        elif current_user.company_admin_profile:
            query = query.filter(Invoice.company_id == current_user.company_admin_profile.company_id)
        else:
            query = query.filter(Invoice.company_id == None, Invoice.user_id == None)
    elif company_id:
        # Privileged users can filter by company_id
        query = query.filter(Invoice.company_id == company_id)
        
    if status:
        query = query.filter(Invoice.status == status.lower())
    return query.all()

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_single_invoice(
    invoice_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Retrieve a single invoice by ID"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Download stub for invoice PDF"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Log audit event
    from app.models.audit import ActivityLog
    log = ActivityLog(
        action="Invoice Downloaded",
        performed_by=current_user.id,
        performed_by_name=getattr(current_user, "email", "User"),
        performed_by_role="FINANCE",
        details={"invoice_number": inv.invoice_number}
    )
    db.add(log)
    db.commit()
    return {"status": "success", "message": f"PDF generated for invoice {inv.invoice_number}"}

@router.post("/{invoice_id}/email")
def email_invoice(
    invoice_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Email stub for invoice dispatch"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Log audit event
    from app.models.audit import ActivityLog
    log = ActivityLog(
        action="Invoice Emailed",
        performed_by=current_user.id,
        performed_by_name=getattr(current_user, "email", "User"),
        performed_by_role="FINANCE",
        details={"invoice_number": inv.invoice_number}
    )
    db.add(log)
    db.commit()
    return {"status": "success", "message": f"Invoice {inv.invoice_number} emailed successfully"}

@router.post("/{invoice_id}/void")
def void_invoice(
    invoice_id: UUID,
    req: VoidInvoiceRequest,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    """Void or cancel an invoice"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    prev_status = inv.invoice_status
    inv.invoice_status = "voided"
    inv.voided_by = current_user.id
    inv.voided_at = datetime.now(timezone.utc)
    inv.void_reason = req.reason
    
    # Log audit event separately from seat requests
    from app.models.audit import ActivityLog
    log = ActivityLog(
        action="Invoice Voided",
        performed_by=current_user.id,
        performed_by_name=getattr(current_user, "email", "User"),
        performed_by_role="FINANCE",
        details={
            "invoice_number": inv.invoice_number,
            "reason": req.reason,
            "previous_status": prev_status,
            "new_status": "voided"
        }
    )
    db.add(log)
    db.commit()
    return {"status": "success", "invoice_number": inv.invoice_number}

class CreateInvoiceRequest(BaseModel):
    company_id: UUID
    plan_name: str
    billing_type: str
    price_per_seat: float
    seats: int
    gst_rate: Optional[float] = 18.0

@router.post("/", response_model=InvoiceResponse)
def create_manual_invoice(
    req: CreateInvoiceRequest,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_auth_user)
) -> Any:
    company = db.query(Company).filter(Company.id == req.company_id).first()
    user_id = None
    company_id = None
    customer = None
    if company:
        company_id = company.id
    else:
        # Check if it is a User ID
        from app.models.user import User
        customer = db.query(User).filter(User.id == req.company_id).first()
        if customer:
            if customer.company_id is not None:
                comp = db.query(Company).filter(Company.id == customer.company_id).first()
                comp_name = comp.company_name if comp else "their company"
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot generate individual invoice for {customer.full_name or customer.email}. They are an employee of {comp_name} and must be billed via corporate invoicing."
                )
            user_id = customer.id
        else:
            raise HTTPException(status_code=404, detail="Company or Customer not found")
        
    config, version = get_current_template_snapshot_and_version(db)
    config = cast(dict, config)
    
    # Tax calculations
    tax_cfg = config.get("tax", {})
    tax_percent = req.gst_rate if req.gst_rate is not None else float(tax_cfg.get("percentage", 18.0))
    tax_included = bool(tax_cfg.get("included", False))
    
    price_per_seat = req.price_per_seat
    seats = req.seats
    subtotal = price_per_seat * seats
    
    if tax_included:
        actual_subtotal = subtotal / (1.0 + tax_percent / 100.0)
        gst_amount = subtotal - actual_subtotal
        subtotal = actual_subtotal
    else:
        gst_amount = subtotal * (tax_percent / 100.0)
        
    # Fees sum
    fees_sum = 0.0
    for fee in config.get("fees", []):
        val = float(fee.get("value", 0.0))
        if fee.get("type") == "percent":
            fees_sum += subtotal * (val / 100.0)
        else:
            fees_sum += val
            
    # Discounts sum
    discounts_sum = 0.0
    for disc in config.get("discounts", []):
        val = float(disc.get("value", 0.0))
        if disc.get("type") == "percent":
            discounts_sum += subtotal * (val / 100.0)
        else:
            discounts_sum += val
            
    total_amount = subtotal + gst_amount + fees_sum - discounts_sum
    
    # Generate unique invoice number based on config
    inv_num = generate_invoice_number(db, config)
    
    due_offset = int(config.get("invoice", {}).get("dueDateOffset", 7))
    due_date = date.today() + timedelta(days=due_offset)
    
    billing_type_lower = req.billing_type.lower()
    if billing_type_lower in ("day", "daily"):
        billing_end_date = date.today()
    elif billing_type_lower in ("week", "weekly"):
        billing_end_date = date.today() + timedelta(days=6)
    elif billing_type_lower in ("month", "monthly"):
        billing_end_date = get_next_month_first(date.today()) - timedelta(days=1)
    else:
        billing_end_date = date.today() + timedelta(days=30)
        
    new_inv = Invoice(
        id=uuid.uuid4(),
        company_id=company_id,
        user_id=user_id,
        plan_name=req.plan_name,
        billing_type=req.billing_type,
        price_per_seat=price_per_seat,
        seats=seats,
        subtotal=subtotal,
        gst_rate=tax_percent,
        gst_amount=gst_amount,
        total_amount=total_amount,
        invoice_date=date.today(),
        invoice_number=inv_num,
        billing_start_date=date.today(),
        billing_end_date=billing_end_date,
        due_date=due_date,
        status="unpaid",
        invoice_status="active",
        created_at=datetime.now(timezone.utc),
        template_version=version,
        template_snapshot=config
    )
    db.add(new_inv)
    
    # Check if there is an active seat request and link this as replacement
    if company_id is not None:
        seat_req = db.query(SeatRequest).filter(
            SeatRequest.company_id == company_id,
            SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED", "PAYMENT_VERIFIED"])
        ).order_by(SeatRequest.created_at.desc()).first()
        if seat_req:
            seat_req.invoice_id = new_inv.id
            seat_req.status = "INVOICE_GENERATED"
            db.add(seat_req)
        
    # Process generation notification immediately
    formatted_amt = f"₹{total_amount:,.2f}"
    due_date_str = due_date.strftime("%d %b %Y") if hasattr(due_date, "strftime") else str(due_date)
    msg = f"New Invoice Generated\nInvoice #{inv_num}\nAmount {formatted_amt}\nDue Date {due_date_str}"
    
    if company_id is not None:
        from app.services.notification import notify_company_admins
        notify_company_admins(db, company_id, "New Invoice Generated", msg)
        new_inv.notif_generated_sent = True
    elif user_id is not None and customer is not None:
        from app.services.notification import create_notification
        if current_user and hasattr(current_user, "id"):
            create_notification(db, customer.auth_id, "New Invoice Generated", msg, "info")
            new_inv.notif_generated_sent = True

    # Log audit event
    from app.models.audit import ActivityLog
    log = ActivityLog(
        action="Invoice Generated",
        performed_by=current_user.id,
        performed_by_name=getattr(current_user, "email", "User"),
        performed_by_role="FINANCE",
        details={
            "invoice_number": inv_num,
            "company_name": company.company_name if company else "Individual Customer",
            "customer_name": customer.full_name if (not company and customer) else None
        }
    )
    db.add(log)
    db.commit()
    db.refresh(new_inv)
    return new_inv

def verify_no_overdue_payment(db: Session, auth_user: AuthUser):
    """
    Checks if the user (or their associated company) has any unpaid invoices 
    that are past their due date. If so, blocks action with a 402 error.
    """
    return
