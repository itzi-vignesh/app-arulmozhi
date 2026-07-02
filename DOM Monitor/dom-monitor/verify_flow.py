# Configure sys.stdout to handle UTF-8 symbols (like currency ₹) on Windows consoles
import os
import sys
import time
import threading
import requests
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
from datetime import datetime
import traceback
import sqlite3

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# 1. Mock Web Store HTTP Server
class MockStoreHandler(SimpleHTTPRequestHandler):
    price_index = 0
    image_check_count = 0
    # Steps to verify:
    # 0. Initial load: ₹54999 (matches registration)
    # 1. Second check: ₹52999 (price drops -> numeric change)
    # 2. Third check: No Stock (mixed change)
    prices = ["₹54999", "₹52999", "No Stock"]
    
    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            
            # Fetch current mock store price
            current_price = MockStoreHandler.prices[MockStoreHandler.price_index]
            # Advance price index for next client requests
            if MockStoreHandler.price_index < len(MockStoreHandler.prices) - 1:
                MockStoreHandler.price_index += 1
                
            html = f"""
            <!DOCTYPE html>
            <html>
            <head><title>Mock iPhone Store</title></head>
            <body>
              <h1>Apple iPhone 17 Pro Max</h1>
              <div id="price">{current_price}</div>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        elif self.path == "/missing":
            # Serve page without the selector to verify failure logs
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head><title>Mock Store Sold Out</title></head>
            <body>
              <h1>All Products Sold Out!</h1>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        elif self.path == "/popup-success-click":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head><title>Success Popup Page</title></head>
            <body>
              <div id="modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center;">
                <div style="background:white; padding:20px; color:black;">
                  <h2>Cookie Consent</h2>
                  <button id="close-btn" onclick="dismissModal()">Got It</button>
                </div>
              </div>
              <h1>Apple iPhone 17 Pro Max</h1>
              <div id="price" style="display:none; width:100px; height:30px;">₹54999</div>
              <script>
                function dismissModal() {
                  document.getElementById('modal').style.display = 'none';
                  document.getElementById('price').style.display = 'block';
                }
              </script>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        elif self.path == "/popup-success-escape":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head><title>Success Popup Page</title></head>
            <body>
              <div id="modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center;">
                <div style="background:white; padding:20px; color:black;">
                  <h2>Cookie Consent</h2>
                  <p>Press ESC to close.</p>
                </div>
              </div>
              <h1>Apple iPhone 17 Pro Max</h1>
              <div id="price" style="display:none; width:100px; height:30px;">₹54999</div>
              <script>
                window.addEventListener('keydown', function(e) {
                  if (e.key === 'Escape') {
                    dismissModal();
                  }
                });
                function dismissModal() {
                  document.getElementById('modal').style.display = 'none';
                  document.getElementById('price').style.display = 'block';
                }
              </script>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        elif self.path == "/popup-failure":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head><title>Failure Popup Page</title></head>
            <body>
              <div id="modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center;">
                <div style="background:white; padding:20px; color:black;">
                  <h2>Persistent Overlay Modal</h2>
                  <p>Cannot close me!</p>
                </div>
              </div>
              <h1>Apple iPhone 17 Pro Max</h1>
              <div id="price" style="display:none; width:100px; height:30px;">₹54999</div>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        elif self.path == "/image-check":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            
            img_src = "product_v1.jpg" if MockStoreHandler.image_check_count == 0 else "product_v2.jpg"
            MockStoreHandler.image_check_count += 1
            
            html = f"""
            <!DOCTYPE html>
            <html>
            <head><title>Mock Image Store</title></head>
            <body>
              <h1>Product Image</h1>
              <img id="product" src="{img_src}">
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run_mock_server():
    server = HTTPServer(("127.0.0.1", 8001), MockStoreHandler)
    print("Mock Store HTTP Server started on http://127.0.0.1:8001")
    server.serve_forever()

# Start mock server in daemon thread
t = threading.Thread(target=run_mock_server, daemon=True)
t.start()

# Wait for mock server to bind to port
time.sleep(1)

# Set common environment variable for DB path so uvicorn and worker share same DB file
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(script_dir, "backend")
db_path = os.path.join(backend_dir, "dom_monitor.db")
screenshots_dir = os.path.join(backend_dir, "screenshots")

# Set common environment variable for DB path so uvicorn and worker share same DB file
abs_db_path = os.path.abspath(db_path)
os.environ["DATABASE_URL"] = f"sqlite:///{abs_db_path}"

# 2. Reset database and run FastAPI
if os.path.exists(db_path):
    os.remove(db_path)
    print("Cleaned existing test SQLite database.")

# Ensure screenshots directories from previous tests are cleared
if os.path.exists(screenshots_dir):
    import shutil
    shutil.rmtree(screenshots_dir)
    print("Cleaned screenshots folder.")

# Explicitly initialize tables in test process so worker imports work
sys.path.insert(0, backend_dir)
from backend.database import engine, Base
Base.metadata.create_all(bind=engine)
print("Database schema created in test process database.")

print("Launching FastAPI application...")
fastapi_process = subprocess.Popen(
    ["uvicorn", "main:app", "--port", "8000", "--host", "127.0.0.1"],
    cwd=backend_dir,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Wait for FastAPI server startup
time.sleep(3)

try:
    # 3. Simulate Extension Monitor Registration
    print("Testing API: POST /api/monitor/register")
    reg_url = "http://127.0.0.1:8000/api/monitor/register"
    reg_payload = {
        "name": "Amazon Price Check",
        "url": "http://127.0.0.1:8001/",
        "page_title": "Mock iPhone Store",
        "selector": "#price",
        "tag": "DIV",
        "initial_value": "₹54999",
        "text_snapshot": "₹54999",
        "selector_confidence": "HIGH",
        "monitor_mode": "server"
    }
    r = requests.post(reg_url, json=reg_payload)
    print("Response Status:", r.status_code)
    print("Response JSON:", r.json())
    assert r.status_code == 201
    monitor_id = r.json()["id"]

    # 4. Trigger worker check manually
    sys.path.insert(0, backend_dir)
    from backend.worker import check_monitors
    
    print("\n--- Running Worker Check 1 (Value unchanged) ---")
    # First browser run: extracts "₹54999" (matches initial_value)
    check_monitors()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT last_value, status, selector_confidence FROM monitors WHERE id = ?", (monitor_id,))
    mon_row = cursor.fetchone()
    print("Monitor State in DB:", mon_row)
    assert mon_row[0] == "₹54999"
    assert mon_row[1] == "active"
    assert mon_row[2] == "HIGH"
    
    cursor.execute("SELECT COUNT(*) FROM change_events")
    event_count = cursor.fetchone()[0]
    print("Change events in DB:", event_count)
    assert event_count == 0  # Deduplication success: no events logged
    
    print("\n--- Running Worker Check 2 (Value changed: numeric) ---")
    # Make the monitor due again immediately in the database
    from datetime import timedelta
    cursor.execute(
        "UPDATE monitors SET next_check_at = ?",
        ((datetime.utcnow() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S.%f"),)
    )
    conn.commit()
    
    # Second browser run: extracts "₹52999"
    check_monitors()
    
    cursor.execute("SELECT last_value, status, last_notified_value FROM monitors WHERE id = ?", (monitor_id,))
    mon_row = cursor.fetchone()
    print("Monitor State in DB:", mon_row)
    assert mon_row[0] == "₹52999"
    
    cursor.execute("SELECT old_value, new_value, change_type, diff_summary, old_page_screenshot_path, new_page_screenshot_path, old_element_screenshot_path, new_element_screenshot_path, changed_fragment FROM change_events")
    events = cursor.fetchall()
    print("Change Events Logged:", events)
    assert len(events) == 1
    assert events[0][0] == "₹54999"
    assert events[0][1] == "₹52999"
    assert events[0][2] == "numeric"
    assert "Difference: -₹2000" in events[0][3]
    
    old_page = events[0][4]
    new_page = events[0][5]
    old_element = events[0][6]
    new_element = events[0][7]
    changed_fragment = events[0][8]
    print("Old Page Screenshot Path:", old_page)
    print("New Page Screenshot Path:", new_page)
    print("Old Element Screenshot Path:", old_element)
    print("New Element Screenshot Path:", new_element)
    print("Changed Fragment:", changed_fragment)
    
    assert old_page is not None
    assert new_page is not None
    assert old_element is not None
    assert new_element is not None
    assert changed_fragment == "₹54999 → ₹52999"
    
    assert os.path.exists(os.path.join(backend_dir, old_page))
    assert os.path.exists(os.path.join(backend_dir, new_page))
    assert os.path.exists(os.path.join(backend_dir, old_element))
    assert os.path.exists(os.path.join(backend_dir, new_element))
    
    # 5. Check notification polling API
    print("\nTesting Notification Polling API: GET /api/monitor/notifications")
    notif_res = requests.get("http://127.0.0.1:8000/api/monitor/notifications")
    print("Poll Status:", notif_res.status_code)
    notifs = notif_res.json()
    print("Poll JSON:", notifs)
    assert len(notifs) == 1
    assert notifs[0]["monitor_name"] == "Amazon Price Check"
    assert notifs[0]["old_value"] == "₹54999"
    assert notifs[0]["new_value"] == "₹52999"
    assert "-₹2000" in notifs[0]["difference"]

    # Verify polling marks notification as sent (polling deduplication check)
    notif_res2 = requests.get("http://127.0.0.1:8000/api/monitor/notifications")
    print("Second Poll JSON (should be empty):", notif_res2.json())
    assert len(notif_res2.json()) == 0

    print("\n--- Running Worker Check 3 (Value changed: mixed text/digits) ---")
    # Make the monitor due again immediately in the database
    cursor.execute(
        "UPDATE monitors SET next_check_at = ?",
        ((datetime.utcnow() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S.%f"),)
    )
    conn.commit()
    
    # Third browser run: extracts "No Stock"
    check_monitors()
    cursor.execute("SELECT new_value, change_type, diff_summary, changed_fragment FROM change_events ORDER BY detected_at DESC LIMIT 1")
    last_event = cursor.fetchone()
    print("New Mixed Event:", last_event)
    assert last_event[0] == "No Stock"
    assert last_event[1] == "mixed"
    assert "Old: ₹52999 | New: No Stock" in last_event[2]
    assert last_event[3] == "₹52999 → No Stock"

    # 6. Test Pause / Resume APIs
    print("\nTesting Pause API: POST /api/monitor/{id}/pause")
    requests.post(f"http://127.0.0.1:8000/api/monitor/{monitor_id}/pause")
    cursor.execute("SELECT status FROM monitors WHERE id = ?", (monitor_id,))
    assert cursor.fetchone()[0] == "paused"

    print("Testing Resume API: POST /api/monitor/{id}/resume")
    requests.post(f"http://127.0.0.1:8000/api/monitor/{monitor_id}/resume")
    cursor.execute("SELECT status FROM monitors WHERE id = ?", (monitor_id,))
    assert cursor.fetchone()[0] == "active"

    # 7. Test Selector Failure Handling
    print("\nTesting Failure Handling...")
    # point url to /missing which doesn't contain #price selector, make due immediately
    cursor.execute(
        "UPDATE monitors SET url = 'http://127.0.0.1:8001/missing', next_check_at = ?", 
        ((datetime.utcnow() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S.%f"),)
    )
    conn.commit()
    
    print("Running Worker Check (target selector #price is missing on page)")
    check_monitors()
    
    cursor.execute("SELECT status, last_error FROM monitors WHERE id = ?", (monitor_id,))
    failed_state = cursor.fetchone()
    print("Failed Monitor State:", failed_state)
    assert failed_state[0] == "failed"
    assert failed_state[1] == "Element not found after page load"

    # Test Success via Click
    print("\n--- Testing Popup Success via Close Button Click ---")
    reg_payload_click = {
        "name": "Popup Click Check",
        "url": "http://127.0.0.1:8001/popup-success-click",
        "page_title": "Success Popup Page",
        "selector": "#price",
        "tag": "DIV",
        "initial_value": "₹54999",
        "text_snapshot": "₹54999",
        "monitor_mode": "server"
    }
    r = requests.post(reg_url, json=reg_payload_click)
    assert r.status_code == 201
    monitor_click_id = r.json()["id"]

    check_monitors()

    cursor.execute("SELECT status, last_page_screenshot_path, last_element_screenshot_path FROM monitors WHERE id = ?", (monitor_click_id,))
    mon_click_row = cursor.fetchone()
    print("Monitor Click State in DB:", mon_click_row)
    assert mon_click_row[0] == "active"
    assert mon_click_row[1] is not None
    assert mon_click_row[2] is not None
    assert os.path.exists(os.path.join(backend_dir, mon_click_row[1]))
    assert os.path.exists(os.path.join(backend_dir, mon_click_row[2]))

    # Test Success via Escape
    print("\n--- Testing Popup Success via Escape Key ---")
    reg_payload_escape = {
        "name": "Popup Escape Check",
        "url": "http://127.0.0.1:8001/popup-success-escape",
        "page_title": "Success Popup Page",
        "selector": "#price",
        "tag": "DIV",
        "initial_value": "₹54999",
        "text_snapshot": "₹54999",
        "monitor_mode": "server"
    }
    r = requests.post(reg_url, json=reg_payload_escape)
    assert r.status_code == 201
    monitor_escape_id = r.json()["id"]

    check_monitors()

    cursor.execute("SELECT status FROM monitors WHERE id = ?", (monitor_escape_id,))
    mon_escape_row = cursor.fetchone()
    print("Monitor Escape State in DB:", mon_escape_row)
    assert mon_escape_row[0] == "active"

    # Test Success via Interaction Replay
    print("\n--- Testing Popup Success via Interaction Steps Replay ---")
    reg_payload_interaction = {
        "name": "Popup Interaction Steps Check",
        "url": "http://127.0.0.1:8001/popup-success-click",
        "page_title": "Success Popup Page",
        "selector": "#price",
        "tag": "DIV",
        "initial_value": "₹54999",
        "text_snapshot": "₹54999",
        "selector_confidence": "MEDIUM",
        "interaction_steps": [
            {
                "type": "click",
                "selector": "#close-btn",
                "text": "Got It"
            }
        ],
        "monitor_mode": "server"
    }
    r = requests.post(reg_url, json=reg_payload_interaction)
    assert r.status_code == 201
    monitor_interaction_id = r.json()["id"]

    check_monitors()

    cursor.execute("SELECT status, selector_confidence, interaction_steps FROM monitors WHERE id = ?", (monitor_interaction_id,))
    mon_interaction_row = cursor.fetchone()
    print("Monitor Interaction State in DB:", mon_interaction_row)
    assert mon_interaction_row[0] == "active"
    assert mon_interaction_row[1] == "MEDIUM"
    assert "Got It" in mon_interaction_row[2]

    # Test Failure
    print("\n--- Testing Popup Failure (Persistent Overlay Modal) ---")
    reg_payload_fail = {
        "name": "Popup Failure Check",
        "url": "http://127.0.0.1:8001/popup-failure",
        "page_title": "Failure Popup Page",
        "selector": "#price",
        "tag": "DIV",
        "initial_value": "₹54999",
        "text_snapshot": "₹54999",
        "monitor_mode": "server"
    }
    r = requests.post(reg_url, json=reg_payload_fail)
    assert r.status_code == 201
    monitor_fail_id = r.json()["id"]

    check_monitors()

    cursor.execute("SELECT status, last_error FROM monitors WHERE id = ?", (monitor_fail_id,))
    mon_fail_row = cursor.fetchone()
    print("Monitor Failure State in DB:", mon_fail_row)
    assert mon_fail_row[0] == "failed"
    assert mon_fail_row[1] == "Element blocked by popup or overlay"

    # Test Image Monitoring
    print("\n--- Testing Image URL Monitoring ---")
    reg_payload_image = {
        "name": "Product Image Check",
        "url": "http://127.0.0.1:8001/image-check",
        "page_title": "Mock Image Store",
        "selector": "#product",
        "tag": "IMG",
        "initial_value": "http://127.0.0.1:8001/product_v1.jpg",
        "text_snapshot": "",
        "monitor_mode": "server",
        "monitor_type": "image",
        "image_url": "http://127.0.0.1:8001/product_v1.jpg"
    }
    r = requests.post(reg_url, json=reg_payload_image)
    assert r.status_code == 201
    monitor_image_id = r.json()["id"]

    # First check: extracts product_v1.jpg. Should match initial_value, so no change event is created
    check_monitors()
    cursor.execute("SELECT last_value, status, monitor_type, image_url FROM monitors WHERE id = ?", (monitor_image_id,))
    mon_image_row = cursor.fetchone()
    print("Monitor Image Check 1 State in DB:", mon_image_row)
    assert mon_image_row[0] == "http://127.0.0.1:8001/product_v1.jpg"
    assert mon_image_row[1] == "active"
    assert mon_image_row[2] == "image"
    assert mon_image_row[3] == "http://127.0.0.1:8001/product_v1.jpg"

    # Make the monitor due again immediately in the database
    cursor.execute(
        "UPDATE monitors SET next_check_at = ?",
        ((datetime.utcnow() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S.%f"),)
    )
    conn.commit()

    # Second check: extracts product_v2.jpg, detecting change
    check_monitors()
    cursor.execute("SELECT last_value FROM monitors WHERE id = ?", (monitor_image_id,))
    assert cursor.fetchone()[0] == "http://127.0.0.1:8001/product_v2.jpg"

    # Check that a ChangeEvent was created with correct fields
    cursor.execute(
        "SELECT old_value, new_value, change_type, diff_summary, changed_fragment FROM change_events WHERE monitor_id = ?",
        (monitor_image_id,)
    )
    img_event = cursor.fetchone()
    print("Image Change Event in DB:", img_event)
    assert img_event is not None
    assert img_event[0] == "http://127.0.0.1:8001/product_v1.jpg"
    assert img_event[1] == "http://127.0.0.1:8001/product_v2.jpg"
    assert img_event[2] == "image"
    assert "Image URL changed" in img_event[3]
    assert "product_v1.jpg" in img_event[3] and "product_v2.jpg" in img_event[3]
    assert img_event[4] == "http://127.0.0.1:8001/product_v1.jpg → http://127.0.0.1:8001/product_v2.jpg"

    conn.close()
    print("\nALL AUTOMATED INTEGRATION TESTS PASSED SUCCESSFULLY!")

except Exception as e:
    print("\nTEST SUITE ERROR / FAILURE:")
    traceback.print_exc()
    sys.exit(1)
finally:
    print("Cleaning up processes...")
    fastapi_process.terminate()
    try:
      fastapi_process.wait(timeout=3)
    except subprocess.TimeoutExpired:
      fastapi_process.kill()
    print("Terminated FastAPI server process.")
