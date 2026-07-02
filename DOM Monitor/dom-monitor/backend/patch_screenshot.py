import re

with open('worker.py', 'r', encoding='utf-8') as f:
    content = f.read()

to_replace = """                            try:
                                page.screenshot(path=raw_page_path_absolute, full_page=True)
                                monitor.last_page_screenshot_path = f"screenshots/{monitor.id}/{raw_page_filename}"
                            except Exception as se:
                                print(f"Failed to capture baseline page screenshot: {se}")"""

new_content = """                            try:
                                print("Taking baseline full page screenshot...")
                                page.screenshot(path=raw_page_path_absolute, full_page=False)
                                monitor.last_page_screenshot_path = f"screenshots/{monitor.id}/{raw_page_filename}"
                                print("Screenshot taken successfully.")
                            except Exception as se:
                                print(f"Failed to capture baseline page screenshot: {se}")"""

if to_replace in content:
    content = content.replace(to_replace, new_content)
    print("Patched full_page=False")
else:
    print("Not found")
    
# Change the other full_page=True in change detection
to_replace2 = """                            try:
                                page.screenshot(path=current_raw_page_path_absolute, full_page=True)
                                current_raw_page_path_relative = f"screenshots/{monitor.id}/{current_raw_page_filename}"
                                if DEBUG_MODE:
                                    print("[OK] Page screenshot saved")
                            except Exception as se:"""

new_content2 = """                            try:
                                page.screenshot(path=current_raw_page_path_absolute, full_page=False)
                                current_raw_page_path_relative = f"screenshots/{monitor.id}/{current_raw_page_filename}"
                                if DEBUG_MODE:
                                    print("[OK] Page screenshot saved")
                            except Exception as se:"""

if to_replace2 in content:
    content = content.replace(to_replace2, new_content2)
    print("Patched second full_page=False")
    
with open('worker.py', 'w', encoding='utf-8') as f:
    f.write(content)
