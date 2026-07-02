# Migration Walkthrough & Final Verification

We have successfully completed the migration work to bring frontend API coverage to 100%. Here is a breakdown of the changes made and the verification steps taken.

## Changes Made

### 1. Database Schema Updates
To support the registration flow and profile management on the frontend, the following columns were added to the `User` model ([user.py](file:///e:/1/backend/app/models/user.py)) and user schemas ([user.py](file:///e:/1/backend/app/schemas/user.py)):
- `city` (String, optional)
- `location` (String, optional)
- `occupation` (String, optional)
- `govt_id_copy_url` (String, optional)
- `reimbursement` (Boolean, default False)
- `gst_number` (String, optional)
- `org_location` (String, optional)

These were successfully generated and applied via Alembic migrations (`alembic upgrade head`).

### 2. Missing Backend Endpoints Implemented
We implemented all 10 missing endpoints in the backend, adding appropriate Role-Based Access Control (RBAC):

#### `backend/app/api/v1/endpoints/users.py` ([users.py](file:///e:/1/backend/app/api/v1/endpoints/users.py))
- `POST /`: Create a new user profile linked to the authenticated user.
- `GET /{user_id}`: Retrieve a specific user profile (restricted to Owner, Admins, or Superusers).
- `POST /delete`: Entirely delete a specific user (Superuser only).
- `DELETE /`: Bulk delete all non-elevated user profiles (Superuser only).

#### `backend/app/api/v1/endpoints/storage.py` ([storage.py](file:///e:/1/backend/app/api/v1/endpoints/storage.py))
- `POST /id-proofs/{filename:path}`: Upload ID proofs securely to local storage.
- `POST /customer-photos/{filename:path}`: Upload customer photos securely to local storage.
- `GET /{bucket}/{path:path}`: Simulates signed URLs by returning an absolute API URL constructed dynamically using `Request` base host/port details.
- `GET /raw/{bucket}/{path:path}`: Securely serves raw file binaries to authorized users.

#### `backend/app/api/v1/endpoints/checkins.py` ([checkins.py](file:///e:/1/backend/app/api/v1/endpoints/checkins.py))
- `POST /{checkin_id}/verify_payment`: Updates check-in payment status to `"verified"` and marks associated plan's `payment_verified` to `True` (Admin only).

#### `backend/app/api/v1/endpoints/admins.py` ([admins.py](file:///e:/1/backend/app/api/v1/endpoints/admins.py))
- `DELETE /`: Bulk deletes admin records (Superuser only).

#### `backend/app/api/v1/endpoints/audit.py` ([audit.py](file:///e:/1/backend/app/api/v1/endpoints/audit.py))
- `POST /admin_tab_views`: Logs admin tab view activity (Admin only).

---

## Verification Results

1. **Static API Coverage Scan**:
   Running `python scratch/generate_coverage_report.py` produced 100% matched endpoints:
   - **Total Frontend API Calls**: 45
   - **Matched Backend Endpoints**: 45 / 45
   - **Unmatched Frontend Calls**: 0
   - **Mocked Backend Endpoints**: 0

2. **Container Rebuild & Health Checks**:
   Rebuilt and restarted the backend service. The application started up successfully on port 8000 and the DB health checks passed successfully.

### 3. Bulk User Enrollment Support

To address file upload failures, the bulk user enrollment flow has been fully implemented and verified on the FastAPI backend:

#### Endpoints & DB Changes
- **`POST /api/v1/users/bulk-enroll`** implemented in `backend/app/api/v1/endpoints/users.py` ([users.py](file:///e:/1/backend/app/api/v1/endpoints/users.py)):
  - Parses uploaded CSV data and maps header columns using a robust two-pass matching logic. This prevents shorter aliases (like `"name"` or `"vehicle"`) from shadowing more specific headers.
  - Automatically handles user lookup to support both creating new users and updating existing user records.
  - Performs validation (email formats, phone lengths, presence of mandatory fields, etc.) and filters out potential injection attempts.
  - Generates secure initial passwords from the customer's full name and date of birth (`{CleanName}{DD}{MM}{YYYY}`) and hashes them properly.
  - Logs user enrollment/update actions into the `ActivityLog` table.
- **Database Sequence**: Created `customer_id_seq` sequence in PostgreSQL to generate sequential customer IDs formatted as `NH-{year}-{nextval:05d}`.

#### Verification
- Created and executed the automated integration test script `scratch/test_bulk_enroll.py` ([test_bulk_enroll.py](file:///e:/1/scratch/test_bulk_enroll.py)):
  - **Validation Handling**: Verified that invalid CSV structures (like the sales CSV) return `200 OK` with detailed row-by-row error validation logs rather than crashing with `405 Method Not Allowed` or generic server errors.
  - **Registration & Cascades**: Verified that uploading valid CSV data inserts clean user profiles, generates unique sequential customer IDs, records admin activity logs, and handles DB updates correctly.
  - **Pass Status**: The script completed successfully with all assertions passing.

### 4. Recent Fixes & Frontend Verification (June 2026)

#### Missing DialogDescription Import Fix
- **Issue**: Navigating to the Corporate Dashboard threw a blank screen crash (`ReferenceError: DialogDescription is not defined`) because it was used in the dedicated "Request More Seats" modal but not imported from `@/components/ui/dialog`.
- **Fix**: Added `DialogDescription` to the imports of `@/components/ui/dialog` in [CorporateDashboard.tsx](file:///e:/1/src/pages/CorporateDashboard.tsx#L15).
- **Result**: Frontend rebuilt and deployed successfully. The page loads without error and the "Request More Seats" modal functions perfectly.

#### Dedicated "Request More Seats" Modal Verification
- Verified that clicking the **Request More Seats** button under the *Plans* tab opens a compact, dedicated modal showing the current seats capacity and allowing entry of the new total seats requested. It no longer opens the full "Edit Company Information" panel.
- Verified that the updated value is sent correctly to the backend database via the API.

#### User Rejection Flow Verification
- Verified that registering a user and then rejecting them from the Superuser Approvals dashboard functions correctly.
- The rejection flow deletes the `AuthUser` record (which cascades to clean up corresponding profile details, check-ins, and plans) to allow the email address to be reused in any future signup attempt.

### 5. CSV Template Download Fix (June 23, 2026)
- **Issue**: Attempting to download the CSV template resulted in a browser-generated UUID filename (e.g. `57fdb164-6b74-46bb-a867-8abc6ba52589`) without an extension, even when the static file existed on Nginx. This happened because modern browser engines, security sandboxes, or local service worker interception models fallback to UUID filenames for binary files requested via standard routes over HTTP.
- **Fix**:
  1. Created a dedicated backend download endpoint in [users.py](file:///e:/1/backend/app/api/v1/endpoints/users.py#L18-L33) (`/api/v1/users/download-template`) that serves the template dynamically.
  2. The endpoint forces the correct browser filename and MIME type by explicitly sending:
     - `Content-Disposition: attachment; filename="bulk_enrollment_template.csv"` (or `employee_enrollment_template.csv` based on query param).
     - `Content-Type: text/csv; charset=utf-8`.
  3. Updated [BulkEnrollmentTab.tsx](file:///e:/1/src/components/BulkEnrollmentTab.tsx#L393-L406) and [CorporateDashboard.tsx](file:///e:/1/src/pages/CorporateDashboard.tsx#L340-L354) download links to point directly to the backend endpoint:
     - `/api/v1/users/download-template?filename=bulk_enrollment_template.csv`
     - `/api/v1/users/download-template?filename=employee_enrollment_template.csv`
  4. Rebuilt backend & frontend Docker images and restarted both containers.
- **Verification**:
  - Validated that requesting `/api/v1/users/download-template` returns HTTP `200 OK` with `Content-Type: text/csv` and the correct `Content-Disposition: attachment; filename="..."` header.
  - Verified through a browser subagent that clicking the download button in the Superuser Dashboard triggers the API-backed download successfully.

### 6. Approved Seat Upgrades Approval System (June 23, 2026)
- **Issue**: A company admin requesting more seats (by updating `seats_requested`) was automatically granted the seats because the capacity limit (`seats_available`) was incorrectly computed from `seats_requested` rather than the superuser-approved `max_employee_capacity`. Additionally, the company admin could directly edit and update `max_employee_capacity` through their settings panel without superuser authorization.
- **Fix**:
  1. **Secured Settings Update**: Modified [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py#L58-L60) to ignore `max_employee_capacity` and `biometric_required` values sent by the company admin, keeping them under exclusive superuser control.
  2. **Enforced Approved Limits**: Modified active capacity checks in [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py#L99-L113) (dashboard stats) and [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py#L159-L163) (bulk user enrollment) to compute available seats using the approved `max_employee_capacity` limit rather than `seats_requested`.
  3. **Superuser Seat Decision Endpoints**: Implemented `/companies/{id}/approve-seats` and `/companies/{id}/reject-seats` PUT endpoints in [companies.py](file:///e:/1/backend/app/api/v1/endpoints/companies.py#L227-L280) for superusers to approve/reject seat requests and automatically notify company admins.
  4. **Superuser Seat Approval UI**: Rewrote [ApprovedOrganizationsTab.tsx](file:///e:/1/src/components/ApprovedOrganizationsTab.tsx) to check for pending seat upgrade requests (where `seats_requested > max_employee_capacity`) and display inline **Approve** and **Reject** buttons for superusers to verify and authorize upgrades.
- **Verification**:
  - Rebuilt backend and frontend docker images and restarted services.
  - Verified that company admin capacity remains locked to `max_employee_capacity` and any upgrade request stays pending until a superuser explicitly approves the request in the Superuser Dashboard.

### 7. Pricing Restructure Implementation (June 24, 2026)

We have fully designed and implemented the dynamic database-driven pricing restructure:
- **Database Model & Table**: The `pricing_plans` table was created via Alembic migration (`9a177d083e04_create_pricing_plans_table`) and pre-seeded automatically with the 3 default Customer Plans (Hot Desk, Weekly Pass, Monthly Single) and the 1 Corporate Plan (Monthly Team Plan).
- **APIs with RBAC**:
  - `GET /api/v1/pricing/customer` (Public): Returns active customer plans.
  - `GET /api/v1/pricing/corporate` (Company Admin): Returns active corporate plans.
  - `GET /api/v1/admin/pricing/customer` (Admin/Superuser): Returns all customer plans.
  - `GET /api/v1/superuser/pricing` (Superuser): Returns all plans (both customer and corporate).
  - `PUT /api/v1/superuser/pricing/{id}` (Superuser): Updates any pricing plan details.
  - `PUT /api/v1/admin/pricing/customer/{id}` (Admin/Superuser): Updates only customer plans. Throws 403 Forbidden if they attempt to modify a corporate plan.
- **Audit Logging**: Changes in prices, active statuses, billing types, or plan names write to the `ActivityLog` table.
- **Frontend Refactors**:
  - **Public Customer/Customer Dashboard**: Dynamically loads customer plans from the new backend endpoints; removed all hardcoded card names, prices, and features.
  - **Corporate Dashboard**: Dynamically loads the corporate plans from `/pricing/corporate`.
  - **Superuser Dashboard**: Pricing page redesigned with Customer and Corporate tabs to edit names, prices, billing types, toggles, and features (with addition/deletion list UI) directly in the database.
  - **Admin Dashboard**: Displays both plans; allows editing Customer plans but enforces read-only access (UI elements disabled) for Corporate plans.
- **Verification Results**:
  - Ran `scratch/test_pricing_endpoints.py` which validated role-based endpoints, update operations, permission enforcement, and correct activity log format.
  - Fixed syntax compilation issue in `src/pages/AdminDashboard.tsx` and cleanly built frontend.
### 8. Bug Fix - "Request More Seats" Popup Using Wrong Value (June 25, 2026)

- **Issue**: The "Request More Seats" modal displayed `seats_requested` (e.g. 10) instead of the actual currently approved maximum capacity (`max_employee_capacity`, e.g. 55) in the read-only Current Seats Capacity field, and defaulted the requested upgrade field incorrectly.
- **Fixes**:
  1. **Backend Validation Message**: In [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py#L62-L67), updated the HTTP 400 validation error message returned when requesting <= current approved capacity to match format: `f"Requested capacity must be greater than current approved capacity ({company.max_employee_capacity})."`.
  2. **Frontend Dialog Bindings**: In [CorporateDashboard.tsx](file:///e:/1/src/pages/CorporateDashboard.tsx#L842-L856), updated the Current Seats Capacity input to display `companyInfo.max_employee_capacity` (read-only), set the minimum value of requested seats input to `companyInfo.max_employee_capacity + 1`, and updated `openRequestSeatsModal` to default the input state to `companyInfo.max_employee_capacity + 1`.
  3. **Frontend Validation and Toast**: Added client-side validation in `submitSeatsRequest` rejecting any inputs less than or equal to current approved capacity and displaying a toast alert with the exact expected message.
  4. **Corporate Dashboard Capacity Audit**: Audited `CorporateDashboard.tsx` to verify that approved seats, available seats, and remaining seats stats cards calculate their values strictly from `max_employee_capacity` and never use `seats_requested` before Superuser approval.
- **Verification**:
  - Wrote and executed [verify_all_requirements.py](file:///e:/1/scratch/verify_all_requirements.py) which verified:
    - Initial dashboard stats with capacity 55 and 3 employees.
    - Rejection of invalid upgrade requests (<= 55) with exact error message `"Requested capacity must be greater than current approved capacity (55)."`.
    - Dashboard stats before approval (retains 55 seats capacity and 52 available seats).
    - Superuser approval of the seat request to 60.
    - Updated dashboard stats after approval (60 seats capacity, 3 employees, 57 available seats).
  - Built images and restarted Docker containers successfully.

### 9. Complete Registration Validation & Data Integrity (June 25, 2026)

- **Backend Format Validation**: Swapped Pydantic's `EmailStr` schema types for standard `str` to handle custom route-level format validation rules for Name, Company Name, Email, Phone, Password, Aadhaar, PAN, GST, and Pincode in [validators.py](file:///e:/1/backend/app/api/validators.py). Changed parameter types of validators to `Optional[str]` to prevent type checking failures with optional fields.
- **Backend Duplicate Checking**: Integrated validation rules and duplicate checks in `/auth/register` ([auth.py](file:///e:/1/backend/app/api/v1/endpoints/auth.py)), POST `/users/` ([users.py](file:///e:/1/backend/app/api/v1/endpoints/users.py)), and POST `/companies/register` ([companies.py](file:///e:/1/backend/app/api/v1/endpoints/companies.py)) endpoints.
- **Frontend Customer Registration Wizard**:
  - Moved Mobile Number to Step 1.
  - Implemented detailed inline validations for all pages in [Register.tsx](file:///e:/1/src/pages/Register.tsx), highlighting invalid inputs with red borders and showing custom error texts inline.
  - Programmatically focuses the first invalid field and preserves previously entered data.
- **Frontend Corporate Registration Wizard**:
  - Implemented identical inline error state handling, red borders, first-error programmatical focusing, and dynamic error clearing in [CompanyRegister.tsx](file:///e:/1/src/pages/CompanyRegister.tsx).
  - Enforced correct format validations for GST, Address Pincode, Capacity Limits, and File uploads.
- **Verification**:
  - Created [test_validators_manual.py](file:///e:/1/backend/test_validators_manual.py) to check that all validator functions properly raise `HTTPException(400)` for invalid inputs. All 10 validator tests passed successfully.
  - Rebuilt and restarted the Docker containers successfully.

- **Dynamic Document Camera Photo Capture Support (June 25, 2026)**:
  - Modified [CompanyRegister.tsx](file:///e:/1/src/pages/CompanyRegister.tsx) step 5 (Document Upload) to include both **Upload File** and **Take Photo** choice buttons for every dynamic document uploaded.
  - Integrates the existing `CameraModal` (imported from `@/components/ui/camera-modal`) to let corporate admins snap photos of their documents via webcam directly.
  - Successfully compiled the production React bundle and redeployed both frontend and backend Docker containers.

- **Customer Photo Display inside Dialogs Fix (June 25, 2026)**:
  - **Issue**: Clicking "View Photo" inside the customer registration details dialog on the Admin and Superuser approvals dashboards showed a broken image icon. This occurred because it directly fetched the protected `/storage/...` path without the required JWT auth token.
  - **Fixes**:
    1. Modified [SuperuserDashboard.tsx](file:///e:/1/src/pages/SuperuserDashboard.tsx) (line 1628) to call `ImageModal` directly instead of the custom wrapper (which returned unauthorized API endpoints). Passed the required `bucket="customer-photos"` and `isStoragePath` flags.
    2. Modified [AdminDashboard.tsx](file:///e:/1/src/pages/AdminDashboard.tsx) (line 1361) to pass `bucket="customer-photos"` and `isStoragePath` directly to `ImageModal`.
    3. Enforced file retrieval through the `ImageModal` component's built-in authorized fetch mechanism.
  - Rebuilt production assets and restarted Docker containers successfully.

- **Company Registered Address Update (June 25, 2026)**:
  - Modified [CompanyRegister.tsx](file:///e:/1/src/pages/CompanyRegister.tsx) to use the term "Registered Address" and "Company Registered Address" instead of plain "Address" / "Company Address":
    - Updated Step 3 header from `"Company Address"` to `"Company Registered Address"`.
    - Updated address input label to `"Registered Address *"`.
    - Updated address input placeholder to `"Enter registered address"`.
  - Modified [companies.py](file:///e:/1/backend/app/api/v1/endpoints/companies.py) backend error message for missing address validation to say `"Company Registered Address is required."`.
  - Successfully verified TypeScript compilation (`npx tsc --noEmit`) and built the React code assets, followed by rebuilding and restarting the backend and frontend Docker containers.

- **Activity Tab Fix (June 25, 2026)**:
  - **Issue**: The Activity tab was not displaying logs. This occurred because `uniqueActivityLogs` mapping in the frontend [ActivityTabComponent.tsx](file:///e:/1/src/components/ActivityTabComponent.tsx) attempted to parse ISO strings using `.split('T')` on the `created_at` property. When backend timestamps are space-separated strings or not in strict ISO format, this caused the frontend execution to fail.
  - **Fixes**:
    1. Robust date parsing helper was added to extract date portions from strings, date objects, and fallback types safely without crashing.
    2. Enforced default empty array fallback for `activityLogs` props.
    3. Added null-safety checks across `formatAction`, `getActionBadge`, `renderDetails`, and `formatTimeAgo` methods inside [ActivityTabComponent.tsx](file:///e:/1/src/components/ActivityTabComponent.tsx).
  - Built production assets and restarted Docker containers successfully.

- **Corporate Company Deletion by Superuser (June 25, 2026)**:
  - **Feature**: Allowed Superusers to permanently delete a corporate organization from the workspace management dashboard.
  - **Backend Implementation**:
    - Created the `DELETE /api/v1/companies/{company_id}` route in [companies.py](file:///e:/1/backend/app/api/v1/endpoints/companies.py).
    - When a company is deleted:
      - All company administrator credentials/auth entries (`AuthUser`) are cleaned up.
      - Cascade rules clear out `CompanyAdmin` entries.
      - Employees (`User`) linked to the company have their `company_id` set to `NULL` (FK `ondelete="SET NULL"`).
      - An `ActivityLog` entry is written with action `"company_deleted"`.
  - **Frontend Implementation**:
    - Added `deleteCompany` API call in [corporateService.ts](file:///e:/1/src/services/corporateService.ts).
    - Integrated a **Delete Company** button next to each active organization on the [ApprovedOrganizationsTab.tsx](file:///e:/1/src/components/ApprovedOrganizationsTab.tsx) panel.
    - Prompts a confirmation dialog before initiating the API call.
  - **Verification**:
    - Created and executed a python integration test [test_company_delete.py](file:///e:/1/scratch/test_company_delete.py) verifying cascade delete rules and employee unlinking. Test passed successfully.
    - Rebuilt frontend code and redeployed backend/frontend Docker services successfully.

- **Activated Suspend, Activate, and Delete Corporate Actions (June 25, 2026)**:
  - **Issue**: In the Superuser Dashboard's "Approved Companies" list table, the **Suspend** and **Activate** buttons were disabled placeholders, and the **Delete Company** button was missing.
  - **Backend Updates**:
    - Implemented `PUT /api/v1/companies/{company_id}/suspend` and `PUT /api/v1/companies/{company_id}/activate` routes in [companies.py](file:///e:/1/backend/app/api/v1/endpoints/companies.py).
    - When suspended, sets company status to `"suspended"` and posts custom notification to company admins.
    - When activated, sets company status to `"approved"` and posts custom notification to company admins.
    - Writes `company_suspended` and `company_activated` audit logs to `ActivityLog`.
  - **Frontend Updates**:
    - Added `suspendCompany` and `activateCompany` API handlers to [corporateService.ts](file:///e:/1/src/services/corporateService.ts).
    - Modified [OrganizationApprovalTab.tsx](file:///e:/1/src/components/OrganizationApprovalTab.tsx) to fetch both `"approved"` and `"suspended"` company records into `approvedCompanies` list.
    - Replaced disabled buttons with dynamic **Suspend** / **Activate** triggers according to current company status, and added a **Delete** button with confirmation checks.
    - Rendered distinct status badges for `"Suspended"` vs `"Approved"` states.
  - Rebuilt production assets and restarted Docker containers successfully.

- **Admin Meetings Tab Layout Height and Scroll Fix (June 26, 2026)**:
  - **Issue**: The meetings list under the "Meetings" tab extended indefinitely when multiple items were present. Due to grid row stretching, this expanded the parent dashboard viewport and caused the left-hand Meeting Calendar card to stretch unnaturally, leaving large empty blank spaces at the bottom.
  - **Fixes**:
    1. **Fixed Size Capping**: Configured the right-hand column container in [AdminMeetingsTab.tsx](file:///e:/1/src/components/AdminMeetingsTab.tsx) to have a fixed height matching `h-[500px] lg:h-[calc(100vh-280px)] lg:min-h-[500px] lg:max-h-[700px]`.
    2. **Inner Scrolling Container**: Updated the main `Tabs` component to use flexbox layout and `min-h-0`. Set each of the five `TabsContent` panes (`pending`, `approved`, `rejected`, `cancelled`, `history`) to use `className="flex-1 overflow-y-auto pr-2 min-h-0"` so meetings scroll internally within the column.
    3. **Calendar Stretching Grid Day Cells**: In [MeetingCalendar.tsx](file:///e:/1/src/components/MeetingCalendar.tsx), replaced the static `h-11` day cell classes with `h-full min-h-[2.75rem]` so that whenever the calendar card is stretched to match the right column height, the calendar cells stretch proportionally and evenly fill the entire calendar grid card.
  - **Verification**:
    - Recompiled production frontend assets using `npm run build`.
    - Redeployed the Docker compose stack using `docker compose up --build -d`.
    - Checked all dashboard components for visual styling.

- **Admin Meetings Search OR Filter & Calendar Toggling (June 26, 2026)**:
  - **Issue 1**: The search input did not fetch results correctly because the backend queried `search_company` and `search_title` using an `AND` operation, forcing a search term to match BOTH the company name and the meeting title.
  - **Issue 2**: Once a calendar date was selected, the user had no way to deselect it or click outside to view meetings for all dates.
  - **Fixes**:
    1. **Search OR Filtering**: Updated [meetings.py](file:///e:/1/backend/app/api/v1/endpoints/meetings.py) search filters to combine `search_title` and `search_company` using an `or_` clause, making search queries match either the company name OR the meeting title.
    2. **Calendar Date Deselection**: Updated [MeetingCalendar.tsx](file:///e:/1/src/components/MeetingCalendar.tsx) day cell click handlers to toggle selected state (clicking a selected day clears it). Added a click handler to the days grid wrapper (stopping propagation on active cells) to clear the date filter when clicking any empty cell/border space.
    3. **Clear Date Badge/Button**: Added a "Clear Date" button in [AdminMeetingsTab.tsx](file:///e:/1/src/components/AdminMeetingsTab.tsx) right next to the search bar when a date filter is active, showing the active date and letting users clear it with a single click.
  - **Verification**:
    - Recompiled production frontend bundle successfully.
    - Redeployed the Docker Compose containers and confirmed services are active.

- **Removal of Department & Notes Form Fields (June 26, 2026)**:
  - **Issue**: The corporate meeting room request dialog contained fields for Department and Notes which are no longer needed.
  - **Fixes**:
    1. **Frontend Dialog Changes**: In [CorporateDashboard.tsx](file:///e:/1/src/pages/CorporateDashboard.tsx), removed both the Department input field and the Notes input field. Reconfigured the Participants input field to be full-width since it is no longer in a 2-column layout with the Department field.
    2. **Submission Validation Changes**: Removed the frontend validation check for `bookingForm.department` inside the `handleBookingSubmit` handler so bookings can be submitted without setting a department.
  - **Verification**:
    - Compiled and built frontend bundle successfully.
    - Restarted Docker compose containers.

- **Current Ongoing Slot Booking Support (June 26, 2026)**:
  - **Issue**: Attempting to book the current ongoing time slot (e.g. 17:00 - 18:00 when the time is 17:18) displayed a `"You cannot book a meeting in a timed out slot."` error. This happened because the frontend overlap validator checked if `requestedStart < now` (the slot start time) rather than `requestedEnd < now` (the slot end time).
  - **Fixes**:
    1. **Slot Timeout Calculation**: Updated `checkDialogOverlap` in [CorporateDashboard.tsx](file:///e:/1/src/pages/CorporateDashboard.tsx) to compare the slot end time (`requestedEnd`) against the current timestamp, matching the grid status indicator logic.
  - **Verification**:
    - Compiled frontend assets successfully and restarted Docker containers.

- **Modernization of SQLAlchemy Models & Variable Shadowing Resolution (July 2026)**:
  - **Issue 1**: Type checking errors occurred when assigning Python types (like `str` or `bool`) to ORM instance attributes (e.g., `employee.emergency_contact_name`) because legacy SQLAlchemy 1.x `Column` fields were type-inferred by Pyright as raw `Column` objects rather than their underlying Python value types.
  - **Issue 2**: Inside the `get_attendance` endpoint in [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py), a local loop variable named `status` shadowed FastAPI's `status` module import, causing Pyright to flag `status` as unbound when referencing `status.HTTP_502_BAD_GATEWAY`.
  - **Fixes**:
    1. **SQLAlchemy 2.0 Modernization**: Upgraded model attributes from `Column(...)` to SQLAlchemy 2.x type mappings (`Mapped[T] = mapped_column(...)`) across [user.py](file:///e:/1/backend/app/models/user.py), [company.py](file:///e:/1/backend/app/models/company.py), [meeting.py](file:///e:/1/backend/app/models/meeting.py), [business.py](file:///e:/1/backend/app/models/business.py), and [audit.py](file:///e:/1/backend/app/models/audit.py).
    2. **Avoid Circular Imports in Type Checker**: Used `TYPE_CHECKING` conditional imports in the models to ensure correct type resolution without introducing runtime circular dependencies.
    3. **FastAPI Status Shadowing Fix**: Renamed the imported `status` module from `fastapi` to `fastapi_status` inside [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py) and renamed the local variable in `get_attendance` to `attendance_status` to prevent scope collisions.
  - **Verification**:
    - Ran Pyright on the entire backend codebase and verified that all 77 model-related type errors and local variable shadowing warnings are resolved.
    - Successfully ran the manual validator unit tests (`python backend/test_validators_manual.py`).

- **Billing Period Calculation Correction for Daily and Weekly Invoices (July 2026)**:
  - **Issue**: Manual invoices and automatic company invoices generated for daily/weekly plans incorrectly defaulted to a 30-day (monthly) billing period (e.g. `1/7/2026 to 31/7/2026`).
  - **Fixes**:
    - Updated `sync_company_invoices` in [invoices.py](file:///e:/1/backend/app/api/v1/endpoints/invoices.py#L156) to handle daily and weekly billing frequencies. Daily plans generate invoices per single day and weekly plans generate them every 7 days.
    - Updated `create_manual_invoice` in [invoices.py](file:///e:/1/backend/app/api/v1/endpoints/invoices.py#L836) to dynamically set the `billing_end_date` based on the requested `billing_type` (1 day for daily, 7 days/`timedelta(days=6)` for weekly, and end-of-month for monthly).
    - Updated seat upgrade invoice endpoints in [finance.py](file:///e:/1/backend/app/api/v1/endpoints/finance.py#L870) and [company_admin.py](file:///e:/1/backend/app/api/v1/endpoints/company_admin.py#L275) to dynamically set the billing end date according to the active plan's billing type.
  - **Verification**:
    - Verified backend starts successfully and all related integration tests (`test_approve_unpaid.py` and `test_pricing_endpoints.py`) complete cleanly.




