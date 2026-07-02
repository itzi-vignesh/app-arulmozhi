# Tasks

- [x] Database Schema & Lifespan Migrations
  - [x] Modify `models.py` to add `monitor_type` and `image_url` columns
  - [x] Modify `main.py` lifespan to auto-apply SQLite migrations on startup
- [x] Chrome Extension Enhancements & Image URL Monitoring
  - [x] Update `content.js` to detect `<img>` tag and CSS `background-image` URLs, resolve relative URLs, and log `[IMAGE DETECTED]`
  - [x] Modify `popup.html` to add Monitor Type meta card
  - [x] Modify `popup.js` to display Monitor Type and include `monitor_type` / `image_url` in `/api/monitor/register` payload
- [x] Feature 2 - Immediate Monitor Naming UX
  - [x] Implement getSuggestedName and custom styled showNamingModal in `content.js`
  - [x] Intercept target selection to open custom modal popup overlay in client web page DOM
  - [x] Handle ESC/Enter and click bindings to select suggested name or type custom name
  - [x] Pre-populate loaded name in `popup.js` and activate Create Monitor immediately
- [x] Backend API Route Extensions
  - [x] Modify `monitor.py` to extend `MonitorRegister` Pydantic schema and store both fields during registration
- [x] Worker Image Check Execution Path
  - [x] Modify `worker.py` to implement separate `monitor_type == "image"` path reading `src` or `background-image`, resolving absolute URLs, and logging `[IMAGE MODE]` on changes
- [x] Interactive Dashboard Updates
  - [x] Update `dashboard.html` to display image change badges, URL diffs, and clickable debug links
- [x] Integration Testing & Final Validation
  - [x] Add `/image-check` mock endpoints and test routines inside `verify_flow.py`
  - [x] Run all tests and verify both TEXT and IMAGE monitoring pass successfully

- [/] DOM Monitor V1.4 - Structured Table Intelligence
  - [ ] Implement table detection in `content.js`
  - [ ] Implement `extract_table_structure` in `worker.py`
  - [ ] Implement row key resolution and comparison in `worker.py`
  - [ ] Implement precise row-level screenshot highlighting (added/removed/modified) in `worker.py`
  - [ ] Add `.change-type-badge.table` and `renderTableDiff()` in `dashboard.html`
  - [ ] Verify changes without syntax or runtime issues

