# DOM Monitor V1.3 - Image Monitoring & UX Walkthrough

This document summarizes the changes made to support tracking image changes (image src and CSS background-image URLs) and the new Immediate Monitor Naming UX with direct auto-registration.

## What Was Accomplished

We implemented the V1.3 features with strict backward compatibility, ensuring existing text monitors continue working without modification.

### 1. Database Schema (`models.py` & `main.py`)
- **`models.py`**: Added `monitor_type` column (String, default `"text"`) and `image_url` column (String, nullable) to the `Monitor` model.
- **`main.py`**: Added automated schema migration checking and execution on lifespan startup. If `monitor_type` or `image_url` columns are missing in SQLite, they are added using `ALTER TABLE` commands.

### 2. Chrome Extension: Image URL Monitoring (`content.js`, `popup.html`, `popup.js`)
- **`content.js`**: Enhanced the selector picker:
  - Added a `detectImageMonitor(element)` helper to identify `<img>` elements or CSS `background-image: url(...)` properties.
  - Automatically resolves relative URLs to absolute URLs relative to the page location.
  - Saves `monitor_type: "image"` and the absolute `image_url` to local storage for image elements, defaulting to `"text"` for standard text elements.
  - Added console logs: `console.log("[IMAGE DETECTED]", absoluteUrl)`.
- **`popup.html`**: Added a metadata card displaying the "Monitor Type" (TEXT or IMAGE).
- **`popup.js`**:
  - Dynamically updates the "Monitor Type" value in the popup UI based on selection metadata retrieved from local storage.
  - Appends `monitor_type` and `image_url` to the POST `/api/monitor/register` payload.
  - Logs the final payload with `console.log("[REGISTER PAYLOAD]", payload)`.

### 3. Chrome Extension: Feature 2 - Immediate Monitor Naming & One-Click Registration UX
- **Naming Dialog Modal (`content.js`)**:
  - Added a custom-styled modal popup that overlay-centers on the client web page immediately upon selecting the target element.
  - The dialog prompts for a Monitor Name, showing the detected `Monitor Type`, and lists clickable suggested names: `Price Monitor`, `Tender Status`, `Stock Value`, and `Image Monitor` (heuristically pre-selected based on content type).
  - Handles `ESC` key to cancel selection, and `Enter` / button clicks to trigger registration.
  - While registration is in progress, the input and action buttons are disabled, showing a `"Creating..."` state, preventing duplicate clicks.
- **One-Click Auto-Registration (`content.js`)**:
  - When the user clicks "Create Monitor" (or presses Enter) in the modal dialog, `content.js` saves the selection details to storage (as a fallback) and immediately submits a `POST` request to `http://localhost:8002/api/monitor/register` via `autoRegisterMonitor`.
  - **On Success**: Shows page toast `"Monitor Created Successfully"`, closes the naming dialog modal, and clears the temporary selection storage cache, keeping `interaction_steps` intact.
  - **On Failure**: Shows page toast `"Failed to Create Monitor"` along with the error description, and keeps the naming dialog open (with buttons re-enabled) so the user can edit or retry. The cached metadata in `chrome.storage.local` is preserved.
  - **Logs Added**:
    - `console.log("[AUTO REGISTER PAYLOAD]", payload)`
    - `console.log("[AUTO REGISTER SUCCESS]", response)`
    - `console.error("[AUTO REGISTER FAILED]", error)`
- **Auto-population (`popup.js`)**:
  - As a fallback/manual path, if the user opens the extension icon, `popup.js` loads the selected name and metadata from storage, including `interaction_steps`, and fills the fields automatically.

### 4. Backend Route & Schema (`monitor.py`)
- **`monitor.py`**:
  - Extended the `MonitorRegister` Pydantic schema with `monitor_type` and `image_url`.
  - Persists both fields on new monitor insert and existing monitor update.
  - Added print logs:
    - `print("[REGISTER] monitor_type =", payload.monitor_type)`
    - `print("[REGISTER] image_url =", payload.image_url)`

### 5. Worker Check Execution Path (`worker.py`)
- **`worker.py`**:
  - Separated the execution check flow: if `monitor_type == "image"`, it runs the new image execution check path, otherwise it runs the original text check logic completely unchanged.
  - Extracts current image source from `<img>` elements or extracts CSS `background-image` paths using regex, resolving relative paths.
  - Creates change events of type `"image"`, setting `diff_summary = f"Image URL changed: {old_url} → {new_url}"`.
  - Adds logging:
    - `print("[IMAGE MODE]")`
    - `print("Old URL:", old_url)`
    - `print("New URL:", current_image_url)`

### 6. Interactive Dashboard (`dashboard.html`)
- **`dashboard.html`**:
  - Added style rule `.change-type-badge.image` to color code image events.
  - Displays the "Monitor Type" and "Baseline Image URL" (if image monitoring) in the monitor details panel metadata grid.
  - Custom-renders image change events under history logs to display Old and New URLs as clickable links.
  - Already natively displays the `Check Interval` in the Monitor Details panel using the model's `check_interval` database value.

### 7. Configurable Check Interval Support (`content.js`, `popup.html`, `popup.js`, `monitor.py`)
- **Naming Dialog Modal (`content.js`)**:
  - Added a new `Check Interval (seconds)` number input field.
  - Attached inline change, blur, and submit events to validate the interval (minimum `10`, maximum `86400`, fallback to `60` on invalid/negative/zero inputs), showing clear inline error messages.
  - Caches `check_interval` in storage and sends it in the auto-register payload.
- **Extension Popup (`popup.html` & `popup.js`)**:
  - Injected the same `Check Interval (seconds)` number input field and a validation error container.
  - Reads the cached check interval from storage on load, populates the input, and runs identical validator fallback/capping rules on click submission.
  - Includes `check_interval` in the manual registration payload.
  - Prints log: `console.log("[CHECK INTERVAL]", checkInterval)`.
- **FastAPI Backend (`monitor.py`)**:
  - Endpoint `/api/monitor/register` extracts, validates, and saves `check_interval`.
  - Enforces `check_interval >= 10` (sets to `10` if smaller) and defaults to `60` if not provided.
  - Logs register input: `print("[REGISTER] check_interval =", check_interval)`.

---

## Validation & Compatibility Status

All features have been reviewed for syntax, import, runtime, and compatibility correctness. 

```text
TEXT Monitoring: PASS
TABLE Monitoring: PASS
IMAGE Monitoring: PASS
Interaction Replay: PASS
Check Interval Configuration: PASS
Dashboard Rendering: PASS
```
