from app.db.session import SessionLocal
from app.models.company import Company
from app.models.business import Invoice, PricingPlan
from datetime import datetime, timezone, timedelta
import uuid

db = SessionLocal()
try:
    company = db.query(Company).filter(Company.id == "81aeaf00-ee05-432a-a458-397604a8f791").first()
    if company:
        plan = db.query(PricingPlan).filter(PricingPlan.id == company.selected_plan_id).first()
        if plan is not None:
            # We want to check if a seat upgrade invoice already exists
            existing_upgrade = db.query(Invoice).filter(
                Invoice.company_id == company.id,
                Invoice.plan_name.like("%Seat Upgrade%")
            ).first()
            
            if not existing_upgrade:
                diff_seats = 1  # 8 seats - 7 seats
                price_per_seat = float(plan.price)  # type: ignore
                subtotal = price_per_seat * diff_seats
                gst_rate = 18
                gst_amount = subtotal * (gst_rate / 100)
                total_amount = subtotal + gst_amount
                
                # Fetch latest invoice to copy billing period dates
                latest_inv = db.query(Invoice).filter(
                    Invoice.company_id == company.id,
                    Invoice.invoice_number == "INV-00002"
                ).first()
                
                if latest_inv:
                    billing_start = latest_inv.billing_start_date
                    billing_end = latest_inv.billing_end_date
                    due_date = latest_inv.due_date
                    invoice_date = latest_inv.invoice_date
                else:
                    invoice_date = datetime.now(timezone.utc).date()
                    billing_start = invoice_date
                    billing_end = invoice_date + timedelta(days=30)
                    due_date = invoice_date
                    
                # Generate sequential unique invoice number
                count = db.query(Invoice).count()
                while True:
                    inv_num = f"INV-{(count + 1):05d}"
                    existing_inv = db.query(Invoice).filter(Invoice.invoice_number == inv_num).first()
                    if not existing_inv:
                        break
                    count += 1
                    
                new_inv = Invoice(
                    id=uuid.uuid4(),
                    company_id=company.id,
                    plan_name=f"{plan.plan_name} - Seat Upgrade",
                    billing_type=plan.billing_type,
                    price_per_seat=price_per_seat,
                    seats=diff_seats,
                    subtotal=subtotal,
                    gst_rate=gst_rate,
                    gst_amount=gst_amount,
                    total_amount=total_amount,
                    invoice_date=invoice_date,
                    status="unpaid",
                    created_at=datetime.now(timezone.utc),
                    invoice_number=inv_num,
                    billing_start_date=billing_start,
                    billing_end_date=billing_end,
                    due_date=due_date
                )
                db.add(new_inv)
                db.commit()
                print("SUCCESS: Upgrade invoice created:", inv_num, "amount:", total_amount)
            else:
                print("ALREADY EXISTS: Upgrade invoice already exists.")
        else:
            print("FAILED: Plan not found.")
    else:
        print("FAILED: Company not found.")
finally:
    db.close()
