import os
import shutil

with open('e:/2/dom-monitor/backend/worker.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update extract_table_structure
content = content.replace("""                        box: {
                            x: rowRect.left + window.scrollX,
                            y: rowRect.top + window.scrollY,
                            width: rowRect.width,
                            height: rowRect.height
                        },
                        cell_boxes: cellBoxes""", """                        box: {
                            x: rowRect.left + window.scrollX,
                            y: rowRect.top + window.scrollY,
                            width: rowRect.width,
                            height: rowRect.height
                        },
                        element_box: {
                            x: rowRect.left - el.getBoundingClientRect().left,
                            y: rowRect.top - el.getBoundingClientRect().top,
                            width: rowRect.width,
                            height: rowRect.height
                        },
                        cell_boxes: cellBoxes""")

content = content.replace("""                        cellBoxes.push({
                            x: cellRect.left + window.scrollX,
                            y: cellRect.top + window.scrollY,
                            width: cellRect.width,
                            height: cellRect.height
                        });""", """                        cellBoxes.push({
                            x: cellRect.left + window.scrollX,
                            y: cellRect.top + window.scrollY,
                            width: cellRect.width,
                            height: cellRect.height,
                            element_box: {
                                x: cellRect.left - el.getBoundingClientRect().left,
                                y: cellRect.top - el.getBoundingClientRect().top,
                                width: cellRect.width,
                                height: cellRect.height
                            }
                        });""")


# 2. Update get_recalculated_row_coordinates and scroll_to_row_and_get_coords
content = content.replace("""                        return {
                            x: cellRect.left + window.scrollX,
                            y: cellRect.top + window.scrollY,
                            width: cellRect.width,
                            height: cellRect.height
                        };""", """                        return {
                            x: cellRect.left + window.scrollX,
                            y: cellRect.top + window.scrollY,
                            width: cellRect.width,
                            height: cellRect.height,
                            element_box: {
                                x: cellRect.left - el.getBoundingClientRect().left,
                                y: cellRect.top - el.getBoundingClientRect().top,
                                width: cellRect.width,
                                height: cellRect.height
                            }
                        };""")

content = content.replace("""                    return {
                        box: {
                            x: rect.left + window.scrollX,
                            y: rect.top + window.scrollY,
                            width: rect.width,
                            height: rect.height
                        },
                        cell_boxes: cellBoxes
                    };""", """                    return {
                        box: {
                            x: rect.left + window.scrollX,
                            y: rect.top + window.scrollY,
                            width: rect.width,
                            height: rect.height
                        },
                        element_box: {
                            x: rect.left - el.getBoundingClientRect().left,
                            y: rect.top - el.getBoundingClientRect().top,
                            width: rect.width,
                            height: rect.height
                        },
                        cell_boxes: cellBoxes
                    };""")

old_el_annot_code = """                                # 4.5 Generate Old Element Screenshot
                                old_element_relative = None
                                if monitor.last_element_screenshot_path:
                                    old_element_filename = f"{timestamp_str}_old_element.png"
                                    old_element_path_absolute = os.path.join(screenshot_dir, old_element_filename)
                                    old_el_source_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                    if os.path.exists(old_el_source_abs):
                                        shutil.copy(old_el_source_abs, old_element_path_absolute)
                                        old_element_relative = f"screenshots/{monitor.id}/{old_element_filename}"
                                        
                                        try:
                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_element_path_absolute)
                                            draw = ImageDraw.Draw(img)
                                            drawn_any = False
                                            
                                            table_x = min([r.get("box", {}).get("x", 0) for r in old_table.get("rows", []) if r.get("box")], default=0)
                                            table_y = min([r.get("box", {}).get("y", 0) for r in old_table.get("rows", []) if r.get("box")], default=0) - 40
                                            
                                            for r_key in diff_result["removed_keys"]:
                                                if r_key in old_by_key:
                                                    r_box = old_by_key[r_key].get("box")
                                                    eb = old_by_key[r_key].get("element_box")
                                                    if eb:
                                                        rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                    elif r_box:
                                                        rx, ry, rw, rh = max(0, r_box['x'] - table_x), max(0, r_box['y'] - table_y), r_box['width'], r_box['height']
                                                    else:
                                                        continue
                                                    draw.rectangle([rx, ry, rx + rw, ry + rh], outline="red", width=4)
                                                    drawn_any = True
                                            if drawn_any:
                                                img.save(old_element_path_absolute)
                                        except Exception as draw_err:
                                            print(f"[TABLE WARNING] Old element coordinate drawing failed: {draw_err}")
"""

content = content.replace("""                                # 4.5 Generate Old Element Screenshot
                                old_element_relative = None
                                if monitor.last_element_screenshot_path:
                                    old_element_filename = f"{timestamp_str}_old_element.png"
                                    old_element_path_absolute = os.path.join(screenshot_dir, old_element_filename)
                                    old_el_source_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                    if os.path.exists(old_el_source_abs):
                                        shutil.copy(old_el_source_abs, old_element_path_absolute)
                                        old_element_relative = f"screenshots/{monitor.id}/{old_element_filename}"
""", old_el_annot_code)

new_el_annot_code = """                                # 4.6 Annotate New Element Screenshot
                                if current_raw_element_path_relative:
                                    try:
                                        from PIL import Image, ImageDraw
                                        img = Image.open(current_raw_element_path_absolute)
                                        draw = ImageDraw.Draw(img)
                                        drawn_any = False
                                        
                                        if coords and target_key:
                                            if change_type == "added":
                                                a_box = coords.get("element_box")
                                                if a_box:
                                                    ax, ay, aw, ah = a_box['x'], a_box['y'], a_box['width'], a_box['height']
                                                    draw.rectangle([ax, ay, ax + aw, ay + ah], outline="green", width=4)
                                                    drawn_any = True
                                            elif change_type == "modified":
                                                detail = next((d for d in diff_result["modified_details"] if d["key"] == target_key), None)
                                                m_box = coords.get("element_box")
                                                m_cell_boxes = coords.get("cell_boxes", [])
                                                
                                                cell_drawn = False
                                                if detail and m_cell_boxes:
                                                    for ch in detail.get("changes", []):
                                                        c_idx = ch.get("index")
                                                        if c_idx is not None and c_idx < len(m_cell_boxes):
                                                            c_box = m_cell_boxes[c_idx].get("element_box")
                                                            if c_box:
                                                                cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                                draw.rectangle([cx, cy, cx + cw, cy + ch_h], outline="yellow", width=4)
                                                                cell_drawn = True
                                                                drawn_any = True
                                                if not cell_drawn and m_box:
                                                    mx, my, mw, mh = m_box['x'], m_box['y'], m_box['width'], m_box['height']
                                                    draw.rectangle([mx, my, mx + mw, my + mh], outline="yellow", width=4)
                                                    drawn_any = True
                                                    
                                        if drawn_any:
                                            img.save(current_raw_element_path_absolute)
                                    except Exception as draw_err:
                                        print(f"[TABLE WARNING] New element coordinate drawing failed: {draw_err}")
                                        
                                # 5. Create diff summary JSON for dashboard"""

content = content.replace("                                # 5. Create diff summary JSON for dashboard", new_el_annot_code)

with open('e:/2/dom-monitor/backend/worker.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
