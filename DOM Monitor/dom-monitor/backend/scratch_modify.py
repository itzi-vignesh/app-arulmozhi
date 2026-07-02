import os

worker_path = 'worker.py'
with open(worker_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace candidates lists (4 occurrences)
old_candidates = """                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"],
                    ["sr no", "sr_no", "sr. no"],
                    ["serial number", "serial_number", "serial no", "serial_no", "serialnumber"]
                ];"""

new_candidates = """                const sequentialHeaders = [
                    "sno", "s.no", "s.no.", "sn", "s.n", "s.n.", "no", "no.", "index",
                    "slno", "sl.no", "sl.no.", "sl no", "srno", "sr.no", "sr.no.", "sr no", "sr. no",
                    "serial number", "serial no", "serial_no", "serialnumber"
                ];

                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"]
                ];"""

c_count = content.count(old_candidates)
print(f"Found {c_count} occurrences of old_candidates")
content = content.replace(old_candidates, new_candidates)

# 2. Replace key fallback block (4 occurrences)
old_fallback = """                    if (!found && cellTexts.length > 0 && cellTexts[0].trim()) {
                        key = cellTexts[0].trim();
                        found = true;
                    }
                    
                    if (!found) {
                        const rowStr = cellTexts.join("||");
                        let hash = 0;
                        for (let i = 0; i < rowStr.length; i++) {
                            hash = (hash << 5) - hash + rowStr.charCodeAt(i);
                            hash |= 0;
                        }
                        key = Math.abs(hash).toString(16).substring(0, 16);
                    }"""

new_fallback = """                    if (!found) {
                        const stableTexts = [];
                        cellTexts.forEach((text, i) => {
                            const h = norm_headers[i] || "";
                            if (!sequentialHeaders.includes(h)) {
                                stableTexts.push(text);
                            }
                        });
                        if (stableTexts.length === 0) {
                            stableTexts.push(...cellTexts);
                        }
                        const rowStr = stableTexts.join("||");
                        let hash = 0;
                        for (let i = 0; i < rowStr.length; i++) {
                            hash = (hash << 5) - hash + rowStr.charCodeAt(i);
                            hash |= 0;
                        }
                        key = Math.abs(hash).toString(16).substring(0, 16);
                    }"""

f_count = content.count(old_fallback)
print(f"Found {f_count} occurrences of old_fallback")
content = content.replace(old_fallback, new_fallback)

# 3. Replace OLD page screenshot drawing logic
old_page_draw = """                                            # OLD PAGE SCREENSHOT DRAWING RULES:
                                            # 1. Removed Rows -> YELLOW
                                            for r_key in diff_result["removed_keys"]:
                                                if r_key in old_by_key:
                                                    r_box = old_by_key[r_key].get("box")
                                                    if r_box:
                                                        rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                        draw.rectangle([rx, ry, rx + rw, ry + rh], outline="yellow", width=4)
                                                        drawn_any = True
                                            
                                            # 2. Modified Rows/Cells -> RED outline (old location)
                                            for m_key in diff_result["modified_keys"]:
                                                if m_key in old_by_key:
                                                    old_row = old_by_key[m_key]
                                                    detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                                    m_cell_boxes = old_row.get("cell_boxes", [])
                                                    
                                                    cell_drawn = False
                                                    if detail and m_cell_boxes:
                                                        for ch in detail.get("changes", []):
                                                            c_idx = ch.get("index")
                                                            if c_idx is not None and c_idx < len(m_cell_boxes):
                                                                c_box = m_cell_boxes[c_idx]
                                                                cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                                draw.rectangle([cx, cy, cx + cw, cy + ch_h], outline="red", width=4)
                                                                cell_drawn = True
                                                                drawn_any = True
                                                    if not cell_drawn:
                                                        r_box = old_row.get("box")
                                                        if r_box:
                                                            rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                            draw.rectangle([rx, ry, rx + rw, ry + rh], outline="red", width=4)
                                                            drawn_any = True
                                            
                                            # 3. Modified Headers -> RED outline (old header cell)
                                            old_header_boxes = old_table.get("header_boxes") or []
                                            for hc in diff_result.get("header_changes", []):
                                                h_idx = hc.get("index")
                                                if h_idx is not None and h_idx < len(old_header_boxes):
                                                    h_box = old_header_boxes[h_idx]
                                                    hx, hy, hw, hh = h_box['x'], h_box['y'], h_box['width'], h_box['height']
                                                    draw.rectangle([hx, hy, hx + hw, hy + hh], outline="red", width=4)
                                                    drawn_any = True
                                                    
                                            if drawn_any:
                                                img.save(old_page_path_absolute)"""

new_page_draw = """                                            # OLD PAGE SCREENSHOT DRAWING RULES:
                                            # 1. Removed Rows -> RED outline + light red fill
                                            for r_key in diff_result["removed_keys"]:
                                                if r_key in old_by_key:
                                                    r_box = old_by_key[r_key].get("box")
                                                    if r_box:
                                                        rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                        draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], fill=(255, 0, 0, 40), outline=(255, 0, 0, 255), width=4)
                                                        drawn_any = True
                                            
                                            # 2. Modified Rows/Cells -> RED outline
                                            for m_key in diff_result["modified_keys"]:
                                                if m_key in old_by_key:
                                                    old_row = old_by_key[m_key]
                                                    detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                                    m_cell_boxes = old_row.get("cell_boxes", [])
                                                    
                                                    cell_drawn = False
                                                    if detail and m_cell_boxes:
                                                        for ch in detail.get("changes", []):
                                                            c_idx = ch.get("index")
                                                            if c_idx is not None and c_idx < len(m_cell_boxes):
                                                                c_box = m_cell_boxes[c_idx]
                                                                cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                                draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(255, 0, 0, 255), width=4)
                                                                cell_drawn = True
                                                                drawn_any = True
                                                    if not cell_drawn:
                                                        r_box = old_row.get("box")
                                                        if r_box:
                                                            rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                            draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], outline=(255, 0, 0, 255), width=4)
                                                            drawn_any = True
                                            
                                            # 3. Modified Headers -> RED outline (old header cell)
                                            old_header_boxes = old_table.get("header_boxes") or []
                                            for hc in diff_result.get("header_changes", []):
                                                h_idx = hc.get("index")
                                                if h_idx is not None and h_idx < len(old_header_boxes):
                                                    h_box = old_header_boxes[h_idx]
                                                    hx, hy, hw, hh = h_box['x'], h_box['y'], h_box['width'], h_box['height']
                                                    draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                            if drawn_any:
                                                img = Image.alpha_composite(img, overlay)
                                                img.convert('RGB').save(old_page_path_absolute)"""

# Also modify setup to convert img to RGBA and create overlay
old_page_setup = """                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_page_path_absolute)
                                            draw = ImageDraw.Draw(img)
                                            drawn_any = False"""

new_page_setup = """                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_page_path_absolute).convert('RGBA')
                                            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                            draw_overlay = ImageDraw.Draw(overlay)
                                            drawn_any = False"""

ps_setup_count = content.count(old_page_setup)
print(f"Found {ps_setup_count} occurrences of old_page_setup")
content = content.replace(old_page_setup, new_page_setup)

ps_count = content.count(old_page_draw)
print(f"Found {ps_count} occurrences of old_page_draw")
content = content.replace(old_page_draw, new_page_draw)

# 4. Replace OLD element screenshot drawing logic
old_el_draw = """                                            # OLD ELEMENT SCREENSHOT DRAWING RULES:
                                            # 1. Removed Rows -> YELLOW
                                            for r_key in diff_result["removed_keys"]:
                                                if r_key in old_by_key:
                                                    old_row = old_by_key[r_key]
                                                    eb = old_row.get("element_box")
                                                    r_box = old_row.get("box")
                                                    if eb:
                                                        rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                    elif r_box:
                                                        rx = max(0, r_box['x'] - table_x)
                                                        ry = max(0, r_box['y'] - table_y)
                                                        rw, rh = r_box['width'], r_box['height']
                                                    else:
                                                        continue
                                                    draw.rectangle([rx, ry, rx + rw, ry + rh], outline="yellow", width=4)
                                                    drawn_any = True
                                             
                                            # 2. Modified Rows/Cells -> RED outline
                                            for m_key in diff_result["modified_keys"]:
                                                if m_key in old_by_key:
                                                    old_row = old_by_key[m_key]
                                                    detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                                    m_cell_boxes = old_row.get("cell_boxes", [])
                                                     
                                                    cell_drawn = False
                                                    if detail and m_cell_boxes:
                                                        for ch in detail.get("changes", []):
                                                            c_idx = ch.get("index")
                                                            if c_idx is not None and c_idx < len(m_cell_boxes):
                                                                c_box = m_cell_boxes[c_idx]
                                                                eb = c_box.get("element_box")
                                                                if eb:
                                                                    cx, cy, cw, ch_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                                else:
                                                                    cx = max(0, c_box['x'] - table_x)
                                                                    cy = max(0, c_box['y'] - table_y)
                                                                    cw, ch_h = c_box['width'], c_box['height']
                                                                draw.rectangle([cx, cy, cx + cw, cy + ch_h], outline="red", width=4)
                                                                cell_drawn = True
                                                                drawn_any = True
                                                    if not cell_drawn:
                                                        eb = old_row.get("element_box")
                                                        r_box = old_row.get("box")
                                                        if eb:
                                                            rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                        elif r_box:
                                                            rx = max(0, r_box['x'] - table_x)
                                                            ry = max(0, r_box['y'] - table_y)
                                                            rw, rh = r_box['width'], r_box['height']
                                                        else:
                                                            continue
                                                        draw.rectangle([rx, ry, rx + rw, ry + rh], outline="red", width=4)
                                                        drawn_any = True
                                             
                                            # 3. Modified Headers -> RED outline
                                            old_header_boxes = old_table.get("header_boxes") or []
                                            for hc in diff_result.get("header_changes", []):
                                                h_idx = hc.get("index")
                                                if h_idx is not None and h_idx < len(old_header_boxes):
                                                    h_box = old_header_boxes[h_idx]
                                                    eb = h_box.get("element_box")
                                                    if eb:
                                                        hx, hy, hw, hh = eb['x'], eb['y'], eb['width'], eb['height']
                                                    else:
                                                        hx = max(0, h_box['x'] - table_x)
                                                        hy = max(0, h_box['y'] - (table_y + 40))
                                                        hw, hh = h_box['width'], h_box['height']
                                                    draw.rectangle([hx, hy, hx + hw, hy + hh], outline="red", width=4)
                                                    drawn_any = True
                                                     
                                            if drawn_any:
                                                img.save(old_element_path_absolute)"""

new_el_draw = """                                            # OLD ELEMENT SCREENSHOT DRAWING RULES:
                                            # 1. Removed Rows -> RED outline + light red fill
                                            for r_key in diff_result["removed_keys"]:
                                                if r_key in old_by_key:
                                                    old_row = old_by_key[r_key]
                                                    eb = old_row.get("element_box")
                                                    r_box = old_row.get("box")
                                                    if eb:
                                                        rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                    elif r_box:
                                                        rx = max(0, r_box['x'] - table_x)
                                                        ry = max(0, r_box['y'] - table_y)
                                                        rw, rh = r_box['width'], r_box['height']
                                                    else:
                                                        continue
                                                    draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], fill=(255, 0, 0, 40), outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                             
                                            # 2. Modified Rows/Cells -> RED outline
                                            for m_key in diff_result["modified_keys"]:
                                                if m_key in old_by_key:
                                                    old_row = old_by_key[m_key]
                                                    detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                                    m_cell_boxes = old_row.get("cell_boxes", [])
                                                     
                                                    cell_drawn = False
                                                    if detail and m_cell_boxes:
                                                        for ch in detail.get("changes", []):
                                                            c_idx = ch.get("index")
                                                            if c_idx is not None and c_idx < len(m_cell_boxes):
                                                                c_box = m_cell_boxes[c_idx]
                                                                eb = c_box.get("element_box")
                                                                if eb:
                                                                    cx, cy, cw, ch_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                                else:
                                                                    cx = max(0, c_box['x'] - table_x)
                                                                    cy = max(0, c_box['y'] - table_y)
                                                                    cw, ch_h = c_box['width'], c_box['height']
                                                                draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(255, 0, 0, 255), width=4)
                                                                cell_drawn = True
                                                                drawn_any = True
                                                    if not cell_drawn:
                                                        eb = old_row.get("element_box")
                                                        r_box = old_row.get("box")
                                                        if eb:
                                                            rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                        elif r_box:
                                                            rx = max(0, r_box['x'] - table_x)
                                                            ry = max(0, r_box['y'] - table_y)
                                                            rw, rh = r_box['width'], r_box['height']
                                                        else:
                                                            continue
                                                        draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], outline=(255, 0, 0, 255), width=4)
                                                        drawn_any = True
                                             
                                            # 3. Modified Headers -> RED outline
                                            old_header_boxes = old_table.get("header_boxes") or []
                                            for hc in diff_result.get("header_changes", []):
                                                h_idx = hc.get("index")
                                                if h_idx is not None and h_idx < len(old_header_boxes):
                                                    h_box = old_header_boxes[h_idx]
                                                    eb = h_box.get("element_box")
                                                    if eb:
                                                        hx, hy, hw, hh = eb['x'], eb['y'], eb['width'], eb['height']
                                                    else:
                                                        hx = max(0, h_box['x'] - table_x)
                                                        hy = max(0, h_box['y'] - (table_y + 40))
                                                        hw, hh = h_box['width'], h_box['height']
                                                    draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                     
                                            if drawn_any:
                                                img = Image.alpha_composite(img, overlay)
                                                img.convert('RGB').save(old_element_path_absolute)"""

old_el_setup = """                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_element_path_absolute)
                                            draw = ImageDraw.Draw(img)
                                            drawn_any = False"""

new_el_setup = """                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_element_path_absolute).convert('RGBA')
                                            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                            draw_overlay = ImageDraw.Draw(overlay)
                                            drawn_any = False"""

es_setup_count = content.count(old_el_setup)
print(f"Found {es_setup_count} occurrences of old_el_setup")
content = content.replace(old_el_setup, new_el_setup)

es_count = content.count(old_el_draw)
print(f"Found {es_count} occurrences of old_el_draw")
content = content.replace(old_el_draw, new_el_draw)

# Write back
with open(worker_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modification finished.")
