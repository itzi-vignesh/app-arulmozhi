# DOM Monitor

DOM Monitor is a production-quality Server-Side Website Change Monitoring Platform (MVP) that allows users to visually select any DOM element on any website using a Chrome Extension and continuously monitor it from the backend, even when their browser is completely closed.

The system detects text mutations, tracks historical changes, calculates diff summaries (numeric, text, or mixed), captures screenshot snapshots of target elements, and triggers browser alerts.

---

## Architecture Overview

```
Chrome Extension Client (Element Picker)
   │
   ├── [POST /api/monitor/register] (Registers target URL, title, selector, value)
   ▼
FastAPI Backend API Server
   │
   ├── [Reads/Writes] ──► SQLite DB (dom_monitor.db)
   ▼
APScheduler Engine
   │
   ├── [Every 60s] ──► Playwright Background Worker (Headless Chromium)
   │                      │
   │                      ├── Load Target Website (NetworkIdle Wait)
   │                      ├── Locate Selector (Visibility Wait)
   │                      ├── Capture Element Screenshot Snapshot
   │                      └── Compare values (Numeric / word-diff SequenceMatcher / Mixed)
   ▼
Change Event Logging & Notification Polling Loop
   │
   └── [GET /api/monitor/notifications] (Chrome Service Worker Polls and triggers OS Notifications)
```

---

## Project Directory Structure

```
dom-monitor/
 ├─ backend/
 │   ├─ routes/
 │   │   └─ monitor.py         # Registration, list, events, & polling endpoints
 │   ├─ templates/
 │   │   └─ dashboard.html     # Interactive status page served by FastAPI
 │   ├─ main.py                # Server entrypoint, CORS, static routes, app lifespan
 │   ├─ database.py            # SQLite database & session configuration
 │   ├─ models.py              # SaaS-ready User, Monitor, and ChangeEvent schemas
 │   ├─ diff_engine.py         # Numeric, text, and mixed difference classification
 │   ├─ worker.py              # Playwright browser-reuse checking task
 │   └─ scheduler.py           # APScheduler initialization & task runner
 ├─ extension/
 │   ├─ icons/
 │   │   ├─ icon16.png         # Generated extension icon (16x16)
 │   │   ├─ icon48.png         # Generated extension icon (48x48)
 │   │   └─ icon128.png        # Generated extension icon (128x128)
 │   ├─ manifest.json          # Manifest V3 extension configuration
 │   ├─ popup.html             # Glassmorphic user configuration popup
 │   ├─ popup.js               # Popup inputs validator and register post
 │   ├─ content.js             # Element hover visual picker and CSS path generator
 │   ├─ background.js          # Alarm background poller triggering OS notifications
 │   ├─ styles.css             # Page injection styles for hover borders & toasts
 │   └─ generate_icons.py      # Pillow script programmatically creating icons
 ├─ screenshots/               # Stored target elements change images (Auto-created)
 ├─ verify_flow.py             # E2E integration test verification suite
 └─ README.md                  # Installation & instruction manual (This file)
```

---

## Technical Specifications

### 1. Multi-User SaaS-Ready Database Schema
- **Users**: String UUID primary key, unique index email.
- **Monitors**: String UUID primary key, user relationship key, url, page title, selector tag, last checked value, deduplicated last notified value, check interval (polling period), status (active, paused, failed), and next check timestamp (`next_check_at`).
- **ChangeEvents**: String UUID primary key, monitor relationship key, old value, new value, change type (numeric, text, mixed), diff summary, absolute element screenshot path, and timestamp.

### 2. Difference Engine
- **Numeric changes**: Detects numerical strings (e.g., prices: `₹54999` -> `₹52999`). Formats output with mathematical adjustments: `Difference: -₹2000`.
- **Text changes**: Computes additions/deletions on words (e.g. `Available` -> `Out of Stock`). Outputs details: `Removed: Available | Added: Out of Stock`.
- **Mixed changes**: Compares hybrid configurations containing alphanumeric variations (e.g. `12 Jobs Found` -> `15 Jobs Found`). Outputs: `Old: 12 Jobs Found | New: 15 Jobs Found`.

### 3. Dynamic Website Handling
- Background worker uses Playwright to launch a headless browser once, reuse pages across active monitors, wait for `"networkidle"` state on navigations, and verify target selector visibility (`locator.wait_for(state="visible", timeout=10000)`) to support async frameworks (React/Vue/Angular).

---

## Installation & Setup

### Prerequisites
- Python 3.10+
- Google Chrome Browser

### Step 1: Install Dependencies
Navigate to the root directory `dom-monitor/` and run:
```bash
pip install fastapi uvicorn sqlalchemy playwright apscheduler requests pillow
```

### Step 2: Install Playwright Browsers
Install the headless Chromium binaries required for Playwright:
```bash
playwright install chromium
```

---

## Running the Application

### 1. Launch the Backend Server
Navigate to the `backend/` directory and spin up the FastAPI service using Uvicorn:
```bash
cd backend
uvicorn main:app --reload --port 8000
```
- **Interactive Dashboard**: Access `http://localhost:8000/` in your browser.
- **Swagger Documentation**: Access `http://localhost:8000/docs`.

### 2. Install the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** in the top-left corner.
4. Select the `dom-monitor/extension/` folder.

---

## Verification & Manual Testing

### Option A: Run the Automated Test Suite
To verify the entire platform integration including uvicorn servers, database creation, difference checks, notification dispatching, and failures:
```bash
python verify_flow.py
```
*(Confirms `ALL AUTOMATED INTEGRATION TESTS PASSED SUCCESSFULLY!`)*

### Option B: Manual Testing Flow
1. Visit a dynamic website (e.g., a news site, product listing page, or run a local HTML page).
2. Click the **DOM Monitor** icon in your Chrome toolbar.
3. Click **Select Element**.
4. Hover over elements (highlighted in cyan dashed boxes) and click one.
5. A toast banner will confirm element selection.
6. Open the extension popup again. Enter a custom name and click **Create Monitor**.
7. Go to `http://localhost:8000/` to view the monitor in the active panel.
8. The backend will check the page content every 60 seconds (or on resume).
9. If changes occur:
   - A desktop OS notification banner will slide in.
   - An event log card with a target element screenshot preview is appended to the dashboard list.
