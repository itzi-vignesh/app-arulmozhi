import smtplib
from email.message import EmailMessage
from typing import Optional
from app.core.config import settings

def send_email(to_email: str, subject: str, body_text: str, body_html: Optional[str] = None) -> bool:
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = settings.EMAILS_FROM_EMAIL
        msg['To'] = to_email
        msg.set_content(body_text)
        
        if body_html:
            msg.add_alternative(body_html, subtype='html')

        # Using a context manager for SMTP
        # In production, use starttls or SMTP_SSL based on server requirements
        # For demonstration, we assume standard SMTP with STARTTLS
        # with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
        #     server.starttls()
        #     server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        #     server.send_message(msg)
        
        print(f"Mock Email sent to {to_email}. Subject: {subject}")
        print(f"Body: {body_text}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def send_reset_password_email(email_to: str, token: str) -> None:
    subject = "Password Reset Request"
    link = f"http://localhost:5173/reset-password?token={token}"
    body = f"Please click the following link to reset your password: {link}\nIf you did not request this, please ignore this email."
    send_email(email_to, subject, body)

def send_admin_invitation_email(email_to: str, token: str) -> None:
    subject = "Admin Invitation"
    link = f"http://localhost:5173/setup-password?token={token}"
    body = f"You have been invited to join as an Admin. Click here to set up your account: {link}"
    send_email(email_to, subject, body)
