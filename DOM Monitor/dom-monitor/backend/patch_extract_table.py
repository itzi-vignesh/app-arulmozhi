import sys

with open("worker.py", "r", encoding="utf-8") as f:
    code = f.read()

# Replace extract_table_structure body
old_extract = """def extract_table_structure(table_locator) -> dict:
    try:
        data = table_locator.evaluate(\"\"\"
            el => {
                if (!el) return null;
                
                const tableRect = el.getBoundingClientRect();
                const headers = [];
                const header_boxes = [];
                const headRow = el.querySelector('thead tr') || el.querySelector('tr');"""

new_extract = """def extract_table_structure(container_locator) -> dict:
    try:
        data = container_locator.evaluate(\"\"\"
            el => {
                if (!el) return null;
                
                const containerRect = el.getBoundingClientRect();
                
                let container_title = null;
                let title_box = null;
                const headingEl = el.querySelector('h1, h2, h3, h4, h5, h6, caption, .title, .modal-title');
                if (headingEl) {
                    container_title = headingEl.textContent.trim();
                    const rect = headingEl.getBoundingClientRect();
                    title_box = {
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
                
                const clone = el.cloneNode(true);
                const tablesInClone = clone.querySelectorAll('table');
                tablesInClone.forEach(t => t.remove());
                const container_non_table_text = clone.textContent.trim().replace(/\\s+/g, ' ');
                
                const tableEl = el.tagName.toLowerCase() === 'table' ? el : el.querySelector('table');
                if (!tableEl) return null;
                
                const headers = [];
                const header_boxes = [];
                const headRow = tableEl.querySelector('thead tr') || tableEl.querySelector('tr');"""

if old_extract in code:
    code = code.replace(old_extract, new_extract)
else:
    print("Could not find start of extract_table_structure")
    sys.exit(1)

# Replace table tracking queries to use tableEl instead of el
old_row_loop = """                allRows.forEach(row => {
                    if (row.closest('table') !== el) return;"""

new_row_loop = """                const allRows = Array.from(tableEl.querySelectorAll('tr'));
                const rows = [];
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
                
                allRows.forEach(row => {
                    if (row.closest('table') !== tableEl) return;"""

code = code.replace("""                const allRows = Array.from(el.querySelectorAll('tr'));
                const rows = [];
                const keyCounts = {};
                
                const norm = s => s.toLowerCase().trim().replace(/\\s+/g, ' ');
                const norm_headers = headers.map(norm);
                
                const sequentialHeaders = [
                    "sno", "s.no", "s.no.", "sn", "s.n", "s.n.", "no", "no.", "index",
                    "slno", "sl.no", "sl.no.", "sl no", "srno", "sr.no", "sr.no.", "sr no", "sr. no",
                    "serial number", "serial no", "serial_no", "serial_no", "serialnumber", "#", "row", "row number", "row no", "row_no", "row."
                ];

                const candidates = [
                    ["id"],
                    ["identifier"],
                    ["tender id", "tenderid"],
                    ["reference number", "reference_number"],
                    ["ref no", "ref_no", "ref. no"],
                    sequentialHeaders
                ];
                
                allRows.forEach(row => {
                    if (row.closest('table') !== el) return;""", new_row_loop) # fallback if above replace fails


if old_row_loop in code:
    code = code.replace(old_row_loop, new_row_loop.split("];\n")[1].strip() + "\n" + """                allRows.forEach(row => {
                    if (row.closest('table') !== tableEl) return;""")

code = code.replace("rowRect.left - tableRect.left", "rowRect.left - containerRect.left")
code = code.replace("rowRect.top - tableRect.top", "rowRect.top - containerRect.top")
code = code.replace("cellRect.left - tableRect.left", "cellRect.left - containerRect.left")
code = code.replace("cellRect.top - tableRect.top", "cellRect.top - containerRect.top")
code = code.replace("rect.left - tableRect.left", "rect.left - containerRect.left")
code = code.replace("rect.top - tableRect.top", "rect.top - containerRect.top")


old_return = """                let title = null;
                let title_box = null;
                const headingEl = el.querySelector('h1, h2, h3, h4, h5, h6, caption, .title, .modal-title');
                if (headingEl) {
                    title = headingEl.textContent.trim();
                    const rect = headingEl.getBoundingClientRect();
                    title_box = {
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
                
                return {
                    title: title,
                    title_box: title_box,
                    headers: headers,
                    header_boxes: header_boxes,
                    rows: rows
                };"""

new_return = """                return {
                    container_title: container_title,
                    title_box: title_box,
                    container_non_table_text: container_non_table_text,
                    table: {
                        headers: headers,
                        header_boxes: header_boxes,
                        rows: rows
                    }
                };"""

if old_return in code:
    code = code.replace(old_return, new_return)
else:
    print("Could not find end of extract_table_structure")


with open("worker.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patch extract_table_structure completed.")
