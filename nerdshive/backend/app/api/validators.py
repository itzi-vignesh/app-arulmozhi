import re
from typing import Optional
from fastapi import HTTPException

# Regex definitions
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
MOBILE_REGEX = re.compile(r"^[6-9][0-9]{9}$")
AADHAAR_REGEX = re.compile(r"^[0-9]{12}$")
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
GST_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$")
PINCODE_REGEX = re.compile(r"^[1-9][0-9]{5}$")
NAME_REGEX = re.compile(r"^[A-Za-z\s.'-]{3,}$")
COMPANY_NAME_REGEX = re.compile(r"^[a-zA-Z0-9\s&.,*()]{3,}$")
URL_REGEX = re.compile(r"^(https?://)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(/.*)?$")

def validate_email_str(email: Optional[str], field_name: str = "Email"):
    if not email or not email.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not EMAIL_REGEX.match(email.strip()):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

def validate_phone_str(phone: Optional[str], field_name: str = "Mobile number"):
    if not phone or not phone.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not MOBILE_REGEX.match(phone.strip()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.")

def validate_password_str(password: Optional[str], field_name: str = "Password"):
    if not password:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail=f"{field_name} must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail=f"{field_name} must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail=f"{field_name} must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail=f"{field_name} must contain at least one number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail=f"{field_name} must contain at least one special character.")

def validate_name_str(name: Optional[str], field_name: str = "Name"):
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not NAME_REGEX.match(name.strip()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be at least 3 characters and allow only alphabets, spaces, apostrophes, dots, and hyphens.")

def validate_company_name_str(name: Optional[str], field_name: str = "Company Name"):
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not COMPANY_NAME_REGEX.match(name.strip()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be at least 3 characters and can only contain letters, numbers, spaces, and standard punctuation (&.,*()).")

def validate_website_str(url: Optional[str], field_name: str = "Website"):
    if not url or not url.strip():
        return
    if not URL_REGEX.match(url.strip()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid URL.")

def validate_aadhaar_str(aadhaar: Optional[str], field_name: str = "Aadhaar Number"):
    if not aadhaar or not aadhaar.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not AADHAAR_REGEX.match(aadhaar.strip()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be exactly 12 digits and numeric only.")

def validate_pan_str(pan: Optional[str], field_name: str = "PAN Number"):
    if not pan or not pan.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not PAN_REGEX.match(pan.strip().upper()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid 10-character PAN (e.g., ABCDE1234F).")

def validate_gst_str(gst: Optional[str], field_name: str = "GST Number"):
    if not gst or not gst.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not GST_REGEX.match(gst.strip().upper()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid 15-character GST number (e.g., 22ABCDE1234F1Z5).")

from datetime import date

def validate_pincode_str(pincode: Optional[str], field_name: str = "PIN Code"):
    if not pincode or not pincode.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if not PINCODE_REGEX.match(pincode.strip()):
        raise HTTPException(status_code=400, detail=f"{field_name} must be exactly 6 digits and numeric only, starting with a non-zero digit.")

def validate_dob(dob: Optional[date], field_name: str = "Date of Birth"):
    if not dob:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if dob > date.today():
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be a future date.")

def validate_joining_date(joining: Optional[date], dob: Optional[date], field_name: str = "Joining Date"):
    if not joining:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    if dob and joining < dob:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be earlier than Date of Birth.")

def validate_emergency_contact(name: Optional[str], number: Optional[str]):
    if name:
        if not re.match(r"^[a-zA-Z\s]+$", name):
            raise HTTPException(status_code=400, detail="Emergency contact person can contain only letters and spaces.")
    if number:
        if not re.match(r"^[0-9]+$", number):
            raise HTTPException(status_code=400, detail="Emergency contact number must contain only numbers.")
        if len(number) != 10:
            raise HTTPException(status_code=400, detail="Emergency contact number must contain exactly 10 digits.")

def validate_vehicle_details(requires_parking: bool, v_type: Optional[str], brand: Optional[str], color: Optional[str], reg: Optional[str]):
    if requires_parking:
        if not v_type or not v_type.strip():
            raise HTTPException(status_code=400, detail="Vehicle Type is required.")
        if not brand or not brand.strip():
            raise HTTPException(status_code=400, detail="Vehicle Brand & Model is required.")
        if not color or not color.strip():
            raise HTTPException(status_code=400, detail="Vehicle Color is required.")
        if color and not re.match(r"^[a-zA-Z\s]+$", color):
            raise HTTPException(status_code=400, detail="Vehicle color can contain only letters and spaces.")
        if not reg or not reg.strip():
            raise HTTPException(status_code=400, detail="Vehicle registration number is required.")
        
        reg_clean = reg.strip().replace(" ", "").upper()
        # Indian registration pattern check (e.g. TN01AB1234)
        if not re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$", reg_clean):
            raise HTTPException(status_code=400, detail="Vehicle registration must match standard format (e.g. TN01AB1234).")
    else:
        if color and not re.match(r"^[a-zA-Z\s]+$", color):
            raise HTTPException(status_code=400, detail="Vehicle color can contain only letters and spaces.")
        if reg:
            reg_clean = reg.strip().replace(" ", "").upper()
            if not re.match(r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$", reg_clean):
                raise HTTPException(status_code=400, detail="Vehicle registration must match standard format (e.g. TN01AB1234).")
