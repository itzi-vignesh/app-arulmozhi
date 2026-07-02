import re

with open('worker.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update extract_table_structure
js_to_replace = """                return {
                    headers: headers,
                    header_boxes: header_boxes,
                    rows: rows
                };"""
js_new = """                let title = null;
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
                            x: rect.left - tableRect.left,
                            y: rect.top - tableRect.top,
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
if js_to_replace in content:
    content = content.replace(js_to_replace, js_new)
    print("Patched extract_table_structure")
else:
    print("Could not find extract_table_structure return block")

# 2. Update compute_table_diff
py_to_replace_diff = """    return {
        "added_keys": added_keys,
        "removed_keys": removed_keys,
        "modified_keys": modified_keys,
        "modified_details": modified_details,
        "header_changes": header_changes
    }"""
py_new_diff = """    old_title = old_table.get("title")
    new_title = new_table.get("title")
    title_change = None
    if old_title != new_title and (old_title or new_title):
        title_change = {
            "old": old_title,
            "new": new_title
        }

    return {
        "title_change": title_change,
        "added_keys": added_keys,
        "removed_keys": removed_keys,
        "modified_keys": modified_keys,
        "modified_details": modified_details,
        "header_changes": header_changes
    }"""
if py_to_replace_diff in content:
    content = content.replace(py_to_replace_diff, py_new_diff)
    print("Patched compute_table_diff")
else:
    print("Could not find compute_table_diff return block")

# 3. Update has_table_changes condition
has_changes_replace = """                            has_table_changes = (
                                len(diff_result["added_keys"]) > 0 or
                                len(diff_result["removed_keys"]) > 0 or
                                len(diff_result["modified_keys"]) > 0 or
                                len(diff_result.get("header_changes", [])) > 0
                            )"""
has_changes_new = """                            has_table_changes = (
                                len(diff_result["added_keys"]) > 0 or
                                len(diff_result["removed_keys"]) > 0 or
                                len(diff_result["modified_keys"]) > 0 or
                                len(diff_result.get("header_changes", [])) > 0 or
                                bool(diff_result.get("title_change"))
                            )"""
if has_changes_replace in content:
    content = content.replace(has_changes_replace, has_changes_new)
    print("Patched has_table_changes")
else:
    print("Could not find has_table_changes block")

with open('worker.py', 'w', encoding='utf-8') as f:
    f.write(content)
