# Nerdshive Coworking Space Operational User Manual

This manual provides detailed guidelines for using the Nerdshive platform. It covers everything from member registration to administrative dashboard operations.

---

## Table of Contents
1. [Introduction to Nerdshive](#1-introduction-to-nerdshive)
2. [Coworker (Customer) Operational Guide](#2-coworker-customer-operational-guide)
3. [Space Administrator Operational Guide](#3-space-administrator-operational-guide)
4. [Superuser Platform Administration Guide](#4-superuser-platform-administration-guide)
5. [User-Level Troubleshooting Guide](#5-user-level-troubleshooting-guide)

---

## 1. Introduction to Nerdshive

Nerdshive is a coworking management platform designed to automate member onboarding, plan bookings, and daily check-ins. 

The platform supports three user roles:
* **Coworkers (Customers)**: Book workspaces, request check-ins at the physical venue, track visit history, and contact support.
* **Space Admins**: Verify registrations, approve check-in requests, confirm payments, and publish announcements.
* **Superusers**: System owners. Have all Admin privileges plus the ability to manage admins and delete records.

---

## 2. Coworker (Customer) Operational Guide

### 1. Account Registration Flow
To join Nerdshive, you must complete our 5-step registration process:
1. **Credentials Selection**: Provide your full name, email address, and choose a secure password (minimum 8 characters).
2. **Personal Profile**: Enter your gender, mobile number, city, address, and occupation.
   * *Organization Settings*: If you need a reimbursement receipt, toggle the **"I need reimbursement"** checkbox and enter your company name, GST registration number, and office location.
3. **Government ID Capture**: Select your ID type (Passport, Voter ID, Driving License, or other) and enter your ID number. Click **"Capture ID Document Photo"** to open your webcam and capture a photo of your physical document.
4. **Selfie Capture**: Click **"Capture Photo"** to take a webcam selfie for identity verification.
5. **Review & Submit**: Review your details and click **"Complete Registration"** to submit your request for approval.

> [!NOTE]
> Newly registered accounts are set to a pending state. You will not be able to log in until an administrator reviews and approves your registration request.

### 2. Workspace Booking (Book Plan)
Once approved, log in and select the **Book Plan** tab:
1. Select a pass type: **Day Pass**, **Weekly Pass**, or **Monthly Pass**. Prices include an automatic 18% GST calculation.
2. Select your start date.
3. Click **"Book Plan"** to submit your booking.

> [!IMPORTANT]
> You cannot book a new plan if you already have an active one. You must wait for your current plan to expire before booking another.

### 3. Accessing the Workspace (Check In/Out)
To access the physical coworking space, select the **Check In/Out** tab:
1. Click **"Request Check-in"** to submit an entry request to reception staff.
2. Once the admin approves your request, your status will update to **"Checked In"**.
3. When leaving, click **"Check Out"** to close your visit log.

> [!WARNING]
> You can only check in once per day. If you check out, you will not be able to check in again until the following day.

### 4. Support Tickets (Query Tab)
If you run into issues, select the **Query** tab:
1. Type your query in the textbox and click **"Submit Query"**.
2. You can track your queries and view admin replies in the **"Your Queries"** history list.

### 5. Workspace Guide, Rules, and Wi-Fi Keys
Select the **Guide** tab to view operational details published by the administrative team:
* **Rules**: Workspace rules and conduct guidelines.
* **Guide**: General details on space facilities and policies.
* **WiFi Info**: Network SSIDs and access keys.

---

## 3. Space Administrator Operational Guide

Admins manage coworker approvals, space check-ins, and support tickets.

### 1. Customer Approvals Flow
1. Open the **Approvals** tab and select the **Customers** sub-tab.
2. Click on a pending user to view their profile, uploaded ID copy, and selfie.
3. Compare the selfie against the ID copy:
   * **Approve**: If they match, click **"Approve"**. The member will be activated and sent an email confirmation.
   * **Reject**: If they do not match, click **"Reject"** and enter a reason in the rejection modal. This will delete the pending registration, allowing the user to sign up again.

### 2. Check-In & Access Approvals
1. When a coworker requests a check-in at reception, their request will appear in the **Check-in Requests** list.
2. Confirm their identity and click **"Approve Check-in"** to grant them access.

### 3. Payment Verification Flow
1. When a coworker books a plan, it will appear in the **Pending Payments** tab.
2. Once you verify their bank transfer or cash payment, click **"Verify Payment"** to activate their booking.

### 4. Support Queries Management
1. Go to the **Queries** tab to view open support tickets.
2. Select a query, enter your response, and click **"Submit Response"**. This will update the ticket status to answered.

### 5. Corporate Bulk Onboarding (CSV Upload)
1. Go to the **Bulk Onboarding** tab.
2. Drag and drop your employee list CSV file.
3. The system maps the headers, validates email and phone formats, and creates the coworker profiles.
4. Click **"Download Seeding Logs"** to get a spreadsheet of generated temporary passwords (formatted as `{Name}{DD}{MM}{YYYY}`) to send to the employees.

---

## 4. Superuser Platform Administration Guide

Superusers manage the system administrators and perform database maintenance.

### 1. Manage Admins
* **Invite Admins**: Enter an email and name, then click **"Invite Admin"** to create an admin account with a temporary password (`temporary_password`).
* **Remove Admins**: Click **"Delete Admin"** next to an administrator's name to revoke their access. You cannot delete your own account.

### 2. System Maintenance
* **Delete Specific Users**: Click **"Delete User"** in a coworker's expanded profile card to permanently remove their records.
* **Bulk Clean DB**: Use the maintenance controls in the Superuser Dashboard to clear old check-in logs or bulk-delete test accounts during system maintenance.

---

## 5. User-Level Troubleshooting Guide

### 1. Registration Failures
* **Error**: `422 Unprocessable Entity` or "Password too short".
  * *Fix*: Ensure your password is at least 8 characters long.
* **Error**: "Invalid Mobile number".
  * *Fix*: Phone numbers must be valid 10-digit Indian numbers starting with 6-9.
* **Error**: "GST Number Invalid".
  * *Fix*: Verify the format matches standard GSTIN patterns (e.g., `22ABCDE1234F1Z5`).

### 2. Login Issues
* **Error**: "Incorrect email or password".
  * *Fix*: Double-check your spelling. If you forgot your password, click **"Forgot Password"** on the login page to request a reset link.
* **Error**: "Account Inactive" / Redirected to `/inactive-user`.
  * *Fix*: Your profile is either pending approval or has been deactivated. Click **"Start Re-registration"** to re-submit your details, ID proof, and selfie for review.

### 3. Webcam Snapshot Errors
* *Symptom*: Camera capture shows a black screen or permissions error.
* *Fix*: Ensure your browser has permission to access your webcam. If you are using a phone, make sure the camera is not blocked by another app.
