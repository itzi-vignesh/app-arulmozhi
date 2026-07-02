from typing import Any
from sqlalchemy.orm import Session
from app.models.audit import Notification
from app.models.user import Admin, Superuser
from uuid import UUID

def create_notification(db: Session, user_id: Any, title: str, message: str, type: str = "info", data: dict | None = None):
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        data=data or {}
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
def notify_admins(db: Session, title: str, message: str, type: str = "info", data: dict | None = None):
    admins = db.query(Admin).all()
    for admin in admins:
        create_notification(db, admin.auth_id, title, message, type, data)
    
    superusers = db.query(Superuser).all()
    for superuser in superusers:
        create_notification(db, superuser.auth_id, title, message, type, data)

def notify_meeting_requested(db: Session, meeting: Any):
    date_str = meeting.meeting_date.strftime("%d %B") if hasattr(meeting.meeting_date, "strftime") else str(meeting.meeting_date)
    start_str = meeting.start_time.strftime("%H:%M") if hasattr(meeting.start_time, "strftime") else str(meeting.start_time)[:5]
    end_str = meeting.end_time.strftime("%H:%M") if hasattr(meeting.end_time, "strftime") else str(meeting.end_time)[:5]
    
    company_name = meeting.company.company_name if meeting.company else "Unknown Company"
    msg = f"Company {company_name} requested a meeting.\n\n{date_str}\n{start_str} - {end_str}"
    
    notify_admins(db, "New Meeting Request", msg)

def notify_meeting_approved(db: Session, meeting: Any):
    msg = "Your meeting request has been approved."
    if meeting.decision_notes:
        msg += f"\nNotes: {meeting.decision_notes}"
        
    if meeting.company and meeting.company.admins:
        for admin in meeting.company.admins:
            create_notification(db, admin.auth_id, "Meeting Approved", msg)

def notify_meeting_rejected(db: Session, meeting: Any):
    msg = "Your meeting request has been rejected."
    if meeting.decision_notes:
        msg += f"\nNotes: {meeting.decision_notes}"
        
    if meeting.company and meeting.company.admins:
        for admin in meeting.company.admins:
            create_notification(db, admin.auth_id, "Meeting Rejected", msg)

def notify_meeting_cancelled(db: Session, meeting: Any):
    company_name = meeting.company.company_name if meeting.company else "Unknown Company"
    msg = f"Meeting request '{meeting.meeting_title}' from Company {company_name} has been cancelled."
    if meeting.cancel_reason:
        msg += f"\nReason: {meeting.cancel_reason}"
        
    notify_admins(db, "Meeting Request Cancelled", msg)
    
    # Also notify the company admins so they know it was cancelled/closed
    if meeting.company and meeting.company.admins:
        for admin in meeting.company.admins:
            create_notification(db, admin.auth_id, "Meeting Request Cancelled", msg)

def notify_company_admins(db: Session, company_id: Any, title: str, message: str, type: str = "info", data: dict | None = None):
    from app.models.company import CompanyAdmin
    from app.models.user import User
    admins = db.query(CompanyAdmin).filter(CompanyAdmin.company_id == company_id).all()
    if admins:
        for admin in admins:
            create_notification(db, admin.auth_id, title, message, type, data)
    else:
        # If no company admins exist, notify the users belonging to this company (for customer dummy companies)
        users = db.query(User).filter(User.company_id == company_id).all()
        for u in users:
            create_notification(db, u.auth_id, title, message, type, data)

def start_reminder_scheduler():
    import threading
    import time
    from datetime import date
    from app.db.session import SessionLocal
    from app.models.business import Invoice
    
    def send_daily_reminders():
        db = SessionLocal()
        try:
            from datetime import datetime, timezone, timedelta
            from app.models.audit import Notification
            
            # Find all active unpaid invoices
            unpaid_invoices = db.query(Invoice).filter(
                Invoice.status == "unpaid",
                Invoice.invoice_status == "active"
            ).all()
            
            for invoice in unpaid_invoices:
                # Notify Superuser if overdue
                if invoice.due_date and invoice.due_date < date.today():
                    time_threshold = datetime.now(timezone.utc) - timedelta(hours=20)
                    su_already_sent = db.query(Notification).filter(
                        Notification.title == "Overdue Payment Alert (Superuser)",
                        Notification.created_at >= time_threshold,
                        Notification.message.like(f"%#{invoice.invoice_number}%")
                    ).first()
                    
                    if not su_already_sent:
                        entity_name = invoice.owner_name
                        formatted_amt = f"₹{invoice.total_amount:,.2f}"
                        su_msg = f"Overdue Payment Alert: Invoice #{invoice.invoice_number} for {entity_name} of amount {formatted_amt} is past its due date ({invoice.due_date.strftime('%d %b %Y')}) and remains unpaid. You may choose to suspend their access manually."
                        superusers = db.query(Superuser).all()
                        for su in superusers:
                            create_notification(db, su.auth_id, "Overdue Payment Alert (Superuser)", su_msg, "error")

                # Check if an overdue reminder was already generated in the last 20 hours
                time_threshold = datetime.now(timezone.utc) - timedelta(hours=20)
                already_sent = db.query(Notification).filter(
                    Notification.title == "Overdue Payment Reminder",
                    Notification.created_at >= time_threshold,
                    Notification.message.like(f"%#{invoice.invoice_number}%")
                ).first()
                
                if already_sent:
                    continue
                
                formatted_amt = f"₹{invoice.total_amount:,.2f}"
                due_date_str = invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "N/A"
                msg = f"Reminder: You have an unpaid invoice #{invoice.invoice_number} of {formatted_amt} due on {due_date_str}. Please pay immediately to prevent suspension of your services."
                
                if invoice.company_id:
                    notify_company_admins(db, invoice.company_id, "Overdue Payment Reminder", msg, "warning")
                elif invoice.user_id:
                    from app.models.user import User
                    user = db.query(User).filter(User.id == invoice.user_id).first()
                    if user and user.auth_id:
                        create_notification(db, user.auth_id, "Overdue Payment Reminder", msg, "warning")
                        
            db.commit()
        except Exception as e:
            print(f"Error in send_daily_reminders: {e}")
        finally:
            db.close()

    def run_scheduler():
        # Wait 30 seconds on startup
        time.sleep(30)
        while True:
            try:
                send_daily_reminders()
            except Exception as e:
                print(f"Error running scheduler cycle: {e}")
            # Run every 24 hours (86400 seconds)
            time.sleep(86400)
            
    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()

