import os
import json
import traceback
import shutil
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
from database import SessionLocal
import models
import diff_engine
import element_engine

import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

DEBUG_MODE = True

def extract_table_structure(container_locator) -> dict:
    try:
        data = container_locator.evaluate(r"""
            el => {
                if (!el) return null;
                
                const containerRect = el.getBoundingClientRect();
                const container_box = {
                    x: containerRect.left + window.scrollX,
                    y: containerRect.top + window.scrollY,
                    width: containerRect.width,
                    height: containerRect.height,
                    element_box: {
                        x: 0,
                        y: 0,
                        width: containerRect.width,
                        height: containerRect.height
                    }
                };

                // Clone the container to extract clean non-table text
                const clone = el.cloneNode(true);
                const tables = clone.querySelectorAll('table');
                tables.forEach(t => t.remove());
                const container_non_table_text = clone.textContent.trim().replace(/\s+/g, ' ');

                let container_title = null;
                let container_title_box = null;
                const headingEl = el.querySelector('h1, h2, h3, h4, h5, h6, caption, .title, .modal-title');
                if (headingEl) {
                    container_title = headingEl.textContent.trim();
                    const rect = headingEl.getBoundingClientRect();
                    container_title_box = {
                        x: rect.left + window.scrollX,
                        y: rect.top + window.scrollY,
                        width: rect.width,
                        height: rect.height,
                        element_box: {
                            x: rect.left - containerRect.left,
                            y: rect.top - containerRect.top,
                            width: rect.width,
                            height: rect.height
                        }
                    };
                }

                // Table extraction
                const tableEl = el.tagName.toLowerCase() === 'table' ? el : el.querySelector('table');
                
                const headers = [];
                const header_boxes = [];
                const rows = [];
                let norm_headers = [];
                const keyCounts = {};
                
                if (tableEl) {
                    const headRow = tableEl.querySelector('thead tr') || tableEl.querySelector('tr');
                    if (headRow) {
                        const ths = headRow.querySelectorAll('th, td');
                        ths.forEach(th => {
                            headers.push(th.textContent.trim());
                            const rect = th.getBoundingClientRect();
                            header_boxes.push({
                                x: rect.left + window.scrollX,
                                y: rect.top + window.scrollY,
                                width: rect.width,
                                height: rect.height,
                                element_box: {
                                    x: rect.left - containerRect.left,
                                    y: rect.top - containerRect.top,
                                    width: rect.width,
                                    height: rect.height
                                }
                            });
                        });
                    }
                    
                    const norm = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
                    norm_headers = headers.map(norm);
                
                const sequentialHeaders = [
                    "sno", "s.no", "s.no.", "sn", "s.n", "s.n.", "no", "no.", "index",
                    "slno", "sl.no", "sl.no.", "sl no", "srno", "sr.no", "sr.no.", "sr no", "sr. no",
                    "serial number", "serial no", "serial_no", "serialnumber", "#", "row", "row number", "row no", "row_no", "row."
                ];

                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"],
                    sequentialHeaders
                ];
                
                    const allRows = Array.from(tableEl.querySelectorAll('tr'));
                    allRows.forEach(row => {
                        if (row.closest('table') !== tableEl) return;
                        if (row === headRow) return;
                        
                        const rowRect = row.getBoundingClientRect();
                        const cells = Array.from(row.querySelectorAll('th, td'));
                        const cellTexts = [];
                        const cellBoxes = [];
                        
                        cells.forEach(cell => {
                            cellTexts.push(cell.textContent.trim());
                            const cellRect = cell.getBoundingClientRect();
                            cellBoxes.push({
                                x: cellRect.left + window.scrollX,
                                y: cellRect.top + window.scrollY,
                                width: cellRect.width,
                                height: cellRect.height,
                                element_box: {
                                    x: cellRect.left - containerRect.left,
                                    y: cellRect.top - containerRect.top,
                                    width: cellRect.width,
                                    height: cellRect.height
                                }
                            });
                        });
                        
                        let key = "";
                        let found = false;
                        
                        for (const candList of candidates) {
                            for (const cand of candList) {
                                const idx = norm_headers.indexOf(cand);
                                if (idx !== -1 && idx < cellTexts.length && cellTexts[idx].trim()) {
                                    key = cellTexts[idx].trim();
                                    found = true;
                                    break;
                                }
                            }
                            if (found) break;
                        }
                        
                        if (!found) {
                            for (const candList of candidates) {
                                for (const cand of candList) {
                                    const safeCand = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const regex = new RegExp("\\b" + safeCand + "\\b", "i");
                                    for (let idx = 0; idx < norm_headers.length; idx++) {
                                        if (regex.test(norm_headers[idx])) {
                                            if (idx < cellTexts.length && cellTexts[idx].trim()) {
                                                key = cellTexts[idx].trim();
                                                found = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (found) break;
                                }
                                if (found) break;
                            }
                        }
                        
                        if (!found) {
                            if (cellTexts.length > 0 && cellTexts[0].trim()) {
                                key = cellTexts[0].trim();
                                found = true;
                            } else {
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
                            }
                        }
                        
                        let finalKey = key;
                        if (keyCounts[key]) {
                            keyCounts[key]++;
                            finalKey = `${key}_${keyCounts[key]}`;
                        } else {
                            keyCounts[key] = 1;
                        }
                        
                        rows.push({
                            key: finalKey,
                            cells: cellTexts,
                            text: cellTexts.join(" | "),
                            box: {
                                x: rowRect.left + window.scrollX,
                                y: rowRect.top + window.scrollY,
                                width: rowRect.width,
                                height: rowRect.height
                            },
                            element_box: {
                                x: rowRect.left - containerRect.left,
                                y: rowRect.top - containerRect.top,
                                width: rowRect.width,
                                height: rowRect.height
                            },
                            cell_boxes: cellBoxes
                        });
                    });
                }
                
                return {
                    container_box: container_box,
                    container_title: container_title,
                    container_title_box: container_title_box,
                    container_non_table_text: container_non_table_text,
                    table: {
                        headers: headers,
                        header_boxes: header_boxes,
                        rows: rows
                    }
                };
            }
        """)
        return data

    except Exception as e:
        import traceback
        with open("debug_extract.txt", "a") as f_debug:
            f_debug.write(f"Failed to extract table structure: {e}\n")
            f_debug.write(traceback.format_exc() + "\n")
        print(f"Failed to extract table structure: {e}")
        return None

def get_recalculated_row_coordinates(page, selector, target_key):
    try:
        coords = page.evaluate(r"""
            (args) => {
                const { selector, targetKey } = args;
                const el = document.querySelector(selector);
                if (!el) return null;
                
                const headers = [];
                const headRow = el.querySelector('thead tr') || el.querySelector('tr');
                if (headRow) {
                    const ths = headRow.querySelectorAll('th, td');
                    ths.forEach(th => headers.push(th.textContent.trim()));
                }
                const allRows = Array.from(el.querySelectorAll('tr'));
                const keyCounts = {};
                
                const norm = s => s.toLowerCase().trim().replace(/\\s+/g, ' ');
                const norm_headers = headers.map(norm);
                
                const sequentialHeaders = [
                    "sno", "s.no", "s.no.", "sn", "s.n", "s.n.", "no", "no.", "index",
                    "slno", "sl.no", "sl.no.", "sl no", "srno", "sr.no", "sr.no.", "sr no", "sr. no",
                    "serial number", "serial no", "serial_no", "serialnumber", "#", "row", "row number", "row no", "row_no", "row."
                ];

                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"],
                    sequentialHeaders
                ];
                
                let targetRow = null;
                
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    if (row.closest('table') !== el) continue;
                    if (row === headRow) continue;
                    
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const cellTexts = cells.map(c => c.textContent.trim());
                    
                    let key = "";
                    let found = false;
                    
                    for (const candList of candidates) {
                        for (const cand of candList) {
                            const idx = norm_headers.indexOf(cand);
                            if (idx !== -1 && idx < cellTexts.length && cellTexts[idx].trim()) {
                                key = cellTexts[idx].trim();
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    
                    if (!found) {
                        for (const candList of candidates) {
                            for (const cand of candList) {
                                const safeCand = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp("\\b" + safeCand + "\\b", "i");
                                for (let idx = 0; idx < norm_headers.length; idx++) {
                                    if (regex.test(norm_headers[idx])) {
                                        if (idx < cellTexts.length && cellTexts[idx].trim()) {
                                            key = cellTexts[idx].trim();
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                    }
                    
                    if (!found) {
                        if (cellTexts.length > 0 && cellTexts[0].trim()) {
                            key = cellTexts[0].trim();
                            found = true;
                        } else {
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
                        }
                    }
                    
                    let finalKey = key;
                    if (keyCounts[key]) {
                        keyCounts[key]++;
                        finalKey = `${key}_${keyCounts[key]}`;
                    } else {
                        keyCounts[key] = 1;
                    }
                    
                    if (finalKey === targetKey) {
                        targetRow = row;
                        break;
                    }
                }
                
                if (targetRow) {
                    targetRow.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                    const rect = targetRow.getBoundingClientRect();
                    
                    const cells = Array.from(targetRow.querySelectorAll('th, td'));
                    const cellBoxes = cells.map(cell => {
                        const cellRect = cell.getBoundingClientRect();
                        return {
                            x: cellRect.left + window.scrollX,
                            y: cellRect.top + window.scrollY,
                            width: cellRect.width,
                            height: cellRect.height
                        };
                    });
                    
                    return {
                        box: {
                            x: rect.left + window.scrollX,
                            y: rect.top + window.scrollY,
                            width: rect.width,
                            height: rect.height
                        },
                        cell_boxes: cellBoxes
                    };
                }
                return null;
            }
        """, {"selector": selector, "targetKey": target_key})
        return coords
    except Exception as e:
        print(f"Failed to scroll and get row coordinates: {e}")
        return None

def scroll_to_row_and_get_coords(page, table_locator, target_key):
    try:
        print("[BEFORE SCROLL]")
        print(page.url)
        print(target_key)
        page.screenshot(path="debug_before_scroll.png")
        print("Debug screenshot before scroll: debug_before_scroll.png")

        # Step 1: Find row and scroll it into view
        scrolled = table_locator.evaluate(r"""
            (el, targetKey) => {
                if (!el) return false;
                
                const headers = [];
                const headRow = el.querySelector('thead tr') || el.querySelector('tr');
                if (headRow) {
                    const ths = headRow.querySelectorAll('th, td');
                    ths.forEach(th => headers.push(th.textContent.trim()));
                }
                const allRows = Array.from(el.querySelectorAll('tr'));
                const keyCounts = {};
                
                const norm = s => s.toLowerCase().trim().replace(/\\s+/g, ' ');
                const norm_headers = headers.map(norm);
                
                const sequentialHeaders = [
                    "sno", "s.no", "s.no.", "sn", "s.n", "s.n.", "no", "no.", "index",
                    "slno", "sl.no", "sl.no.", "sl no", "srno", "sr.no", "sr.no.", "sr no", "sr. no",
                    "serial number", "serial no", "serial_no", "serialnumber", "#", "row", "row number", "row no", "row_no", "row."
                ];

                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"],
                    sequentialHeaders
                ];
                
                let targetRow = null;
                
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    if (row.closest('table') !== el) continue;
                    if (row === headRow) continue;
                    
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const cellTexts = cells.map(c => c.textContent.trim());
                    
                    let key = "";
                    let found = false;
                    
                    for (const candList of candidates) {
                        for (const cand of candList) {
                            const idx = norm_headers.indexOf(cand);
                            if (idx !== -1 && idx < cellTexts.length && cellTexts[idx].trim()) {
                                key = cellTexts[idx].trim();
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    
                    if (!found) {
                        for (const candList of candidates) {
                            for (const cand of candList) {
                                const safeCand = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp("\\b" + safeCand + "\\b", "i");
                                for (let idx = 0; idx < norm_headers.length; idx++) {
                                    if (regex.test(norm_headers[idx])) {
                                        if (idx < cellTexts.length && cellTexts[idx].trim()) {
                                            key = cellTexts[idx].trim();
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                    }
                    
                    if (!found) {
                        if (cellTexts.length > 0 && cellTexts[0].trim()) {
                            key = cellTexts[0].trim();
                            found = true;
                        } else {
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
                        }
                    }
                    
                    let finalKey = key;
                    if (keyCounts[key]) {
                        keyCounts[key]++;
                        finalKey = `${key}_${keyCounts[key]}`;
                    } else {
                        keyCounts[key] = 1;
                    }
                    
                    if (finalKey === targetKey) {
                        targetRow = row;
                        break;
                    }
                }
                
                if (targetRow) {
                    targetRow.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                    return true;
                }
                return false;
            }
        """, target_key)
        
        if not scrolled:
            return None
            
        # Step 2: Wait 1000ms (1 second)
        page.wait_for_timeout(1000)
        
        print("[AFTER SCROLL]")
        scroll_y = page.evaluate("window.scrollY")
        print("ScrollY =", scroll_y)
        page.screenshot(path="debug_after_scroll.png")
        print("Debug screenshot after scroll: debug_after_scroll.png")

        
        # Step 3: Recalculate coordinates
        coords = table_locator.evaluate(r"""
            (el, targetKey) => {
                if (!el) return null;
                
                const tableRect = el.getBoundingClientRect();
                const headers = [];
                const headRow = el.querySelector('thead tr') || el.querySelector('tr');
                if (headRow) {
                    const ths = headRow.querySelectorAll('th, td');
                    ths.forEach(th => headers.push(th.textContent.trim()));
                }
                const allRows = Array.from(el.querySelectorAll('tr'));
                const keyCounts = {};
                
                const norm = s => s.toLowerCase().trim().replace(/\\s+/g, ' ');
                const norm_headers = headers.map(norm);
                
                const sequentialHeaders = [
                    "sno", "s.no", "s.no.", "sn", "s.n", "s.n.", "no", "no.", "index",
                    "slno", "sl.no", "sl.no.", "sl no", "srno", "sr.no", "sr.no.", "sr no", "sr. no",
                    "serial number", "serial no", "serial_no", "serialnumber", "#", "row", "row number", "row no", "row_no", "row."
                ];

                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"],
                    sequentialHeaders
                ];
                
                let targetRow = null;
                
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    if (row.closest('table') !== el) continue;
                    if (row === headRow) continue;
                    
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const cellTexts = cells.map(c => c.textContent.trim());
                    
                    let key = "";
                    let found = false;
                    
                    for (const candList of candidates) {
                        for (const cand of candList) {
                            const idx = norm_headers.indexOf(cand);
                            if (idx !== -1 && idx < cellTexts.length && cellTexts[idx].trim()) {
                                key = cellTexts[idx].trim();
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    
                    if (!found) {
                        for (const candList of candidates) {
                            for (const cand of candList) {
                                const safeCand = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp("\\b" + safeCand + "\\b", "i");
                                for (let idx = 0; idx < norm_headers.length; idx++) {
                                    if (regex.test(norm_headers[idx])) {
                                        if (idx < cellTexts.length && cellTexts[idx].trim()) {
                                            key = cellTexts[idx].trim();
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                    }
                    
                    if (!found) {
                        if (cellTexts.length > 0 && cellTexts[0].trim()) {
                            key = cellTexts[0].trim();
                            found = true;
                        } else {
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
                        }
                    }
                    
                    let finalKey = key;
                    if (keyCounts[key]) {
                        keyCounts[key]++;
                        finalKey = `${key}_${keyCounts[key]}`;
                    } else {
                        keyCounts[key] = 1;
                    }
                    
                    if (finalKey === targetKey) {
                        targetRow = row;
                        break;
                    }
                }
                
                if (targetRow) {
                    const rect = targetRow.getBoundingClientRect();
                    const cells = Array.from(targetRow.querySelectorAll('th, td'));
                    const cellBoxes = cells.map(cell => {
                        const cellRect = cell.getBoundingClientRect();
                        return {
                            x: cellRect.left + window.scrollX,
                            y: cellRect.top + window.scrollY,
                            width: cellRect.width,
                            height: cellRect.height,
                            element_box: {
                                x: cellRect.left - tableRect.left,
                                y: cellRect.top - tableRect.top,
                                width: cellRect.width,
                                height: cellRect.height
                            }
                        };
                    });
                    
                    const headRow = el.querySelector('thead tr') || el.querySelector('tr');
                    const header_boxes = [];
                    if (headRow) {
                        const ths = headRow.querySelectorAll('th, td');
                        ths.forEach(th => {
                            const r = th.getBoundingClientRect();
                            header_boxes.push({
                                x: r.left + window.scrollX,
                                y: r.top + window.scrollY,
                                width: r.width,
                                height: r.height,
                                element_box: {
                                    x: r.left - tableRect.left,
                                    y: r.top - tableRect.top,
                                    width: r.width,
                                    height: r.height
                                }
                            });
                        });
                    }
                    
                    return {
                        box: {
                            x: rect.left + window.scrollX,
                            y: rect.top + window.scrollY,
                            width: rect.width,
                            height: rect.height
                        },
                        element_box: {
                            x: rect.left - tableRect.left,
                            y: rect.top - tableRect.top,
                            width: rect.width,
                            height: rect.height
                        },
                        cell_boxes: cellBoxes,
                        header_boxes: header_boxes
                    };
                }
                return null;
            }
        """, target_key)
        return coords
    except Exception as e:
        print(f"Failed to scroll and recalculate row coordinates: {e}")
        return None

def scroll_to_header_and_get_coords(page, table_locator):
    try:
        scrolled = table_locator.evaluate(r"""
            (el) => {
                if (!el) return false;
                const headRow = el.querySelector('thead tr') || el.querySelector('tr');
                if (headRow) {
                    headRow.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                    return true;
                }
                return false;
            }
        """)
        if not scrolled:
            return None
        
        page.wait_for_timeout(1000)
        
        coords = table_locator.evaluate(r"""
            (el) => {
                if (!el) return null;
                const headRow = el.querySelector('thead tr') || el.querySelector('tr');
                if (!headRow) return null;
                const rect = headRow.getBoundingClientRect();
                const tableRect = el.getBoundingClientRect();
                const ths = headRow.querySelectorAll('th, td');
                const header_boxes = Array.from(ths).map(th => {
                    const r = th.getBoundingClientRect();
                    return {
                        x: r.left + window.scrollX,
                        y: r.top + window.scrollY,
                        width: r.width,
                        height: r.height,
                        element_box: {
                            x: r.left - tableRect.left,
                            y: r.top - tableRect.top,
                            width: r.width,
                            height: r.height
                        }
                    };
                });
                return {
                    box: {
                        x: rect.left + window.scrollX,
                        y: rect.top + window.scrollY,
                        width: rect.width,
                        height: rect.height
                    },
                    element_box: {
                        x: rect.left - tableRect.left,
                        y: rect.top - tableRect.top,
                        width: rect.width,
                        height: rect.height
                    },
                    header_boxes: header_boxes
                };
            }
        """)
        return coords
    except Exception as e:
        print(f"Failed to scroll and get header coordinates: {e}")
        return None

def compute_table_diff(old_table, new_table):
    if "table" not in old_table:
        old_table = {
            "container_title": old_table.get("title", ""),
            "container_non_table_text": "",
            "table": old_table
        }
        
    old_rows = old_table.get("table", {}).get("rows") or []
    new_rows = new_table.get("table", {}).get("rows") or []
    
    old_by_key = {r["key"]: r for r in old_rows}
    new_by_key = {r["key"]: r for r in new_rows}
    
    added_keys = []
    removed_keys = []
    modified_keys = []
    modified_details = []
    
    for r in new_rows:
        key = r["key"]
        if key not in old_by_key:
            added_keys.append(key)
            
    for r in old_rows:
        key = r["key"]
        if key not in new_by_key:
            removed_keys.append(key)
            
    for r in new_rows:
        key = r["key"]
        if key in old_by_key:
            old_r = old_by_key[key]
            old_cells = old_r.get("cells") or []
            new_cells = r.get("cells") or []
            
            cell_changes = []
            max_len = max(len(old_cells), len(new_cells))
            for c_idx in range(max_len):
                o_val = old_cells[c_idx] if c_idx < len(old_cells) else ""
                n_val = new_cells[c_idx] if c_idx < len(new_cells) else ""
                if o_val != n_val:
                    headers = new_table.get("table", {}).get("headers") or []
                    col_name = headers[c_idx] if c_idx < len(headers) else f"Column {c_idx + 1}"
                    cell_changes.append({
                        "index": c_idx,
                        "column": col_name,
                        "old": o_val,
                        "new": n_val
                    })
            if cell_changes:
                modified_keys.append(key)
                modified_details.append({
                    "key": key,
                    "changes": cell_changes
                })
                
    header_changes = []
    old_headers = old_table.get("table", {}).get("headers") or []
    new_headers = new_table.get("table", {}).get("headers") or []
    max_len = max(len(old_headers), len(new_headers))
    for i in range(max_len):
        o_val = old_headers[i] if i < len(old_headers) else ""
        n_val = new_headers[i] if i < len(new_headers) else ""
        if o_val != n_val:
            header_changes.append({
                "index": i,
                "old": o_val,
                "new": n_val
            })
            
    old_title = old_table.get("container_title")
    new_title = new_table.get("container_title")
    title_change = None
    if old_title != new_title and (old_title or new_title):
        title_change = {
            "old": old_title,
            "new": new_title
        }
        
    old_container_text = old_table.get("container_non_table_text")
    new_container_text = new_table.get("container_non_table_text")
    container_text_change = None
    if old_container_text != new_container_text and (old_container_text or new_container_text):
        container_text_change = {
            "old": old_container_text,
            "new": new_container_text
        }

    return {
        "title_change": title_change,
        "container_text_change": container_text_change,
        "added_keys": added_keys,
        "removed_keys": removed_keys,
        "modified_keys": modified_keys,
        "modified_details": modified_details,
        "header_changes": header_changes
    }

import threading
_check_lock = threading.Lock()

def check_monitors():
    """
    Worker task that queries due monitors, launches a single Playwright browser,
    resuses contexts/pages to check elements, detects changes, writes diff events,
    captures screenshots, and handles rescheduled next check runs.
    """
    print("[SCHEDULER WAKE]", datetime.now())
    import sys
    import asyncio
    if sys.platform == 'win32':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        except Exception:
            pass

    if not _check_lock.acquire(blocking=False):
        print("[SCHEDULER] check_monitors already running, skipping this tick.")
        return

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Find active monitors where next_check_at is due (less than or equal to now)
        due_monitors = db.query(models.Monitor).filter(
            models.Monitor.status == "active",
            models.Monitor.next_check_at <= now
        ).all()

        if not due_monitors:
            return

        print(f"[{datetime.utcnow()}] Found {len(due_monitors)} due monitors to run.")

        with sync_playwright() as p:
            # Launch browser once and reuse it
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()

            for monitor in due_monitors:
                print("[DUE]", monitor.name, monitor.next_check_at, monitor.check_interval)
                print("[MONITOR]")
                print("Name:", monitor.name)
                print("Monitor Type:", monitor.monitor_type)
                if monitor.monitor_type != "table":
                    print("[WARNING] Monitor is not a table monitor")
                page = context.new_page()
                check_now = datetime.utcnow()
                try:
                    if DEBUG_MODE:
                        print("="*50)
                        print("[MONITOR START]")
                        print(f"ID: {monitor.id}")
                        print(f"Name: {monitor.name}")
                        print(f"URL: {monitor.url}")
                        print(f"Selector: {monitor.selector}")
                        print("="*50)
                        print()
                    else:
                        print(f"Checking monitor '{monitor.name}' ({monitor.id}) at {monitor.url}")
                    
                    # [STEP 1] Opening page...
                    if DEBUG_MODE:
                        print("[STEP 1] Opening page...")
                    page.goto(monitor.url, timeout=30000, wait_until="load")
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        if not DEBUG_MODE:
                            print(f"Warning: networkidle wait timed out for {monitor.url}, continuing check...")
                    
                    if DEBUG_MODE:
                        print("[OK] Page loaded\n")

                    # Parse Interaction Steps
                    print("[WORKER] Loaded interaction_steps =", monitor.interaction_steps)
                    if DEBUG_MODE:
                        print(f"[WORKER]\nLoaded interaction_steps={monitor.interaction_steps or '[]'}")
                    interaction_steps = []
                    if monitor.interaction_steps:
                        if isinstance(monitor.interaction_steps, list):
                            interaction_steps = monitor.interaction_steps
                        elif isinstance(monitor.interaction_steps, str):
                            try:
                                interaction_steps = json.loads(monitor.interaction_steps)
                            except Exception:
                                pass

                    # --- Step 1 / [STEP 2] Escape Key Dismissal ---
                    if not interaction_steps:
                        if DEBUG_MODE:
                            print("[STEP 2] Pressing ESC...")
                        try:
                            page.keyboard.press("Escape")
                        except Exception:
                            pass
                        page.wait_for_timeout(300)
                        if DEBUG_MODE:
                            print("[OK] ESC sent\n")

                    # --- Step 2 / [STEP 3] Common Popup Close Buttons ---
                    if not interaction_steps:
                        if DEBUG_MODE:
                            print("[STEP 3] Searching for popup close buttons...")
                        
                        close_texts = ["×", "X", "Close", "Dismiss", "Cancel", "Skip", "No Thanks", "Not Now", "Got It", "Continue"]
                        close_selectors = [
                            "button[aria-label='Close']",
                            "button[title='Close']",
                            "[aria-label='Close']",
                            "[title='Close']",
                            ".modal-close",
                            ".popup-close",
                            ".close-btn",
                            ".btn-close"
                        ]

                        potential_clicks = []
                        
                        # 1. Search for text-based buttons inside modal/dialog contexts
                        for text in close_texts:
                            try:
                                locators = page.get_by_text(text)
                                count = locators.count()
                                for i in range(count):
                                    loc = locators.nth(i)
                                    if loc.is_visible():
                                        # Verify it is inside a detected modal/dialog ancestor
                                        in_modal = loc.evaluate("""
                                            el => {
                                                if (el.closest('[role="dialog"], [role="alertdialog"]')) return true;
                                                const modalAncestor = el.closest("[class*='modal'], [class*='popup'], [class*='dialog'], [class*='lightbox'], [class*='overlay'], [class*='consent'], [class*='cookie'], [id*='modal'], [id*='popup'], [id*='dialog'], [id*='lightbox'], [id*='overlay'], [id*='consent'], [id*='cookie']");
                                                if (modalAncestor) return true;
                                                return false;
                                            }
                                        """)
                                        if in_modal:
                                            potential_clicks.append(("text", text, loc))
                            except Exception:
                                pass
                                
                        # 2. Search for selector-based close elements
                        for selector in close_selectors:
                            try:
                                locators = page.locator(selector)
                                count = locators.count()
                                for i in range(count):
                                    loc = locators.nth(i)
                                    if loc.is_visible():
                                        potential_clicks.append(("selector", selector, loc))
                            except Exception:
                                pass

                        if DEBUG_MODE:
                            print(f"[INFO] Found {len(potential_clicks)} potential close buttons")

                        # Click popup close buttons safely
                        for item_type, val, loc in potential_clicks:
                            before_url = page.url
                            print(f"[POPUP] Before click URL: {before_url}")
                            print(f"[POPUP] Clicking: {val}")
                            
                            try:
                                loc.click(timeout=1000)
                                page.wait_for_timeout(200)
                            except Exception as click_err:
                                print(f"Click failed: {click_err}")
                                continue
                                
                            after_url = page.url
                            print(f"[POPUP] After click URL: {after_url}")
                            
                            if after_url != before_url:
                                print("[WARNING] Popup handler caused navigation")
                                print(f"Navigation was caused by clicking: {val}")
                                break

                    # --- Step 3: Wait For UI Stabilization ---
                    page.wait_for_timeout(500)

                    # --- Replay Interaction Steps ---
                    if interaction_steps:
                        print("[INTERACTION REPLAY]")
                        for step in interaction_steps:
                            print("[REPLAY]", step)
                            try:
                                page.locator(step["selector"]).click()
                            except Exception as e:
                                print(f"Click failed: {e}")
                            page.wait_for_timeout(1000)

                        # Verify modal is visible
                        modal_visible = False
                        try:
                            modal_visible = page.evaluate("""
                                () => {
                                    const modal = document.querySelector("#tenderModal") || 
                                                  document.querySelector(".modal") || 
                                                  document.querySelector("[class*='modal']") || 
                                                  document.querySelector("[id*='modal']");
                                    if (modal) {
                                        const style = window.getComputedStyle(modal);
                                        return style.display !== 'none' && style.visibility !== 'hidden' && modal.offsetHeight > 0;
                                    }
                                    return false;
                                }
                            """)
                        except Exception:
                            pass
                        
                        print()
                        print("[POST INTERACTION]")
                        print(f"Modal Visible: {modal_visible}")
                        print()

                    # --- Locate Target Element ---
                    locator = page.locator(monitor.selector)
                    matches_count = 0
                    try:
                        matches_count = locator.count()
                    except Exception:
                        pass

                    # Query initial metrics before scrolling
                    scroll_y_before = 0
                    try:
                        scroll_y_before = page.evaluate("window.scrollY")
                    except Exception:
                        pass

                    box_before = None
                    try:
                        if matches_count > 0:
                            box_before = locator.first.bounding_box()
                    except Exception:
                        pass

                    is_visible_before = False
                    try:
                        if matches_count > 0:
                            is_visible_before = locator.first.is_visible()
                    except Exception:
                        pass

                    # --- Print locator and page details before scroll ---
                    try:
                        print("Locator Count:", locator.count())
                    except Exception as e:
                        print("Locator Count failed:", e)

                    try:
                        print("Visible:", locator.first.is_visible())
                    except Exception as e:
                        print("Visible check failed:", e)

                    try:
                        print("Enabled:", locator.first.is_enabled())
                    except Exception as e:
                        print("Enabled check failed:", e)

                    try:
                        print(
                            "Display:",
                            locator.first.evaluate(
                                "el => getComputedStyle(el).display"
                            )
                        )
                    except Exception as e:
                        print("Display evaluate failed:", e)

                    try:
                        print(
                            "Visibility:",
                            locator.first.evaluate(
                                "el => getComputedStyle(el).visibility"
                            )
                        )
                    except Exception as e:
                        print("Visibility evaluate failed:", e)

                    try:
                        print(
                            "Opacity:",
                            locator.first.evaluate(
                                "el => getComputedStyle(el).opacity"
                            )
                        )
                    except Exception as e:
                        print("Opacity evaluate failed:", e)

                    try:
                        print("Current URL:", page.url)
                    except Exception as e:
                        print("Current URL check failed:", e)

                    try:
                        print("Page Title:", page.title())
                    except Exception as e:
                        print("Page Title check failed:", e)

                    if matches_count == 0:
                        if DEBUG_MODE:
                            print("[ERROR]")
                            print("Selector no longer matches page DOM\n")
                        raise ValueError("Selector no longer matches page DOM")

                    # --- Scroll Into View & Wait ---
                    try:
                        locator.first.scroll_into_view_if_needed()
                    except Exception as e:
                        if DEBUG_MODE:
                            print(f"[WARNING] Scroll failed: {e}")
                    page.wait_for_timeout(1000)

                    # Query metrics after scroll
                    scroll_y_after = 0
                    try:
                        scroll_y_after = page.evaluate("window.scrollY")
                    except Exception:
                        pass

                    box_after = None
                    try:
                        box_after = locator.first.bounding_box()
                    except Exception:
                        pass

                    is_visible_after = False
                    try:
                        is_visible_after = locator.first.is_visible()
                    except Exception:
                        pass

                    # Recovery Scroll if needed
                    if box_after is None or not is_visible_after:
                        if DEBUG_MODE:
                            print("[INFO] Visibility failed. Attempting recovery scroll...")
                        try:
                            # Scroll to bottom, then back to top
                            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            page.wait_for_timeout(1000)
                            page.evaluate("window.scrollTo(0, 0)")
                            page.wait_for_timeout(1000)

                            # Re-attempt scrolling
                            locator.first.scroll_into_view_if_needed()
                            page.wait_for_timeout(1000)

                            # Recalculate post-scroll metrics
                            scroll_y_after = page.evaluate("window.scrollY")
                            box_after = locator.first.bounding_box()
                            is_visible_after = locator.first.is_visible()
                        except Exception as scroll_err:
                            if DEBUG_MODE:
                                print(f"[WARNING] Recovery scroll failed: {scroll_err}")

                    # --- Print Enhanced Debug Logs ---
                    if DEBUG_MODE:
                        print("================================================\n")
                        print("[MONITOR START]\n")
                        print("Name:")
                        print(monitor.name)
                        print()
                        print("Selector:")
                        print(monitor.selector)
                        print()
                        print("Selector Confidence:")
                        print(monitor.selector_confidence or "LOW")
                        print()
                        print("Interaction Steps:")
                        print(monitor.interaction_steps or "[]")
                        print()
                        print("Locator Count Before Scroll:")
                        print(matches_count)
                        print()
                        print("Bounding Box Before Scroll:")
                        print(box_before)
                        print()
                        print("Visible Before Scroll:")
                        print(is_visible_before)
                        print()
                        print("Scroll Y Before:")
                        print(scroll_y_before)
                        print()
                        print("Scroll Y After:")
                        print(scroll_y_after)
                        print()
                        print("Bounding Box After Scroll:")
                        print(box_after)
                        print()
                        print("Visible After Scroll:")
                        print(is_visible_after)
                        print()
                        print("================================================\n")

                    # Hovering element (optional)
                    try:
                        locator.first.hover(timeout=1000)
                    except Exception:
                        pass

                    # Only proceed if visible after scroll
                    if not is_visible_after:
                        if DEBUG_MODE:
                            print("[ERROR]")
                        print("Element hidden by popup or overlay\n")
                        raise ValueError("Element hidden by popup or overlay")

                    box = box_after
                    if box is None or box["width"] <= 0 or box["height"] <= 0:
                        raise ValueError("Element blocked by popup or overlay")

                    el_tag = locator.first.evaluate("el => el.tagName").lower()
                    has_table = locator.first.locator("table").count() > 0
                    
                    monitor_type = monitor.monitor_type or "text"
                    
                    print("[TABLE DETECTION]")
                    print("Root Tag:", el_tag)
                    print("Contains Table:", has_table)
                    print("Monitor Type:", monitor_type)
                    
                    if monitor_type in ["element", "table"]:
                        pass
                    elif el_tag == "table" or has_table:
                        monitor_type = "table"
                        monitor.monitor_type = "table"

                    if monitor_type == "element":
                        print("[ELEMENT MODE ACTIVE]")
                        print("Monitor:", monitor.name)
                        
                        js_code = element_engine.get_element_extraction_js()
                        new_data = locator.first.evaluate(js_code)
                        if not new_data:
                            raise ValueError("Failed to extract element structure")
                            
                        tables = []
                        if el_tag == "table":
                            tbl = extract_table_structure(locator.first)
                            if tbl: tables.append(tbl)
                        else:
                            tbl_locators = locator.first.locator("table")
                            tbl_count = tbl_locators.count()
                            for i in range(tbl_count):
                                t_loc = tbl_locators.nth(i)
                                if t_loc.is_visible():
                                    tbl = extract_table_structure(t_loc)
                                    if tbl: tables.append(tbl)
                        new_data["tables"] = tables
                        
                        text_content = locator.first.text_content() or ""
                        current_text_value = text_content.strip()
                        new_data["raw_text"] = current_text_value
                        
                        old_value = monitor.last_value or ""
                        is_first_check = monitor.last_page_screenshot_path is None
                        
                        backend_dir = os.path.dirname(os.path.abspath(__file__))
                        timestamp_str = check_now.strftime("%Y%m%d_%H%M%S")
                        screenshot_dir = os.path.join(backend_dir, "screenshots", monitor.id)
                        os.makedirs(screenshot_dir, exist_ok=True)
                        
                        if is_first_check:
                            raw_page_filename = f"{timestamp_str}_raw_page.png"
                            raw_page_path_absolute = os.path.join(screenshot_dir, raw_page_filename)
                            try:
                                page.screenshot(path=raw_page_path_absolute, full_page=True)
                                monitor.last_page_screenshot_path = f"screenshots/{monitor.id}/{raw_page_filename}"
                            except Exception as se:
                                print(f"Failed to capture baseline page screenshot: {se}")
                                monitor.last_page_screenshot_path = None
                                
                            monitor.last_value = json.dumps(new_data)
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            db.commit()
                        else:
                            try:
                                old_data = json.loads(old_value)
                            except:
                                old_data = {}
                            
                            diff_result = element_engine.compute_element_diff(old_data, new_data)
                            
                            old_tables = old_data.get("tables", [])
                            new_tables = new_data.get("tables", [])
                            max_tbl = max(len(old_tables), len(new_tables))
                            
                            for i in range(max_tbl):
                                old_tbl = old_tables[i] if i < len(old_tables) else {}
                                new_tbl = new_tables[i] if i < len(new_tables) else {}
                                if not old_tbl and not new_tbl: continue
                                
                                tbl_diff = compute_table_diff(old_tbl, new_tbl)
                                diff_result["tables"].append(tbl_diff)
                            
                            has_changes = (
                                len(diff_result["added"]) > 0 or
                                len(diff_result["removed"]) > 0 or
                                len(diff_result["modified"]) > 0 or
                                any(
                                    len(t.get("added_keys", [])) > 0 or len(t.get("removed_keys", [])) > 0 or len(t.get("modified_keys", [])) > 0 or len(t.get("header_changes", [])) > 0
                                    for t in diff_result.get("tables", [])
                                )
                            )
                            
                            if not has_changes:
                                monitor.last_checked_at = check_now
                                monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                                monitor.last_error = None
                                monitor.status = "active"
                                db.commit()
                            else:
                                print("[ELEMENT CHECK] Changes detected")
                                
                                current_raw_page_filename = f"{timestamp_str}_raw_page.png"
                                current_raw_page_path_absolute = os.path.join(screenshot_dir, current_raw_page_filename)
                                try:
                                    page.screenshot(path=current_raw_page_path_absolute, full_page=True)
                                    current_raw_page_path_relative = f"screenshots/{monitor.id}/{current_raw_page_filename}"
                                except Exception as se:
                                    current_raw_page_path_relative = None
                                    
                                old_page_annotated_relative = None
                                if monitor.last_page_screenshot_path:
                                    old_page_filename = f"{timestamp_str}_old_page_annotated.png"
                                    old_page_path_absolute = os.path.join(screenshot_dir, old_page_filename)
                                    old_source_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                    if os.path.exists(old_source_abs):
                                        shutil.copy(old_source_abs, old_page_path_absolute)
                                        old_page_annotated_relative = f"screenshots/{monitor.id}/{old_page_filename}"
                                        
                                        try:
                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_page_path_absolute).convert('RGBA')
                                            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                            draw_overlay = ImageDraw.Draw(overlay)
                                            drawn_any = False
                                            
                                            for item in diff_result["removed"]:
                                                bx = item.get("box", {})
                                                if bx:
                                                    x, y, w, h = bx.get("x",0), bx.get("y",0), bx.get("width",0), bx.get("height",0)
                                                    draw_overlay.rectangle([x, y, x+w, y+h], fill=(255, 0, 0, 40), outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                            for mod in diff_result["modified"]:
                                                bx = mod["old"].get("box", {})
                                                if bx:
                                                    x, y, w, h = bx.get("x",0), bx.get("y",0), bx.get("width",0), bx.get("height",0)
                                                    draw_overlay.rectangle([x, y, x+w, y+h], outline=(255, 255, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                            for idx_t, tbl_diff in enumerate(diff_result.get("tables", [])):
                                                if idx_t < len(old_tables):
                                                    old_table_data = old_tables[idx_t].get("table", old_tables[idx_t])
                                                    old_by_key = {r["key"]: r for r in old_table_data.get("rows", [])}
                                                    for r_key in tbl_diff.get("removed_keys", []):
                                                        if r_key in old_by_key:
                                                            r_box = old_by_key[r_key].get("box")
                                                            if r_box:
                                                                rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                                draw_overlay.rectangle([rx, ry, rx+rw, ry+rh], fill=(255, 0, 0, 40), outline=(255, 0, 0, 255), width=4)
                                                                drawn_any = True
                                                    for m_key in tbl_diff.get("modified_keys", []):
                                                        if m_key in old_by_key:
                                                            old_row = old_by_key[m_key]
                                                            detail = next((d for d in tbl_diff.get("modified_details", []) if d["key"] == m_key), None)
                                                            m_cell_boxes = old_row.get("cell_boxes", [])
                                                            cell_drawn = False
                                                            if detail and m_cell_boxes:
                                                                for ch in detail.get("changes", []):
                                                                    c_idx = ch.get("index")
                                                                    if c_idx is not None and c_idx < len(m_cell_boxes):
                                                                        c_box = m_cell_boxes[c_idx]
                                                                        cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                                        draw_overlay.rectangle([cx, cy, cx+cw, cy+ch_h], outline=(255, 0, 0, 255), width=4)
                                                                        cell_drawn = True
                                                                        drawn_any = True
                                                            if not cell_drawn:
                                                                r_box = old_row.get("box")
                                                                if r_box:
                                                                    rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                                    draw_overlay.rectangle([rx, ry, rx+rw, ry+rh], outline=(255, 0, 0, 255), width=4)
                                                                    drawn_any = True
                                                    old_header_boxes = old_table_data.get("header_boxes") or []
                                                    for hc in tbl_diff.get("header_changes", []):
                                                        h_idx = hc.get("index")
                                                        if h_idx is not None and h_idx < len(old_header_boxes):
                                                            h_box = old_header_boxes[h_idx]
                                                            hx, hy, hw, hh = h_box['x'], h_box['y'], h_box['width'], h_box['height']
                                                            draw_overlay.rectangle([hx, hy, hx+hw, hy+hh], outline=(255, 0, 0, 255), width=4)
                                                            drawn_any = True
                                                    

                                            if drawn_any:
                                                img = Image.alpha_composite(img, overlay)
                                                img.convert('RGB').save(old_page_path_absolute)
                                        except Exception as draw_err:
                                            print(f"Old element drawing failed: {draw_err}")
                                            
                                new_page_annotated_relative = None
                                if current_raw_page_path_relative:
                                    new_page_filename = f"{timestamp_str}_new_page_annotated.png"
                                    new_page_path_absolute = os.path.join(screenshot_dir, new_page_filename)
                                    shutil.copy(current_raw_page_path_absolute, new_page_path_absolute)
                                    new_page_annotated_relative = f"screenshots/{monitor.id}/{new_page_filename}"
                                    
                                    try:
                                        from PIL import Image, ImageDraw
                                        img = Image.open(new_page_path_absolute).convert('RGBA')
                                        overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                        draw_overlay = ImageDraw.Draw(overlay)
                                        drawn_any = False
                                        
                                        for item in diff_result["added"]:
                                            bx = item.get("box", {})
                                            if bx:
                                                x, y, w, h = bx.get("x",0), bx.get("y",0), bx.get("width",0), bx.get("height",0)
                                                draw_overlay.rectangle([x, y, x+w, y+h], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                        for mod in diff_result["modified"]:
                                            bx = mod["new"].get("box", {})
                                            if bx:
                                                x, y, w, h = bx.get("x",0), bx.get("y",0), bx.get("width",0), bx.get("height",0)
                                                draw_overlay.rectangle([x, y, x+w, y+h], outline=(255, 255, 0, 255), width=4)
                                                drawn_any = True
                                                
                                        for idx_t, tbl_diff in enumerate(diff_result.get("tables", [])):
                                            if idx_t < len(new_tables):
                                                new_table_data = new_tables[idx_t].get("table", new_tables[idx_t])
                                                new_by_key = {r["key"]: r for r in new_table_data.get("rows", [])}
                                                for a_key in tbl_diff.get("added_keys", []):
                                                    if a_key in new_by_key:
                                                        r_box = new_by_key[a_key].get("box")
                                                        if r_box:
                                                            rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                            draw_overlay.rectangle([rx, ry, rx+rw, ry+rh], outline=(255, 255, 0, 255), width=4)
                                                            drawn_any = True
                                                for m_key in tbl_diff.get("modified_keys", []):
                                                    if m_key in new_by_key:
                                                        new_row = new_by_key[m_key]
                                                        detail = next((d for d in tbl_diff.get("modified_details", []) if d["key"] == m_key), None)
                                                        m_cell_boxes = new_row.get("cell_boxes", [])
                                                        cell_drawn = False
                                                        if detail and m_cell_boxes:
                                                            for ch in detail.get("changes", []):
                                                                c_idx = ch.get("index")
                                                                if c_idx is not None and c_idx < len(m_cell_boxes):
                                                                    c_box = m_cell_boxes[c_idx]
                                                                    cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                                    draw_overlay.rectangle([cx, cy, cx+cw, cy+ch_h], outline=(0, 255, 0, 255), width=4)
                                                                    cell_drawn = True
                                                                    drawn_any = True
                                                        if not cell_drawn:
                                                            r_box = new_row.get("box")
                                                            if r_box:
                                                                rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                                draw_overlay.rectangle([rx, ry, rx+rw, ry+rh], outline=(0, 255, 0, 255), width=4)
                                                                drawn_any = True
                                                new_header_boxes = new_table_data.get("header_boxes") or []
                                                for hc in tbl_diff.get("header_changes", []):
                                                    h_idx = hc.get("index")
                                                    if h_idx is not None and h_idx < len(new_header_boxes):
                                                        h_box = new_header_boxes[h_idx]
                                                        hx, hy, hw, hh = h_box['x'], h_box['y'], h_box['width'], h_box['height']
                                                        draw_overlay.rectangle([hx, hy, hx+hw, hy+hh], outline=(0, 255, 0, 255), width=4)
                                                        drawn_any = True
                                                
                                        if drawn_any:
                                            img = Image.alpha_composite(img, overlay)
                                            img.convert('RGB').save(new_page_path_absolute)
                                    except Exception as draw_err:
                                        print(f"New element drawing failed: {draw_err}")
                                        
                                diff_lines = []
                                for item in diff_result["added"]:
                                    diff_lines.append(f"Added {item.get('tag', 'item')}: {item.get('content') or item.get('src')}")
                                for item in diff_result["removed"]:
                                    diff_lines.append(f"Removed {item.get('tag', 'item')}: {item.get('content') or item.get('src')}")
                                for mod in diff_result["modified"]:
                                    tag = mod['old'].get('tag', 'item')
                                    diff_lines.append(f"Modified {tag}:\n{mod['old'].get('content') or mod['old'].get('src')}\n→\n{mod['new'].get('content') or mod['new'].get('src')}\n")
                                    
                                for t_idx, t_diff in enumerate(diff_result.get("tables", [])):
                                    old_tbl = old_tables[t_idx] if t_idx < len(old_tables) else {}
                                    new_tbl = new_tables[t_idx] if t_idx < len(new_tables) else {}
                                    
                                    old_table_data = old_tbl.get("table", old_tbl) if isinstance(old_tbl, dict) else {}
                                    new_table_data = new_tbl.get("table", new_tbl) if isinstance(new_tbl, dict) else {}
                                    
                                    old_by_key = {r["key"]: r for r in old_table_data.get("rows", [])}
                                    new_by_key = {r["key"]: r for r in new_table_data.get("rows", [])}
                                    
                                    for hc in t_diff.get("header_changes", []):
                                        diff_lines.append(f"Table {t_idx+1} Modified Header:\n{hc['old']}\n→\n{hc['new']}\n")
                                        
                                    for r_key in t_diff.get("added_keys", []):
                                        if r_key in new_by_key:
                                            diff_lines.append(f"Table {t_idx+1} Added Row:\n{new_by_key[r_key].get('text', '')}\n")
                                    for r_key in t_diff.get("removed_keys", []):
                                        if r_key in old_by_key:
                                            diff_lines.append(f"Table {t_idx+1} Removed Row:\n{old_by_key[r_key].get('text', '')}\n")
                                    for m_key in t_diff.get("modified_keys", []):
                                        detail = next((d for d in t_diff.get("modified_details", []) if d["key"] == m_key), None)
                                        if detail:
                                            for ch in detail.get("changes", []):
                                                diff_lines.append(f"Table {t_idx+1} Modified Cell:\n{ch['old']}\n→\n{ch['new']}\n")
                                        else:
                                            diff_lines.append(f"Table {t_idx+1} Modified Row:\n{m_key}\n")
                                
                                diff_summary_json = "\n\n".join(diff_lines).strip()
                                
                                event = models.ChangeEvent(
                                    monitor_id=monitor.id,
                                    old_value=new_data.get("raw_text", ""),
                                    new_value=new_data.get("raw_text", ""),
                                    change_type="element",
                                    diff_summary=diff_summary_json,
                                    old_page_screenshot_path=old_page_annotated_relative,
                                    new_page_screenshot_path=new_page_annotated_relative,
                                    old_element_screenshot_path=None,
                                    new_element_screenshot_path=None,
                                    changed_fragment=diff_summary_json,
                                    detected_at=datetime.utcnow()
                                )
                                db.add(event)
                                
                                if monitor.last_page_screenshot_path:
                                    try:
                                        old_raw_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                        if os.path.exists(old_raw_abs):
                                            os.remove(old_raw_abs)
                                    except:
                                        pass
                                        
                                monitor.last_value = json.dumps(new_data)
                                monitor.last_page_screenshot_path = current_raw_page_path_relative
                                monitor.last_checked_at = check_now
                                monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                                db.commit()

                    elif monitor_type == "table":
                        print("[TABLE MODE ACTIVE]")
                        print("Monitor:", monitor.name)
                        # Table monitoring path
                        table_locator = locator.first
                        
                        new_table = extract_table_structure(table_locator)
                        if not new_table:
                            raise ValueError("Failed to extract table structure")
                            
                        text_content = locator.first.text_content()
                        if text_content is None:
                            text_content = ""
                        current_text_value = text_content.strip()

                        new_value_dict = {
                            "text": current_text_value,
                            "table": new_table
                        }
                            
                        print("[TABLE STRUCTURE]")
                        table_data = new_table.get("table", new_table)
                        print("Headers:", table_data.get("headers", []))
                        print("Rows:", len(table_data.get("rows", [])))
                        
                        # Generate clean text snapshot of the table for dashboard preview
                        headers_str = " | ".join(table_data.get("headers", []))
                        rows_lines = []
                        for row in table_data.get("rows", []):
                            rows_lines.append(row.get("text", ""))
                        text_snapshot = f"Headers: {headers_str}\n" + "\n".join(rows_lines)
                        
                        old_value = monitor.last_value or ""
                        is_first_check = monitor.last_page_screenshot_path is None
                        
                        backend_dir = os.path.dirname(os.path.abspath(__file__))
                        timestamp_str = check_now.strftime("%Y%m%d_%H%M%S")
                        screenshot_dir = os.path.join(backend_dir, "screenshots", monitor.id)
                        os.makedirs(screenshot_dir, exist_ok=True)
                        
                        if is_first_check:
                            # Capture baseline screenshots
                            raw_page_filename = f"{timestamp_str}_raw_page.png"
                            raw_page_path_absolute = os.path.join(screenshot_dir, raw_page_filename)
                            raw_element_filename = f"{timestamp_str}_raw_element.png"
                            raw_element_path_absolute = os.path.join(screenshot_dir, raw_element_filename)
                            
                            try:
                                page.screenshot(path=raw_page_path_absolute, full_page=True)
                                monitor.last_page_screenshot_path = f"screenshots/{monitor.id}/{raw_page_filename}"
                            except Exception as se:
                                print(f"Failed to capture baseline page screenshot: {se}")
                                monitor.last_page_screenshot_path = None

                            try:
                                table_locator.evaluate("""el => {
                                    window.__domMonitorOriginalStyles = [];
                                    let current = el;
                                    while(current && current !== document.body) {
                                        const style = window.getComputedStyle(current);
                                        let isScrollable = style.overflow.includes('auto') || style.overflow.includes('scroll') || style.overflowY.includes('auto') || style.overflowY.includes('scroll');
                                        let isFixed = style.position === 'fixed' || style.position === 'sticky';
                                        if (isScrollable || isFixed) {
                                            window.__domMonitorOriginalStyles.push({
                                                element: current,
                                                overflow: current.style.getPropertyValue('overflow'),
                                                overflowPriority: current.style.getPropertyPriority('overflow'),
                                                overflowY: current.style.getPropertyValue('overflow-y'),
                                                overflowYPriority: current.style.getPropertyPriority('overflow-y'),
                                                maxHeight: current.style.getPropertyValue('max-height'),
                                                maxHeightPriority: current.style.getPropertyPriority('max-height'),
                                                height: current.style.getPropertyValue('height'),
                                                heightPriority: current.style.getPropertyPriority('height'),
                                                position: current.style.getPropertyValue('position'),
                                                positionPriority: current.style.getPropertyPriority('position')
                                            });
                                            if (isScrollable) {
                                                current.style.setProperty('overflow', 'visible', 'important');
                                                current.style.setProperty('overflow-y', 'visible', 'important');
                                                current.style.setProperty('max-height', 'none', 'important');
                                                current.style.setProperty('height', 'auto', 'important');
                                            }
                                            if (isFixed) {
                                                current.style.setProperty('position', 'absolute', 'important');
                                            }
                                        }
                                        current = current.parentElement;
                                    }
                                }""")
                                page.wait_for_timeout(500)
                            except Exception as e:
                                print(f"Failed to expand table parents for baseline: {e}")

                            try:
                                table_locator.screenshot(path=raw_element_path_absolute)
                                monitor.last_element_screenshot_path = f"screenshots/{monitor.id}/{raw_element_filename}"
                            except Exception as se:
                                print(f"Failed to capture baseline element screenshot: {se}")
                                monitor.last_element_screenshot_path = None
                                
                            try:
                                page.evaluate("""() => {
                                    if (window.__domMonitorOriginalStyles) {
                                        for (const item of window.__domMonitorOriginalStyles) {
                                            item.element.style.setProperty('overflow', item.overflow, item.overflowPriority);
                                            item.element.style.setProperty('overflow-y', item.overflowY, item.overflowYPriority);
                                            item.element.style.setProperty('max-height', item.maxHeight, item.maxHeightPriority);
                                            item.element.style.setProperty('height', item.height, item.heightPriority);
                                            item.element.style.setProperty('position', item.position, item.positionPriority);
                                        }
                                        delete window.__domMonitorOriginalStyles;
                                    }
                                }""")
                            except Exception as e:
                                print(f"Failed to restore table parents for baseline: {e}")
                                
                            new_table_recalc = extract_table_structure(table_locator)
                            if new_table_recalc:
                                new_value_dict["table"] = new_table_recalc
                            monitor.last_value = json.dumps(new_value_dict)
                            monitor.text_snapshot = text_snapshot
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            db.commit()
                            
                        else:
                            # Not first check: parse old table, compute diff
                            try:
                                old_value_dict = json.loads(old_value)
                                if "table" in old_value_dict and "text" in old_value_dict:
                                    old_table = old_value_dict["table"]
                                    old_text = old_value_dict["text"]
                                else:
                                    # Migration from pure table structure
                                    old_table = old_value_dict
                                    old_text = ""
                            except Exception:
                                old_table = {"headers": [], "rows": []}
                                old_text = ""
                                
                            diff_result = compute_table_diff(old_table, new_table)
                            text_change_type, text_diff_summary = diff_engine.calculate_diff(old_text, current_text_value)
                            text_changed_fragment = diff_engine.get_changed_fragment(old_text, current_text_value)
                            
                            has_table_changes = (
                                len(diff_result["added_keys"]) > 0 or
                                len(diff_result["removed_keys"]) > 0 or
                                len(diff_result["modified_keys"]) > 0 or
                                len(diff_result.get("header_changes", [])) > 0 or
                                bool(diff_result.get("title_change"))
                            )
                            has_text_changes = old_text != current_text_value
                            has_changes = has_table_changes or has_text_changes
                            
                            if not has_changes:
                                monitor.last_checked_at = check_now
                                monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                                monitor.last_error = None
                                monitor.status = "active"
                                db.commit()
                            else:
                                # We have changes!
                                print(f"[TABLE CHECK] Changes detected: Added={len(diff_result['added_keys'])}, Removed={len(diff_result['removed_keys'])}, Modified={len(diff_result['modified_keys'])}, TextChanged={has_text_changes}")
                                
                                old_table_data = old_table.get("table", old_table)
                                new_table_data = new_table.get("table", new_table)
                                old_by_key = {r["key"]: r for r in old_table_data.get("rows", [])}
                                new_by_key = {r["key"]: r for r in new_table_data.get("rows", [])}
                                
                                # 1. Find the target row to focus on for the screenshot
                                target_key = None
                                change_type = None
                                
                                if diff_result["added_keys"]:
                                    target_key = diff_result["added_keys"][0]
                                    change_type = "added"
                                elif diff_result["modified_keys"]:
                                    target_key = diff_result["modified_keys"][0]
                                    change_type = "modified"
                                elif diff_result["removed_keys"]:
                                    # For removed rows, find its previous index in old_table, and try to find a nearby row in new_table
                                    removed_key = diff_result["removed_keys"][0]
                                    old_rows = old_table_data.get("rows", [])
                                    idx = next((i for i, r in enumerate(old_rows) if r["key"] == removed_key), -1)
                                    if idx != -1:
                                        # Try to find the row that was just before it, or just after it
                                        new_rows = new_table_data.get("rows", [])
                                        # It might be at the same index, or index - 1
                                        target_idx = min(idx, len(new_rows) - 1)
                                        if target_idx >= 0:
                                            target_key = new_rows[target_idx]["key"]
                                    if not target_key and new_table_data.get("rows"):
                                        target_key = new_table_data["rows"][-1]["key"]
                                    change_type = "removed"
                                    
                                print("[TARGET ROW]")
                                print(target_key)
                                    
                                coords = None
                                if target_key:
                                    coords = scroll_to_row_and_get_coords(page, table_locator, target_key)
                                elif diff_result.get("header_changes"):
                                    coords = scroll_to_header_and_get_coords(page, table_locator)
                                
                                print("[ROW TARGET]")
                                print(target_key)
                                print("[ROW BOX]")
                                bounding_box = coords.get("box") if coords else None
                                print(bounding_box)
                                scroll_y = page.evaluate("window.scrollY")
                                print("[SCROLL Y]", scroll_y)

                                print("[SCREENSHOT CAPTURE]")
                                print("Changed Row Box:", coords.get("box") if coords else None)
                                
                                # 2. Capture new screenshots immediately after scrolling and layout stabilization
                                current_raw_page_filename = f"{timestamp_str}_raw_page.png"
                                current_raw_page_path_absolute = os.path.join(screenshot_dir, current_raw_page_filename)
                                current_raw_element_filename = f"{timestamp_str}_raw_element.png"
                                current_raw_element_path_absolute = os.path.join(screenshot_dir, current_raw_element_filename)
                                
                                try:
                                    page.screenshot(path=current_raw_page_path_absolute, full_page=True)
                                    current_raw_page_path_relative = f"screenshots/{monitor.id}/{current_raw_page_filename}"
                                    screenshot_path = current_raw_page_path_absolute
                                    print("[SCREENSHOT SAVE]")
                                    print("Path:", screenshot_path)
                                    print("Exists:", os.path.exists(screenshot_path))
                                except Exception as se:
                                    print(f"Failed to capture current raw page screenshot: {se}")
                                    current_raw_page_path_relative = None

                                try:
                                    table_locator.evaluate("""el => {
                                        window.__domMonitorOriginalStyles = [];
                                        let current = el;
                                        while(current && current !== document.body) {
                                            const style = window.getComputedStyle(current);
                                            let isScrollable = style.overflow.includes('auto') || style.overflow.includes('scroll') || style.overflowY.includes('auto') || style.overflowY.includes('scroll');
                                            let isFixed = style.position === 'fixed' || style.position === 'sticky';
                                            if (isScrollable || isFixed) {
                                                window.__domMonitorOriginalStyles.push({
                                                    element: current,
                                                    overflow: current.style.getPropertyValue('overflow'),
                                                    overflowPriority: current.style.getPropertyPriority('overflow'),
                                                    overflowY: current.style.getPropertyValue('overflow-y'),
                                                    overflowYPriority: current.style.getPropertyPriority('overflow-y'),
                                                    maxHeight: current.style.getPropertyValue('max-height'),
                                                    maxHeightPriority: current.style.getPropertyPriority('max-height'),
                                                    height: current.style.getPropertyValue('height'),
                                                    heightPriority: current.style.getPropertyPriority('height'),
                                                    position: current.style.getPropertyValue('position'),
                                                    positionPriority: current.style.getPropertyPriority('position')
                                                });
                                                if (isScrollable) {
                                                    current.style.setProperty('overflow', 'visible', 'important');
                                                    current.style.setProperty('overflow-y', 'visible', 'important');
                                                    current.style.setProperty('max-height', 'none', 'important');
                                                    current.style.setProperty('height', 'auto', 'important');
                                                }
                                                if (isFixed) {
                                                    current.style.setProperty('position', 'absolute', 'important');
                                                }
                                            }
                                            current = current.parentElement;
                                        }
                                    }""")
                                    page.wait_for_timeout(500)
                                except Exception as e:
                                    print(f"Failed to expand table parents for change screenshot: {e}")

                                try:
                                    table_locator.screenshot(path=current_raw_element_path_absolute)
                                    current_raw_element_path_relative = f"screenshots/{monitor.id}/{current_raw_element_filename}"
                                    screenshot_path = current_raw_element_path_absolute
                                    print("[SCREENSHOT SAVE]")
                                    print("Path:", screenshot_path)
                                    print("Exists:", os.path.exists(screenshot_path))
                                except Exception as se:
                                    print(f"Failed to capture current raw element screenshot: {se}")
                                    current_raw_element_path_relative = None
                                    
                                try:
                                    page.evaluate("""() => {
                                        if (window.__domMonitorOriginalStyles) {
                                            for (const item of window.__domMonitorOriginalStyles) {
                                                item.element.style.setProperty('overflow', item.overflow, item.overflowPriority);
                                                item.element.style.setProperty('overflow-y', item.overflowY, item.overflowYPriority);
                                                item.element.style.setProperty('max-height', item.maxHeight, item.maxHeightPriority);
                                                item.element.style.setProperty('height', item.height, item.heightPriority);
                                                item.element.style.setProperty('position', item.position, item.positionPriority);
                                            }
                                            delete window.__domMonitorOriginalStyles;
                                        }
                                    }""")
                                except Exception as e:
                                    print(f"Failed to restore table parents for change screenshot: {e}")
                                    
                                # 3. Generate Old Annotated Page Screenshot
                                old_page_annotated_relative = None
                                if monitor.last_page_screenshot_path:
                                    old_page_filename = f"{timestamp_str}_old_page_annotated.png"
                                    old_page_path_absolute = os.path.join(screenshot_dir, old_page_filename)
                                    old_source_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                    
                                    if os.path.exists(old_source_abs):
                                        shutil.copy(old_source_abs, old_page_path_absolute)
                                        old_page_annotated_relative = f"screenshots/{monitor.id}/{old_page_filename}"
                                        
                                        try:
                                            from PIL import Image, ImageDraw
                                            img = Image.open(old_page_path_absolute).convert('RGBA')
                                            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                            draw_overlay = ImageDraw.Draw(overlay)
                                            drawn_any = False
                                            
                                            # OLD PAGE SCREENSHOT DRAWING RULES:
                                            # 1. Removed Rows -> RED outline + light red fill
                                            for r_key in diff_result["removed_keys"]:
                                                if r_key in old_by_key:
                                                    r_box = old_by_key[r_key].get("box")
                                                    if r_box:
                                                        rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                        draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], fill=(255, 0, 0, 40), outline=(255, 0, 0, 255), width=4)
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
                                            old_header_boxes = old_table_data.get("header_boxes") or []
                                            for hc in diff_result.get("header_changes", []):
                                                h_idx = hc.get("index")
                                                if h_idx is not None and h_idx < len(old_header_boxes):
                                                    h_box = old_header_boxes[h_idx]
                                                    hx, hy, hw, hh = h_box['x'], h_box['y'], h_box['width'], h_box['height']
                                                    draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                            # 4. Modified Title -> RED outline
                                            if diff_result.get("title_change"):
                                                t_box = old_table.get("container_title_box")
                                                if t_box:
                                                    tx, ty, tw, th_h = t_box['x'], t_box['y'], t_box['width'], t_box['height']
                                                    draw_overlay.rectangle([tx, ty, tx + tw, ty + th_h], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                            # 5. Modified Container Text -> RED outline
                                            if diff_result.get("container_text_change"):
                                                c_box = old_table.get("container_box")
                                                if c_box:
                                                    cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                    draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                            if drawn_any:
                                                img = Image.alpha_composite(img, overlay)
                                                img.convert('RGB').save(old_page_path_absolute)
                                        except Exception as draw_err:
                                            print(f"[TABLE WARNING] Old page coordinate drawing failed: {draw_err}")
                                            
                                # 4. Generate New Annotated Page Screenshot
                                new_page_annotated_relative = None
                                if current_raw_page_path_relative:
                                    new_page_filename = f"{timestamp_str}_new_page_annotated.png"
                                    new_page_path_absolute = os.path.join(screenshot_dir, new_page_filename)
                                    shutil.copy(current_raw_page_path_absolute, new_page_path_absolute)
                                    new_page_annotated_relative = f"screenshots/{monitor.id}/{new_page_filename}"
                                    
                                    try:
                                        from PIL import Image, ImageDraw
                                        img = Image.open(new_page_path_absolute).convert('RGBA')
                                        overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                        draw_overlay = ImageDraw.Draw(overlay)
                                        drawn_any = False
                                        
                                        # NEW PAGE SCREENSHOT DRAWING RULES:
                                        # 1. Added Rows -> YELLOW
                                        for a_key in diff_result["added_keys"]:
                                            if a_key in new_by_key:
                                                r_box = new_by_key[a_key].get("box")
                                                if r_box:
                                                    rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                    draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], outline=(255, 255, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                        # 2. Modified Rows/Cells -> GREEN outline (new location)
                                        for m_key in diff_result["modified_keys"]:
                                            if m_key in new_by_key:
                                                new_row = new_by_key[m_key]
                                                detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                                m_cell_boxes = new_row.get("cell_boxes", [])
                                                
                                                cell_drawn = False
                                                if detail and m_cell_boxes:
                                                    for ch in detail.get("changes", []):
                                                        c_idx = ch.get("index")
                                                        if c_idx is not None and c_idx < len(m_cell_boxes):
                                                            c_box = m_cell_boxes[c_idx]
                                                            cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                            draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(0, 255, 0, 255), width=4)
                                                            cell_drawn = True
                                                            drawn_any = True
                                                if not cell_drawn:
                                                     r_box = new_row.get("box")
                                                     if r_box:
                                                         rx, ry, rw, rh = r_box['x'], r_box['y'], r_box['width'], r_box['height']
                                                         draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], outline=(0, 255, 0, 255), width=4)
                                                         drawn_any = True
                                                         
                                        # 3. Modified Headers -> GREEN outline (new header cell)
                                        new_header_boxes = new_table_data.get("header_boxes") or []
                                        for hc in diff_result.get("header_changes", []):
                                            h_idx = hc.get("index")
                                            if h_idx is not None and h_idx < len(new_header_boxes):
                                                h_box = new_header_boxes[h_idx]
                                                hx, hy, hw, hh = h_box['x'], h_box['y'], h_box['width'], h_box['height']
                                                draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                    
                                        # 4. Modified Title -> GREEN outline
                                        if diff_result.get("title_change"):
                                            t_box = new_table.get("container_title_box")
                                            if t_box:
                                                tx, ty, tw, th_h = t_box['x'], t_box['y'], t_box['width'], t_box['height']
                                                draw_overlay.rectangle([tx, ty, tx + tw, ty + th_h], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                
                                        # 5. Modified Container Text -> GREEN outline
                                        if diff_result.get("container_text_change"):
                                            c_box = new_table.get("container_box")
                                            if c_box:
                                                cx, cy, cw, ch_h = c_box['x'], c_box['y'], c_box['width'], c_box['height']
                                                draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                    
                                        if drawn_any:
                                            img = Image.alpha_composite(img, overlay)
                                            img.convert('RGB').save(new_page_path_absolute)
                                    except Exception as draw_err:
                                        print(f"[TABLE WARNING] New page coordinate drawing failed: {draw_err}")
                                        
                                # 4.5 Generate Old Element Screenshot
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
                                            img = Image.open(old_element_path_absolute).convert('RGBA')
                                            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                            draw_overlay = ImageDraw.Draw(overlay)
                                            drawn_any = False
                                             
                                            table_x = min([r.get("box", {}).get("x", 0) for r in old_table.get("rows", []) if r.get("box")], default=0)
                                            table_y = min([r.get("box", {}).get("y", 0) for r in old_table.get("rows", []) if r.get("box")], default=0) - 40
                                             
                                            # OLD ELEMENT SCREENSHOT DRAWING RULES:
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
                                            old_header_boxes = old_table_data.get("header_boxes") or []
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

                                            # 4. Modified Title -> RED outline
                                            if diff_result.get("title_change"):
                                                t_box = old_table.get("container_title_box")
                                                if t_box:
                                                    eb = t_box.get("element_box")
                                                    if eb:
                                                        tx, ty, tw, th_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                    else:
                                                        tx = max(0, t_box['x'] - table_x)
                                                        ty = max(0, t_box['y'] - (table_y + 40))
                                                        tw, th_h = t_box['width'], t_box['height']
                                                    draw_overlay.rectangle([tx, ty, tx + tw, ty + th_h], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                    
                                            # 5. Modified Container Text -> RED outline
                                            if diff_result.get("container_text_change"):
                                                c_box = old_table.get("container_box")
                                                if c_box:
                                                    eb = c_box.get("element_box")
                                                    if eb:
                                                        cx, cy, cw, ch_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                    else:
                                                        cx = max(0, c_box['x'] - table_x)
                                                        cy = max(0, c_box['y'] - (table_y + 40))
                                                        cw, ch_h = c_box['width'], c_box['height']
                                                    draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                     
                                            if drawn_any:
                                                img = Image.alpha_composite(img, overlay)
                                                img.convert('RGB').save(old_element_path_absolute)
                                        except Exception as draw_err:
                                            print(f"[TABLE WARNING] Old element coordinate drawing failed: {draw_err}")
                                            
                                # 4.6 Generate New Element Screenshot
                                new_element_relative = None
                                if current_raw_element_path_relative:
                                    new_element_filename = f"{timestamp_str}_new_element.png"
                                    new_element_path_absolute = os.path.join(screenshot_dir, new_element_filename)
                                    shutil.copy(current_raw_element_path_absolute, new_element_path_absolute)
                                    new_element_relative = f"screenshots/{monitor.id}/{new_element_filename}"
                                    
                                    try:
                                        from PIL import Image, ImageDraw
                                        img = Image.open(new_element_path_absolute).convert('RGBA')
                                        overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                                        draw_overlay = ImageDraw.Draw(overlay)
                                        drawn_any = False
                                         
                                        table_x = min([r.get("box", {}).get("x", 0) for r in new_table.get("rows", []) if r.get("box")], default=0)
                                        table_y = min([r.get("box", {}).get("y", 0) for r in new_table.get("rows", []) if r.get("box")], default=0) - 40
                                         
                                        # NEW ELEMENT SCREENSHOT DRAWING RULES:
                                        # 1. Added Rows -> YELLOW
                                        for a_key in diff_result["added_keys"]:
                                            if a_key in new_by_key:
                                                new_row = new_by_key[a_key]
                                                eb = new_row.get("element_box")
                                                r_box = new_row.get("box")
                                                if eb:
                                                    rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                elif r_box:
                                                    rx = max(0, r_box['x'] - table_x)
                                                    ry = max(0, r_box['y'] - table_y)
                                                    rw, rh = r_box['width'], r_box['height']
                                                else:
                                                    continue
                                                draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], outline=(255, 255, 0, 255), width=4)
                                                drawn_any = True
                                                 
                                        # 2. Modified Rows/Cells -> GREEN outline
                                        for m_key in diff_result["modified_keys"]:
                                            if m_key in new_by_key:
                                                new_row = new_by_key[m_key]
                                                detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                                m_cell_boxes = new_row.get("cell_boxes", [])
                                                 
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
                                                            draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(0, 255, 0, 255), width=4)
                                                            cell_drawn = True
                                                            drawn_any = True
                                                if not cell_drawn:
                                                    eb = new_row.get("element_box")
                                                    r_box = new_row.get("box")
                                                    if eb:
                                                        rx, ry, rw, rh = eb['x'], eb['y'], eb['width'], eb['height']
                                                    elif r_box:
                                                        rx = max(0, r_box['x'] - table_x)
                                                        ry = max(0, r_box['y'] - table_y)
                                                        rw, rh = r_box['width'], r_box['height']
                                                    else:
                                                        continue
                                                    draw_overlay.rectangle([rx, ry, rx + rw, ry + rh], outline=(0, 255, 0, 255), width=4)
                                                    drawn_any = True
                                                     
                                        # 3. Modified Headers -> GREEN outline
                                        new_header_boxes = new_table_data.get("header_boxes") or []
                                        for hc in diff_result.get("header_changes", []):
                                            h_idx = hc.get("index")
                                            if h_idx is not None and h_idx < len(new_header_boxes):
                                                h_box = new_header_boxes[h_idx]
                                                eb = h_box.get("element_box")
                                                if eb:
                                                    hx, hy, hw, hh = eb['x'], eb['y'], eb['width'], eb['height']
                                                else:
                                                    hx = max(0, h_box['x'] - table_x)
                                                    hy = max(0, h_box['y'] - (table_y + 40))
                                                    hw, hh = h_box['width'], h_box['height']
                                                draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                     
                                        # 4. Modified Title -> GREEN outline
                                        if diff_result.get("title_change"):
                                            t_box = new_table.get("container_title_box")
                                            if t_box:
                                                eb = t_box.get("element_box")
                                                if eb:
                                                    tx, ty, tw, th_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                else:
                                                    tx = max(0, t_box['x'] - table_x)
                                                    ty = max(0, t_box['y'] - (table_y + 40))
                                                    tw, th_h = t_box['width'], t_box['height']
                                                draw_overlay.rectangle([tx, ty, tx + tw, ty + th_h], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                
                                        # 5. Modified Container Text -> GREEN outline
                                        if diff_result.get("container_text_change"):
                                            c_box = new_table.get("container_box")
                                            if c_box:
                                                eb = c_box.get("element_box")
                                                if eb:
                                                    cx, cy, cw, ch_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                else:
                                                    cx = max(0, c_box['x'] - table_x)
                                                    cy = max(0, c_box['y'] - (table_y + 40))
                                                    cw, ch_h = c_box['width'], c_box['height']
                                                draw_overlay.rectangle([cx, cy, cx + cw, cy + ch_h], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True

                                        if drawn_any:
                                            img = Image.alpha_composite(img, overlay)
                                            img.convert('RGB').save(new_element_path_absolute)
                                    except Exception as draw_err:
                                        print(f"[TABLE WARNING] New element coordinate drawing failed: {draw_err}")

                                # 5. Create diff summary string for dashboard
                                diff_lines = []
                                
                                if diff_result.get("title_change"):
                                    tc = diff_result["title_change"]
                                    diff_lines.append(f"Modified Title:\n{tc['old']}\n→\n{tc['new']}\n")
                                    
                                if diff_result.get("container_text_change"):
                                    ctc = diff_result["container_text_change"]
                                    diff_lines.append(f"Modified Container Text:\n{ctc['old']}\n→\n{ctc['new']}\n")
                                    
                                for hc in diff_result.get("header_changes", []):
                                    diff_lines.append(f"Modified Header:\n{hc['old']}\n→\n{hc['new']}\n")
                                    
                                for m_key in diff_result["modified_keys"]:
                                    detail = next((d for d in diff_result["modified_details"] if d["key"] == m_key), None)
                                    if detail:
                                        for ch in detail.get("changes", []):
                                            diff_lines.append(f"Modified Cell:\n{ch['old']}\n→\n{ch['new']}\n")
                                            
                                for r_key in diff_result["removed_keys"]:
                                    if r_key in old_by_key:
                                        diff_lines.append(f"Removed Row:\n{old_by_key[r_key].get('text', '')}\n")
                                        
                                for a_key in diff_result["added_keys"]:
                                    if a_key in new_by_key:
                                        diff_lines.append(f"Added Row:\n{new_by_key[a_key].get('text', '')}\n")
                                        
                                diff_summary_json = "\n".join(diff_lines).strip()
                                changed_fragment = diff_summary_json
                                
                                # 6. Save Event to DB
                                print("[EVENT TYPE]", "table")
                                print("[DIFF SUMMARY SOURCE]")
                                print(diff_summary_json)
                                print("[EVENT SUMMARY]", diff_summary_json)
                                event = models.ChangeEvent(
                                    monitor_id=monitor.id,
                                    old_value=old_value,
                                    new_value=json.dumps(new_value_dict),
                                    change_type="table",
                                    diff_summary=diff_summary_json,
                                    old_page_screenshot_path=old_page_annotated_relative,
                                    new_page_screenshot_path=new_page_annotated_relative,
                                    old_element_screenshot_path=old_element_relative,
                                    new_element_screenshot_path=new_element_relative,
                                    changed_fragment=changed_fragment,
                                    detected_at=datetime.utcnow()
                                )
                                db.add(event)
                                print("[DB SCREENSHOT PATH]")
                                print(event.old_page_screenshot_path)
                                print(event.new_page_screenshot_path)
                                # Clean up old raw page/element files if any
                                if monitor.last_page_screenshot_path:
                                    try:
                                        old_raw_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                        if os.path.exists(old_raw_abs):
                                            os.remove(old_raw_abs)
                                    except Exception:
                                        pass
                                if monitor.last_element_screenshot_path:
                                    try:
                                        old_raw_el_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                        if os.path.exists(old_raw_el_abs):
                                            os.remove(old_raw_el_abs)
                                    except Exception:
                                        pass
                                        
                                # Update monitor attributes for future checks
                                new_table_recalc = extract_table_structure(table_locator)
                                if new_table_recalc:
                                    new_value_dict["table"] = new_table_recalc
                                monitor.last_value = json.dumps(new_value_dict)
                                monitor.text_snapshot = text_snapshot
                                monitor.last_page_screenshot_path = current_raw_page_path_relative
                                monitor.last_element_screenshot_path = current_raw_element_path_relative
                                monitor.last_checked_at = check_now
                                monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                                monitor.last_error = None
                                monitor.status = "active"
                                db.commit()
                                
                                print("[TABLE CHECK COMPLETED]")
                                
                    elif monitor_type == "image":
                        # Separate image monitoring path
                        # Read target image URL: first try src of IMG element, then try background-image
                        current_image_url = None
                        try:
                            el_tag = locator.first.evaluate("el => el.tagName")
                            if el_tag == "IMG":
                                current_image_url = locator.first.get_attribute("src")
                        except Exception:
                            pass
                        
                        if not current_image_url:
                            try:
                                bg = locator.first.evaluate("el => getComputedStyle(el).backgroundImage")
                                if bg and bg != "none":
                                    import re
                                    match = re.match(r'^url\((["\']?)(.*?)\1\)$', bg.strip(), re.IGNORECASE)
                                    if match:
                                        current_image_url = match.group(2)
                            except Exception:
                                pass
                        
                        if not current_image_url:
                            current_image_url = ""
                        
                        # Resolve relative URLs
                        from urllib.parse import urljoin
                        current_image_url = urljoin(page.url, current_image_url)
                        
                        old_url = monitor.last_value or ""
                        is_first_check = monitor.last_page_screenshot_path is None
                        
                        backend_dir = os.path.dirname(os.path.abspath(__file__))
                        timestamp_str = check_now.strftime("%Y%m%d_%H%M%S")
                        screenshot_dir = os.path.join(backend_dir, "screenshots", monitor.id)
                        os.makedirs(screenshot_dir, exist_ok=True)
                        
                        box_json = json.dumps(box) if box else None
                        
                        if is_first_check:
                            # Capture baseline raw page and element screenshots (no annotations)
                            raw_page_filename = f"{timestamp_str}_raw_page.png"
                            raw_page_path_absolute = os.path.join(screenshot_dir, raw_page_filename)
                            raw_element_filename = f"{timestamp_str}_raw_element.png"
                            raw_element_path_absolute = os.path.join(screenshot_dir, raw_element_filename)

                            try:
                                page.screenshot(path=raw_page_path_absolute, full_page=True)
                                monitor.last_page_screenshot_path = f"screenshots/{monitor.id}/{raw_page_filename}"
                            except Exception as se:
                                monitor.last_page_screenshot_path = None
                            
                            try:
                                locator.first.screenshot(path=raw_element_path_absolute)
                                monitor.last_element_screenshot_path = f"screenshots/{monitor.id}/{raw_element_filename}"
                            except Exception as se:
                                monitor.last_element_screenshot_path = None

                            monitor.last_bounding_box_json = box_json
                            monitor.last_value = current_image_url
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            db.commit()
                            
                        elif current_image_url == old_url:
                            # Value is unchanged
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            db.commit()
                            
                        else:
                            # Change detected!
                            change_type = "image"
                            diff_summary = f"Image URL changed: {old_url} → {current_image_url}"
                            
                            current_raw_page_filename = f"{timestamp_str}_raw_page.png"
                            current_raw_page_path_absolute = os.path.join(screenshot_dir, current_raw_page_filename)
                            current_raw_element_filename = f"{timestamp_str}_raw_element.png"
                            current_raw_element_path_absolute = os.path.join(screenshot_dir, current_raw_element_filename)

                            try:
                                page.screenshot(path=current_raw_page_path_absolute, full_page=True)
                                current_raw_page_path_relative = f"screenshots/{monitor.id}/{current_raw_page_filename}"
                            except Exception as se:
                                current_raw_page_path_relative = None
                                
                            try:
                                locator.first.screenshot(path=current_raw_element_path_absolute)
                                current_raw_element_path_relative = f"screenshots/{monitor.id}/{current_raw_element_filename}"
                            except Exception as se:
                                current_raw_element_path_relative = None

                            # Generate Old Annotated Page Screenshot (RED box)
                            old_page_annotated_relative = None
                            if monitor.last_page_screenshot_path:
                                old_page_filename = f"{timestamp_str}_old_page_annotated.png"
                                old_page_path_absolute = os.path.join(screenshot_dir, old_page_filename)
                                old_source_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                if os.path.exists(old_source_abs):
                                    shutil.copy(old_source_abs, old_page_path_absolute)
                                    old_page_annotated_relative = f"screenshots/{monitor.id}/{old_page_filename}"
                                    if monitor.last_bounding_box_json:
                                        try:
                                            old_box_coords = json.loads(monitor.last_bounding_box_json)
                                            if old_box_coords:
                                                from PIL import Image, ImageDraw
                                                img = Image.open(old_page_path_absolute)
                                                draw = ImageDraw.Draw(img)
                                                ox, oy, ow, oh = old_box_coords['x'], old_box_coords['y'], old_box_coords['width'], old_box_coords['height']
                                                draw.rectangle([ox, oy, ox + ow, oy + oh], outline="red", width=4)
                                                img.save(old_page_path_absolute)
                                        except Exception:
                                            pass

                            # Generate New Annotated Page Screenshot (GREEN box)
                            new_page_annotated_relative = None
                            if current_raw_page_path_relative:
                                new_page_filename = f"{timestamp_str}_new_page_annotated.png"
                                new_page_path_absolute = os.path.join(screenshot_dir, new_page_filename)
                                shutil.copy(current_raw_page_path_absolute, new_page_path_absolute)
                                new_page_annotated_relative = f"screenshots/{monitor.id}/{new_page_filename}"
                                if box:
                                    try:
                                        from PIL import Image, ImageDraw
                                        img = Image.open(new_page_path_absolute)
                                        draw = ImageDraw.Draw(img)
                                        nx, ny, nw, nh = box['x'], box['y'], box['width'], box['height']
                                        draw.rectangle([nx, ny, nx + nw, ny + nh], outline="green", width=4)
                                        img.save(new_page_path_absolute)
                                    except Exception:
                                        pass

                            # Generate Old Element Screenshot
                            old_element_relative = None
                            if monitor.last_element_screenshot_path:
                                old_element_filename = f"{timestamp_str}_old_element.png"
                                old_element_path_absolute = os.path.join(screenshot_dir, old_element_filename)
                                old_el_source_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                if os.path.exists(old_el_source_abs):
                                    shutil.copy(old_el_source_abs, old_element_path_absolute)
                                    old_element_relative = f"screenshots/{monitor.id}/{old_element_filename}"

                            # Generate New Element Screenshot
                            new_element_relative = None
                            if current_raw_element_path_relative:
                                new_element_filename = f"{timestamp_str}_new_element.png"
                                new_element_path_absolute = os.path.join(screenshot_dir, new_element_filename)
                                shutil.copy(current_raw_element_path_absolute, new_element_path_absolute)
                                new_element_relative = f"screenshots/{monitor.id}/{new_element_filename}"

                            # Save Event to DB
                            event = models.ChangeEvent(
                                monitor_id=monitor.id,
                                old_value=old_url,
                                new_value=current_image_url,
                                change_type=change_type,
                                diff_summary=diff_summary,
                                old_page_screenshot_path=old_page_annotated_relative,
                                new_page_screenshot_path=new_page_annotated_relative,
                                old_element_screenshot_path=old_element_relative,
                                new_element_screenshot_path=new_element_relative,
                                changed_fragment=f"{old_url} → {current_image_url}",
                                detected_at=datetime.utcnow()
                            )
                            db.add(event)

                            # Clean up old raw files
                            if monitor.last_page_screenshot_path:
                                try:
                                    old_raw_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                    if os.path.exists(old_raw_abs):
                                        os.remove(old_raw_abs)
                                except Exception:
                                    pass

                            if monitor.last_element_screenshot_path:
                                try:
                                    old_raw_el_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                    if os.path.exists(old_raw_el_abs):
                                        os.remove(old_raw_el_abs)
                                except Exception:
                                    pass

                            # Update monitor attributes for future runs
                            monitor.last_value = current_image_url
                            monitor.last_page_screenshot_path = current_raw_page_path_relative
                            monitor.last_element_screenshot_path = current_raw_element_path_relative
                            monitor.last_bounding_box_json = box_json
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            
                            db.commit()

                            print("[IMAGE MODE]")
                            print("Old URL:", old_url)
                            print("New URL:", current_image_url)

                        if DEBUG_MODE:
                            print("[MONITOR COMPLETE]\n")
                    else:
                        # Existing text monitoring path
                        # Read text content
                        text_content = locator.first.text_content()
                        if text_content is None:
                            text_content = ""
                        current_value = text_content.strip()

                        box_json = json.dumps(box) if box else None
                        old_value = monitor.last_value or ""

                        # --- [STEP 9] Reading value ---
                        if DEBUG_MODE:
                            print("[STEP 9] Reading value...")
                            print(f"Old Value: {old_value}")
                            print(f"Current Value: {current_value}\n")

                        # Deduplication comparison
                        is_first_check = monitor.last_page_screenshot_path is None

                        # Path constants
                        backend_dir = os.path.dirname(os.path.abspath(__file__))
                        timestamp_str = check_now.strftime("%Y%m%d_%H%M%S")
                        screenshot_dir = os.path.join(backend_dir, "screenshots", monitor.id)
                        os.makedirs(screenshot_dir, exist_ok=True)

                        if is_first_check:
                            # Capture baseline raw page and element screenshots (no annotations)
                            if DEBUG_MODE:
                                print("[STEP 11] Capturing screenshots...")
                            raw_page_filename = f"{timestamp_str}_raw_page.png"
                            raw_page_path_absolute = os.path.join(screenshot_dir, raw_page_filename)
                            
                            raw_element_filename = f"{timestamp_str}_raw_element.png"
                            raw_element_path_absolute = os.path.join(screenshot_dir, raw_element_filename)

                            try:
                                # Full page screenshot
                                page.screenshot(path=raw_page_path_absolute, full_page=True)
                                monitor.last_page_screenshot_path = f"screenshots/{monitor.id}/{raw_page_filename}"
                                if DEBUG_MODE:
                                    print("[OK] Page screenshot saved")
                            except Exception as se:
                                print(f"Failed to capture baseline page screenshot: {se}")
                                monitor.last_page_screenshot_path = None
                            
                            try:
                                # Element-only screenshot
                                locator.first.screenshot(path=raw_element_path_absolute)
                                monitor.last_element_screenshot_path = f"screenshots/{monitor.id}/{raw_element_filename}"
                                if DEBUG_MODE:
                                    print("[OK] Element screenshot saved")
                            except Exception as se:
                                print(f"Failed to capture baseline element screenshot: {se}")
                                monitor.last_element_screenshot_path = None

                            monitor.last_bounding_box_json = box_json
                            monitor.last_value = current_value
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            
                            if not DEBUG_MODE:
                                print(f"First check baseline captured for '{monitor.name}'. Value: '{current_value}'")
                            db.commit()
                            
                        elif current_value == old_value:
                            # Optimization: Do not capture new raw screenshot if value is unchanged.
                            # Only update status and scheduling timestamps.
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            
                            if not DEBUG_MODE:
                                print(f"Monitor '{monitor.name}' is unchanged. Timestamps updated.")
                            db.commit()
                            
                        else:
                            if DEBUG_MODE:
                                print("[STEP 10] Change detected")
                                change_type, diff_summary = diff_engine.calculate_diff(old_value, current_value)
                                print(f"{diff_summary}\n")
                            else:
                                print(f"Change detected for '{monitor.name}'! Old: '{old_value}' -> New: '{current_value}'")
                                change_type, diff_summary = diff_engine.calculate_diff(old_value, current_value)
                            
                            changed_fragment = diff_engine.get_changed_fragment(old_value, current_value)

                            # Capture current raw page screenshot
                            if DEBUG_MODE:
                                print("[STEP 11] Capturing screenshots...")
                            current_raw_page_filename = f"{timestamp_str}_raw_page.png"
                            current_raw_page_path_absolute = os.path.join(screenshot_dir, current_raw_page_filename)
                            
                            # Capture current raw element screenshot
                            current_raw_element_filename = f"{timestamp_str}_raw_element.png"
                            current_raw_element_path_absolute = os.path.join(screenshot_dir, current_raw_element_filename)

                            try:
                                page.screenshot(path=current_raw_page_path_absolute, full_page=True)
                                current_raw_page_path_relative = f"screenshots/{monitor.id}/{current_raw_page_filename}"
                                if DEBUG_MODE:
                                    print("[OK] Page screenshot saved")
                            except Exception as se:
                                print(f"Failed to capture current raw page screenshot: {se}")
                                current_raw_page_path_relative = None
                                
                            try:
                                locator.first.screenshot(path=current_raw_element_path_absolute)
                                current_raw_element_path_relative = f"screenshots/{monitor.id}/{current_raw_element_filename}"
                                if DEBUG_MODE:
                                    print("[OK] Element screenshot saved")
                            except Exception as se:
                                print(f"Failed to capture current raw element screenshot: {se}")
                                current_raw_element_path_relative = None

                            # Generate Old Annotated Page Screenshot (RED box)
                            old_page_annotated_relative = None
                            if monitor.last_page_screenshot_path:
                                old_page_filename = f"{timestamp_str}_old_page_annotated.png"
                                old_page_path_absolute = os.path.join(screenshot_dir, old_page_filename)
                                
                                # Copy the raw old screenshot to the new event old annotated path
                                old_source_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                if os.path.exists(old_source_abs):
                                    shutil.copy(old_source_abs, old_page_path_absolute)
                                    old_page_annotated_relative = f"screenshots/{monitor.id}/{old_page_filename}"
                                    
                                    # Draw RED outline using old coordinates
                                    if monitor.last_bounding_box_json:
                                        try:
                                            old_box_coords = json.loads(monitor.last_bounding_box_json)
                                            if old_box_coords:
                                                from PIL import Image, ImageDraw
                                                img = Image.open(old_page_path_absolute)
                                                draw = ImageDraw.Draw(img)
                                                ox, oy, ow, oh = old_box_coords['x'], old_box_coords['y'], old_box_coords['width'], old_box_coords['height']
                                                draw.rectangle([ox, oy, ox + ow, oy + oh], outline="red", width=4)
                                                img.save(old_page_path_absolute)
                                        except Exception as draw_err:
                                            print(f"Failed to draw old red rectangle: {draw_err}")

                            # Generate New Annotated Page Screenshot (GREEN box)
                            new_page_annotated_relative = None
                            if current_raw_page_path_relative:
                                new_page_filename = f"{timestamp_str}_new_page_annotated.png"
                                new_page_path_absolute = os.path.join(screenshot_dir, new_page_filename)
                                
                                # Copy the current raw screenshot to the new event new annotated path
                                shutil.copy(current_raw_page_path_absolute, new_page_path_absolute)
                                new_page_annotated_relative = f"screenshots/{monitor.id}/{new_page_filename}"
                                
                                # Draw GREEN outline using current coordinates
                                if box:
                                    try:
                                        from PIL import Image, ImageDraw
                                        img = Image.open(new_page_path_absolute)
                                        draw = ImageDraw.Draw(img)
                                        nx, ny, nw, nh = box['x'], box['y'], box['width'], box['height']
                                        draw.rectangle([nx, ny, nx + nw, ny + nh], outline="green", width=4)
                                        img.save(new_page_path_absolute)
                                    except Exception as draw_err:
                                        print(f"Failed to draw new green rectangle: {draw_err}")

                            # Generate Old Element Screenshot
                            old_element_relative = None
                            if monitor.last_element_screenshot_path:
                                old_element_filename = f"{timestamp_str}_old_element.png"
                                old_element_path_absolute = os.path.join(screenshot_dir, old_element_filename)
                                
                                old_el_source_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                if os.path.exists(old_el_source_abs):
                                    shutil.copy(old_el_source_abs, old_element_path_absolute)
                                    old_element_relative = f"screenshots/{monitor.id}/{old_element_filename}"

                            # Generate New Element Screenshot
                            new_element_relative = None
                            if current_raw_element_path_relative:
                                new_element_filename = f"{timestamp_str}_new_element.png"
                                new_element_path_absolute = os.path.join(screenshot_dir, new_element_filename)
                                
                                shutil.copy(current_raw_element_path_absolute, new_element_path_absolute)
                                new_element_relative = f"screenshots/{monitor.id}/{new_element_filename}"

                            # Generate V1.1 smart diff visualization changed_fragment and diff_summary
                            
                            # Save Event to DB
                            event = models.ChangeEvent(
                                monitor_id=monitor.id,
                                old_value=old_value,
                                new_value=current_value,
                                change_type=change_type,
                                diff_summary=diff_summary,
                                old_page_screenshot_path=old_page_annotated_relative,
                                new_page_screenshot_path=new_page_annotated_relative,
                                old_element_screenshot_path=old_element_relative,
                                new_element_screenshot_path=new_element_relative,
                                changed_fragment=changed_fragment,
                                detected_at=datetime.utcnow()
                            )
                            db.add(event)

                            # Optional Cleanup: remove the previous raw screenshots if no longer needed
                            if monitor.last_page_screenshot_path:
                                try:
                                    old_raw_abs = os.path.join(backend_dir, monitor.last_page_screenshot_path)
                                    if os.path.exists(old_raw_abs):
                                        os.remove(old_raw_abs)
                                except Exception as cleanup_err:
                                    print(f"Clean up of old raw page file failed: {cleanup_err}")

                            if monitor.last_element_screenshot_path:
                                try:
                                    old_raw_el_abs = os.path.join(backend_dir, monitor.last_element_screenshot_path)
                                    if os.path.exists(old_raw_el_abs):
                                        os.remove(old_raw_el_abs)
                                except Exception as cleanup_err:
                                    print(f"Clean up of old raw element file failed: {cleanup_err}")

                            # Update monitor attributes for future runs
                            monitor.last_value = current_value
                            monitor.last_page_screenshot_path = current_raw_page_path_relative
                            monitor.last_element_screenshot_path = current_raw_element_path_relative
                            monitor.last_bounding_box_json = box_json
                            monitor.last_checked_at = check_now
                            monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                            monitor.last_error = None
                            monitor.status = "active"
                            
                            db.commit()

                        if DEBUG_MODE:
                            print("[MONITOR COMPLETE]\n")

                except Exception as e:
                    if not DEBUG_MODE:
                        print(f"Error checking monitor '{monitor.name}' ({monitor.id}): {e}")
                        traceback.print_exc()
                    else:
                        err_msg = str(e)
                        if err_msg != "Selector no longer matches page DOM" and err_msg != "Element hidden by popup or overlay":
                            print("\n[ERROR]")
                            print(err_msg)
                            print()
                    
                    # Check if the element exists in DOM but was not visible/accessible
                    element_exists = False
                    try:
                        element_exists = page.locator(monitor.selector).count() > 0
                    except Exception:
                        pass

                    # Mark monitor as failed
                    monitor.status = "failed"
                    if str(e) in ["Element blocked by popup or overlay", "Element hidden by popup or overlay"]:
                        monitor.last_error = str(e)
                    elif element_exists:
                        if "Timeout" in str(e) or "Target closed" in str(e):
                            monitor.last_error = "Element blocked by popup or overlay"
                        else:
                            monitor.last_error = str(e)[:255]
                    else:
                        monitor.last_error = "Element not found after page load"
                    monitor.last_checked_at = check_now
                    monitor.next_check_at = check_now + timedelta(seconds=monitor.check_interval)
                    db.commit()

                finally:
                    page.close()

            browser.close()
    except Exception as e:
        print(f"General worker execution exception: {e}")
        traceback.print_exc()
    finally:
        db.close()
        _check_lock.release()
