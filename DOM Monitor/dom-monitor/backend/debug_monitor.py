import asyncio
import json
from playwright.sync_api import sync_playwright
import sqlite3

def run():
    conn = sqlite3.connect('./dom_monitor.db')
    c = conn.cursor()
    c.execute("SELECT * FROM monitors WHERE name = 'whole table'")
    monitor = c.fetchone()
    
    if not monitor:
        print("Monitor 'whole table' not found in database.")
        return
        
    columns = [desc[0] for desc in c.description]
    monitor_dict = dict(zip(columns, monitor))
    
    url = monitor_dict['url']
    selector = monitor_dict['selector']
    interaction_steps = monitor_dict['interaction_steps']
    if interaction_steps:
        interaction_steps = json.loads(interaction_steps)
    else:
        interaction_steps = []
        
    print(f"URL: {url}")
    print(f"Selector: {selector}")
    print(f"Interaction steps: {interaction_steps}")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        print("Navigating to URL...")
        page.goto(url, timeout=30000, wait_until="load")
        
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            print("Warning: networkidle timed out.")
            
        print("Replaying interaction steps...")
        replayed_count = 0
        for step in interaction_steps:
            print(f"Replaying step: {step}")
            try:
                page.locator(step['selector']).click()
                replayed_count += 1
            except Exception as e:
                print(f"Click failed: {e}")
            page.wait_for_timeout(1000)
            
        print(f"Replayed {replayed_count} interaction steps.")
        
        locator = page.locator(selector)
        print(f"Locator count for {selector}: {locator.count()}")
        
        if locator.count() > 0:
            print(f"Visibility: {locator.first.is_visible()}")
            print(f"Bounding box: {locator.first.bounding_box()}")
            
            try:
                print("Attempting to scroll into view...")
                locator.first.scroll_into_view_if_needed()
                print("Scroll into view successful.")
            except Exception as e:
                print(f"Exception during scroll_into_view_if_needed: {e}")
                
            page.wait_for_timeout(1000)
            
            box = locator.first.bounding_box()
            is_visible = locator.first.is_visible()
            
            print(f"After scroll - Visibility: {is_visible}")
            print(f"After scroll - Bounding box: {box}")
            
            if box is None or not is_visible:
                print("Element hidden or bounding box is None. Attempting to find blocking element...")
                try:
                    # Find out what is at the center of the viewport, or what is covering the element
                    # If we can't get the box, we can try to evaluate an overlap check in JS.
                    blocking_el = page.evaluate('''
                        (selector) => {
                            const target = document.querySelector(selector);
                            if (!target) return null;
                            const rect = target.getBoundingClientRect();
                            const x = rect.left + rect.width / 2;
                            const y = rect.top + rect.height / 2;
                            let el = document.elementFromPoint(x, y);
                            if (!el || el === target || target.contains(el)) return null;
                            return {
                                tag: el.tagName,
                                id: el.id,
                                classes: el.className,
                                outerHTML: el.outerHTML.substring(0, 300)
                            };
                        }
                    ''', selector)
                    
                    if blocking_el:
                        print("BLOCKING ELEMENT DETAILS:")
                        print(f"Tag: {blocking_el['tag']}")
                        print(f"ID: {blocking_el['id']}")
                        print(f"Classes: {blocking_el['classes']}")
                        print(f"HTML snippet: {blocking_el['outerHTML']}")
                    else:
                        print("Could not definitively identify a single blocking element via elementFromPoint.")
                        
                        # Just look for common overlays
                        overlays = page.evaluate('''
                            () => {
                                const els = Array.from(document.querySelectorAll('*'));
                                return els.filter(el => {
                                    const style = window.getComputedStyle(el);
                                    const z = parseInt(style.zIndex);
                                    return (style.position === 'fixed' || style.position === 'absolute') && 
                                           !isNaN(z) && z > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                                }).map(el => el.tagName + '#' + el.id + '.' + el.className);
                            }
                        ''')
                        print(f"Potential overlays/fixed elements: {overlays}")
                        
                except Exception as eval_e:
                    print(f"Error evaluating blocking element: {eval_e}")
                    
            print("Taking diagnostic screenshot...")
            page.screenshot(path="diagnostic_failure.png", full_page=True)
            print("Saved diagnostic_failure.png")
            
        else:
            print("Element does not exist.")
            
        browser.close()

if __name__ == '__main__':
    run()
