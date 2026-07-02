import re
from typing import List, Dict

def map_headers(headers: List[str]) -> Dict[str, int]:
    header_map = {}
    mappings = {
        "sno": ["s.no", "sno", "sl.no", "serial", "serial no", "sr.no", "s. no", "s.no."],
        "name": ["name", "full name", "fullname", "user name", "username", "employee name"],
        "gender": ["gender", "sex"],
        "dateOfBirth": ["date of birth", "dob", "birth date", "birthdate", "d.o.b", "d.o.b."],
        "mobile": ["mobile", "mobile no", "phone", "phone no", "contact", "contact no", "mobile number", "phone number", "contact number"],
        "email": ["email", "email id", "e-mail", "mail", "email address", "e-mail id"],
        "emergencyContactName": ["emergency contact person", "emergency contact", "emergency name", "emergency contact name", "emergency person"],
        "emergencyContactNumber": ["emergency contact no", "emergency no", "emergency phone", "emergency contact number", "emergency mobile"],
        "companyName": ["company name", "company", "organization", "org name", "organisation", "employer"],
        "department": ["department", "department/team", "team", "dept", "dept."],
        "designation": ["designation", "designation/role", "role", "position", "title", "job title"],
        "employeeId": ["employee id", "emp id", "employee no", "emp no", "emp. id", "employee code", "emp code"],
        "joiningDate": ["joining date", "joining date in nh", "join date", "date of joining", "doj", "d.o.j", "start date"],
        "duration": ["duration", "tenure", "employment type", "contract type", "employment duration"],
        "idProofType": ["id proof type", "id type", "govt id type", "document type", "id document type", "proof type"],
        "idProofNumber": ["id proof no", "id proof number", "id number", "govt id no", "id document number", "proof number", "id no"],
        "requiresParking": ["do you require parking", "parking", "parking required", "requires parking", "need parking", "parking needed", "parking?", "do you require parking?"],
        "vehicleType": ["vehicle type", "type of vehicle", "vehicle"],
        "vehicleBrandModel": ["vehicle brand & model", "vehicle brand", "vehicle model", "brand & model", "brand and model", "vehicle brand and model"],
        "vehicleColor": ["vehicle color", "color", "vehicle colour", "colour"],
        "vehicleRegistration": ["vehicle registration number", "registration number", "vehicle no", "reg no", "vehicle registration no", "registration no", "vehicle number"],
    }
    
    # First pass: Exact matches (after cleaning dots)
    for index, header in enumerate(headers):
        normalized = header.lower().strip().replace("?", "").replace(":", "").replace(".", "")
        for key, aliases in mappings.items():
            if key not in header_map:
                if any(normalized == alias.replace(".", "") for alias in aliases):
                    header_map[key] = index
                    break
                    
    # Second pass: Substring matches (only for keys not yet mapped, matching longest alias first)
    for index, header in enumerate(headers):
        if index in header_map.values():
            continue
        normalized = header.lower().strip().replace("?", "").replace(":", "").replace(".", "")
        for key, aliases in mappings.items():
            if key not in header_map:
                for alias in sorted(aliases, key=len, reverse=True):
                    alias_clean = alias.replace(".", "")
                    if alias_clean and alias_clean in normalized:
                        header_map[key] = index
                        break
                if key in header_map:
                    break
    return header_map

headers: List[str] = [str(x) for x in "S.No,Full Name,Gender,Date of Birth,Mobile No,Email ID,Emergency Contact Person,Emergency Contact No,Company Name,Department,Designation,Employee ID,Joining Date in NH,Duration,ID Proof Type,ID Proof Number,Do you require parking,Vehicle Type,Vehicle Brand & Model,Vehicle Color,Vehicle Registration Number".split(",")]
print("Headers:", headers)
m = map_headers(headers)
print("Mapping:")
for k, v in m.items():
    print(f"  {k}: {v} -> {headers[v] if v < len(headers) else 'OUT OF BOUNDS'}")
