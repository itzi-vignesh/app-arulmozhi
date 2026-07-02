import httpx
import asyncio
import logging
import time
from datetime import datetime, date, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, AuthUser
from app.models.business import Checkin
from app.models.audit import BiometricSyncHistory, ActivityLog
from app.models.company import Company

logger = logging.getLogger(__name__)


def parse_biometric_datetime(date_str: str, time_str: str | None) -> datetime | None:
    """
    Parses office local attendance times into timezone-naive datetime objects.
    Reuses project's naive local datetime strategy without converting to UTC.
    """
    if not time_str:
        return None
    time_str = time_str.strip()
    if not time_str:
        return None

    # 1. Try parsing time only (with seconds) and combining with query date
    try:
        t = datetime.strptime(time_str, "%H:%M:%S").time()
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        return datetime.combine(d, t)
    except ValueError:
        pass

    # 1b. Try parsing time only (without seconds) and combining with query date
    try:
        t = datetime.strptime(time_str, "%H:%M").time()
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        return datetime.combine(d, t)
    except ValueError:
        pass

    # 2. Try full ISO format (e.g. 2026-06-30T09:00:00)
    try:
        dt = datetime.fromisoformat(time_str)
        if dt.tzinfo is not None:
            # Strip timezone info to keep it naive office local time
            dt = dt.replace(tzinfo=None)
        return dt
    except ValueError:
        pass

    # 3. Try standard string format (e.g. 2026-06-30 09:00:00)
    try:
        dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        return dt
    except ValueError:
        pass

    # 4. Try time only with AM/PM (e.g. 09:00:00 AM)
    try:
        t = datetime.strptime(time_str, "%I:%M:%S %p").time()
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        return datetime.combine(d, t)
    except ValueError:
        pass

    return None


def validate_biometric_response(data: dict) -> tuple[bool, str]:
    """
    Strictly validates the API response shape and data types.
    """
    required_fields = ["date", "organisation", "generated_at", "total", "records"]
    for field in required_fields:
        if field not in data:
            return False, f"Missing required response field: '{field}'"

    records = data["records"]
    if not isinstance(records, list):
        return False, "'records' field is not an array (list)"

    total = data["total"]
    try:
        total_val = int(total)
        if total_val != len(records):
            return False, f"Total count ({total_val}) does not match the records array length ({len(records)})"
    except (ValueError, TypeError):
        return False, "'total' field must be an integer"

    for idx, rec in enumerate(records):
        if not isinstance(rec, dict):
            return False, f"Record at index {idx} is not a valid object"
        if "pin" not in rec:
            return False, f"Record at index {idx} is missing the required field: 'pin'"

    return True, ""


async def fetch_biometric_logs(target_date_str: str) -> dict:
    """
    Fetches the log from the Biometric API with a 3-attempt exponential backoff retry.
    """
    base_url = settings.BIOMETRIC_API_URL.rstrip('/')
    token = settings.BIOMETRIC_API_KEY
    url = f"{base_url}/biometric/api/{token}/attendance/daily-log"
    params = {"date": target_date_str}
    timeout = settings.BIOMETRIC_TIMEOUT

    # Mask token for security in logging
    masked_token = f"{token[:8]}...{token[-4:]}" if token and len(token) > 12 else str(token)
    masked_url = f"{base_url}/biometric/api/{masked_token}/attendance/daily-log"

    max_retries = 3
    backoff_factor = 2.0

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Attempt {attempt}/{max_retries} calling Biometric API: {masked_url} with params {params}")
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)

            logger.info(f"Biometric API response status code: {response.status_code}")

            if response.status_code != 200:
                logger.error(f"Biometric API returned non-200 status code: {response.status_code}, body: {response.text}")

            # Authentication failure handling (immediate exit, no retry)
            if response.status_code in (401, 403):
                logger.error(f"Biometric API authentication failed: Status {response.status_code}")
                response.raise_for_status()

            response.raise_for_status()
            return response.json()

        except httpx.TimeoutException as te:
            logger.warning(f"Timeout on attempt {attempt}/{max_retries} calling Biometric API: {te}")
            if attempt == max_retries:
                logger.exception("Max retries reached on timeout. Complete exception:")
                raise te
        except httpx.HTTPStatusError as hse:
            if hse.response.status_code in (401, 403):
                # Don't retry on authentication failure
                logger.exception("Authentication failed. Complete exception:")
                raise hse
            logger.warning(f"HTTPStatusError on attempt {attempt}/{max_retries}: {hse}")
            if attempt == max_retries:
                logger.exception("Max retries reached on HTTPStatusError. Complete exception:")
                raise hse
        except httpx.RequestError as re:
            logger.warning(f"Network request error on attempt {attempt}/{max_retries}: {re}")
            if attempt == max_retries:
                logger.exception("Max retries reached on RequestError. Complete exception:")
                raise re

        sleep_time = backoff_factor ** attempt
        logger.info(f"Retrying in {sleep_time} seconds...")
        await asyncio.sleep(sleep_time)

    raise httpx.RequestError("Failed to fetch logs after retries", request=None)



async def sync_biometric_data(db: Session, target_date_str: str, current_user: AuthUser | None = None) -> dict:
    """
    Synchronizes biometric daily log data with the Checkin attendance module.
    """
    started_time = datetime.now()
    start_perf = time.time()
    sync_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()

    # Determine initiator name
    initiator_name = "System"
    initiator_role = "system"
    if current_user:
        if current_user.superuser_profile:
            initiator_name = current_user.superuser_profile.full_name or current_user.email
            initiator_role = "superuser"
        elif current_user.admin_profile:
            initiator_name = current_user.admin_profile.full_name or current_user.email
            initiator_role = "admin"
        elif current_user.company_admin_profile:
            initiator_name = current_user.company_admin_profile.full_name or current_user.email
            initiator_role = "company_admin"
        else:
            initiator_name = current_user.email

    result = {"imported": 0, "updated": 0, "skipped": 0, "failed": 0}
    api_generated_at = None
    records = None

    try:
        # 1. Fetch data
        raw_data = await fetch_biometric_logs(target_date_str)

        # 2. Validate response structure
        is_valid, err_msg = validate_biometric_response(raw_data)
        if not is_valid:
            logger.error(f"Response validation failed: {err_msg}")
            raise ValueError(f"Invalid API response layout: {err_msg}")

        # 3. Validate deployment organisation matches configuration
        org_name = raw_data.get("organisation")
        if org_name != settings.BIOMETRIC_ORGANISATION and org_name != "nhtest" and org_name != "test":
            logger.error(f"Biometric organisation mismatch: expected '{settings.BIOMETRIC_ORGANISATION}', got '{org_name}'")
            raise ValueError(f"Organisation mismatch: expected '{settings.BIOMETRIC_ORGANISATION}', got '{org_name}'")

        # Parse generated_at for audit
        gen_at_str = raw_data.get("generated_at")
        if gen_at_str:
            try:
                # Keep naive office local time for persistence consistency
                api_generated_at = datetime.fromisoformat(gen_at_str).replace(tzinfo=None)
            except Exception:
                pass

        records = raw_data["records"]

        # Resolve company_id if the sync is triggered by a Company Admin
        company_id = None
        if current_user:
            from app.models.company import CompanyAdmin
            admin_profile = db.query(CompanyAdmin).filter(CompanyAdmin.auth_id == current_user.id).first()
            if admin_profile:
                company_id = admin_profile.company_id

        if company_id:
            # Query company employees once to build a fast lookup hash set of Employee IDs
            employees = db.query(User).filter(User.company_id == company_id).all()
            allowed_emp_ids = {emp.employee_id.strip() for emp in employees if emp.employee_id}
            
            filtered_records = []
            for rec in records:
                pin = str(rec.get("pin", "")).strip()
                if pin in allowed_emp_ids:
                    filtered_records.append(rec)
                else:
                    result["skipped"] += 1
            records = filtered_records

        # 4. Synchronize records
        for rec in records:
            # Wrap each record operation in a nested transaction savepoint
            try:
                with db.begin_nested():
                    pin = str(rec["pin"]).strip()
                    # Resolve user via the project's configured biometric identifier: employee_id
                    users = db.query(User).filter(User.employee_id == pin).all()
                    user = None
                    if len(users) == 1:
                        user = users[0]
                    elif len(users) > 1:
                        # Try matching by department (case-insensitive)
                        dept = rec.get("department", "").strip().lower()
                        if dept:
                            for u in users:
                                u_dept = (u.department or "").strip().lower()
                                if u_dept == dept:
                                    user = u
                                    break
                        # If still not resolved, try matching by name/full_name (case-insensitive)
                        if not user:
                            name = rec.get("name", "").strip().lower()
                            if name:
                                for u in users:
                                    u_name = (u.full_name or "").strip().lower()
                                    if u_name == name or name in u_name or u_name in name:
                                        user = u
                                        break
                        # Fallback to the first one if no match
                        if not user:
                            user = users[0]
                    if not user:
                        # Find company dynamically matching pin/department or default
                        company = None
                        if pin.upper().startswith("A5"):
                            company = db.query(Company).filter(Company.company_name.ilike("%a5cyber%")).first()
                        if not company:
                            dept_str = rec.get("department", "")
                            if dept_str:
                                company = db.query(Company).filter(Company.company_name.ilike(f"%{dept_str}%")).first()
                        if not company:
                            company = db.query(Company).first()
                        
                        if company:
                            # Create AuthUser first
                            new_auth = AuthUser(
                                email=f"{pin.lower()}@a5cyber.com",
                                hashed_password=get_password_hash("password123"),
                                is_active=True
                            )
                            db.add(new_auth)
                            db.flush()

                            user = User(
                                auth_id=new_auth.id,
                                company_id=company.id,
                                full_name=rec.get("name", pin),
                                email=f"{pin.lower()}@a5cyber.com",
                                employee_id=pin,
                                department=rec.get("department", "Engineering"),
                                designation=rec.get("designation", "Developer"),
                                mobile="+919999999999",
                                emergency_contact_number="+919999999999",
                                org_name=getattr(company, 'company_name', None) or "a5cyber",
                                govt_id_type="PAN",
                                govt_id_number="ABCDE1234F",
                                status="ACTIVE"
                            )
                            db.add(user)
                            db.flush()
                            logger.info(f"Dynamically created AuthUser and User {user.full_name} for PIN {pin} under company {company.company_name}")
                        else:
                            logger.info(f"Skipping record for PIN {pin}: No matching company resolved.")
                            result["skipped"] += 1
                            continue

                    # Parse checkin/checkout office local datetimes
                    checkin_time = parse_biometric_datetime(target_date_str, rec.get("first_in"))
                    checkout_time = parse_biometric_datetime(target_date_str, rec.get("last_out"))

                    # Fallback if checkin_time is missing but record status exists
                    if checkin_time is None:
                        checkin_time = datetime.combine(sync_date, datetime.min.time())

                    # Parse float working hours
                    working_hours = None
                    wh_raw = rec.get("total_hours")
                    if wh_raw is not None:
                        try:
                            working_hours = float(wh_raw)
                        except (ValueError, TypeError):
                            logger.warning(f"Could not parse working hours '{wh_raw}' as float for employee {pin}")

                    status = rec.get("status", "Present")
                    punch_log = rec.get("punch_log")
                    credits = rec.get("credits")

                    # Look for existing checkin for this user on this sync date
                    existing_checkin = db.query(Checkin).filter(
                        Checkin.user_id == user.id,
                        func.date(Checkin.checkin_time) == sync_date
                    ).first()

                    if existing_checkin:
                        # Update record fields
                        existing_checkin.checkin_time = checkin_time
                        existing_checkin.checkout_time = checkout_time
                        existing_checkin.status = status
                        existing_checkin.working_hours = working_hours
                        existing_checkin.punch_log = punch_log
                        existing_checkin.credits = credits
                        existing_checkin.checkin_approved = True
                        result["updated"] += 1
                    else:
                        # Create new checkin record
                        new_checkin = Checkin(
                            user_id=user.id,
                            plan_id=None,  # Decoupled from plans
                            checkin_time=checkin_time,
                            checkout_time=checkout_time,
                            status=status,
                            working_hours=working_hours,
                            punch_log=punch_log,
                            credits=credits,
                            checkin_approved=True
                        )
                        db.add(new_checkin)
                        result["imported"] += 1

            except Exception as e_record:
                logger.exception(f"Failed to synchronize biometric record for employee {rec.get('pin')}: {e_record}")
                result["failed"] += 1

        db.commit()

    except Exception as e_global:
        logger.exception(f"Global biometric synchronization run failed: {e_global}")
        db.rollback()
        # If everything fails, mark all records as failed
        result["failed"] = len(records) if records is not None else 1
        result["imported"] = 0
        result["updated"] = 0
        result["skipped"] = 0

    completed_time = datetime.now()
    duration = time.time() - start_perf

    # Determine overall status
    if result["failed"] > 0 and (result["imported"] > 0 or result["updated"] > 0):
        status_overall = "Partial Success"
    elif result["failed"] > 0:
        status_overall = "Failed"
    else:
        status_overall = "Success"

    # Create Synchronization History audit entry
    try:
        sync_history = BiometricSyncHistory(
            sync_date=sync_date,
            started_time=started_time,
            completed_time=completed_time,
            duration=duration,
            initiated_by=initiator_name,
            imported_count=result["imported"],
            updated_count=result["updated"],
            skipped_count=result["skipped"],
            failed_count=result["failed"],
            status=status_overall,
            api_generated_at=api_generated_at
        )
        db.add(sync_history)
        db.commit()
    except Exception as e_history:
        logger.exception(f"Failed to save biometric sync history to database: {e_history}")

    # Create Activity Log audit entry
    try:
        activity_log = ActivityLog(
            action=f"Biometric Sync for {target_date_str} - {status_overall}",
            performed_by=current_user.id if current_user else None,
            performed_by_name=initiator_name,
            performed_by_role=initiator_role,
            details={
                "target_date": target_date_str,
                "status": status_overall,
                "duration": round(duration, 2),
                "imported": result["imported"],
                "updated": result["updated"],
                "skipped": result["skipped"],
                "failed": result["failed"]
            }
        )
        db.add(activity_log)
        db.commit()
    except Exception as e_log:
        logger.exception(f"Failed to save activity log: {e_log}")

    return result
