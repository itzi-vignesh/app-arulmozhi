from app.db.session import SessionLocal
from app.models.business import SeatRequest, Invoice
from datetime import datetime

def fix_requests():
    db = SessionLocal()
    try:
        # Find all seat requests that are linked to paid invoices but aren't verified yet
        requests = db.query(SeatRequest).join(Invoice, SeatRequest.invoice_id == Invoice.id).filter(
            Invoice.status == "paid",
            SeatRequest.status.in_(["PENDING", "INVOICE_GENERATED"])
        ).all()
        
        print(f"Found {len(requests)} seat requests linked to paid invoices needing update.")
        for r in requests:
            print(f"Updating request {r.id} for company {r.company_id} to PAYMENT_VERIFIED...")
            r.status = "PAYMENT_VERIFIED"
            r.verified_at = datetime.now()
            r.payment_method = "invoice_paid"
            
        db.commit()
        print("Successfully synchronized seat requests with paid invoices.")
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_requests()
