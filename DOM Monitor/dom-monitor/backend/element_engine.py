import difflib

def compute_element_diff(old_data, new_data):
    def match_items(old_items, new_items, category_type="text"):
        added = []
        removed = []
        modified = []
        
        old_unmatched = []
        new_matched_indices = set()
        
        # 1. Match by Stable ID
        for old_item in old_items:
            matched = False
            if old_item.get("id"):
                for j, new_item in enumerate(new_items):
                    if j in new_matched_indices: continue
                    if old_item["id"] == new_item.get("id"):
                        if category_type == "image":
                            is_changed = old_item.get("src") != new_item.get("src")
                        else:
                            is_changed = old_item.get("content") != new_item.get("content")
                            
                        if is_changed:
                            modified.append({"old": old_item, "new": new_item})
                        new_matched_indices.add(j)
                        matched = True
                        break
            if not matched:
                old_unmatched.append(old_item)
                
        # 2. Exact content match
        old_unmatched_2 = []
        for old_item in old_unmatched:
            matched = False
            for j, new_item in enumerate(new_items):
                if j in new_matched_indices: continue
                if category_type == "image":
                    if old_item.get("src") == new_item.get("src"):
                        new_matched_indices.add(j)
                        matched = True
                        break
                else:
                    if old_item.get("content") and old_item.get("content") == new_item.get("content"):
                        new_matched_indices.add(j)
                        matched = True
                        break
            if not matched:
                old_unmatched_2.append(old_item)
                
        # 3. Hybrid similarity scoring (only for text-based)
        old_unmatched_3 = []
        if category_type in ["text", "title", "button", "link"]:
            for old_item in old_unmatched_2:
                best_score = 0
                best_j = -1
                for j, new_item in enumerate(new_items):
                    if j in new_matched_indices: continue
                    seq = difflib.SequenceMatcher(None, old_item.get("content", ""), new_item.get("content", ""))
                    score = seq.ratio()
                    if score > best_score:
                        best_score = score
                        best_j = j
                if best_score > 0.6: # similarity threshold
                    new_item = new_items[best_j]
                    modified.append({"old": old_item, "new": new_item})
                    new_matched_indices.add(best_j)
                else:
                    old_unmatched_3.append(old_item)
        else:
            old_unmatched_3 = old_unmatched_2
            
        # 4. Remaining are Added/Removed
        removed.extend(old_unmatched_3)
        for j, new_item in enumerate(new_items):
            if j not in new_matched_indices:
                added.append(new_item)
                
        return {"added": added, "removed": removed, "modified": modified}

    diff_titles = match_items(old_data.get("titles", []), new_data.get("titles", []), "title")
    diff_texts = match_items(old_data.get("texts", []), new_data.get("texts", []), "text")
    diff_images = match_items(old_data.get("images", []), new_data.get("images", []), "image")
    diff_buttons = match_items(old_data.get("buttons", []), new_data.get("buttons", []), "button")
    diff_links = match_items(old_data.get("links", []), new_data.get("links", []), "link")

    all_added = diff_titles["added"] + diff_texts["added"] + diff_images["added"] + diff_buttons["added"] + diff_links["added"]
    all_removed = diff_titles["removed"] + diff_texts["removed"] + diff_images["removed"] + diff_buttons["removed"] + diff_links["removed"]
    all_modified = diff_titles["modified"] + diff_texts["modified"] + diff_images["modified"] + diff_buttons["modified"] + diff_links["modified"]

    diff_result = {
        "added": all_added,
        "removed": all_removed,
        "modified": all_modified,
        "tables": [] # Handled separately via compute_table_diff in worker.py
    }
    
    return diff_result

def get_element_extraction_js():
    return r"""
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
            
            function getAbsBox(node) {
                const r = node.getBoundingClientRect();
                return {
                    x: r.left + window.scrollX,
                    y: r.top + window.scrollY,
                    width: r.width,
                    height: r.height,
                    element_box: {
                        x: r.left - containerRect.left,
                        y: r.top - containerRect.top,
                        width: r.width,
                        height: r.height
                    }
                };
            }
            
            const result = {
                container_box: container_box,
                titles: [],
                texts: [],
                images: [],
                buttons: [],
                links: []
            };
            
            function getStableId(node) {
                if (node.id) return node.id;
                for (const attr of ["data-id", "data-testid", "name", "data-qa"]) {
                    if (node.hasAttribute(attr)) return node.getAttribute(attr);
                }
                return null;
            }
            
            function processNode(node) {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return;
                
                const tag = node.tagName.toLowerCase();
                
                if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                    result.titles.push({
                        id: getStableId(node),
                        content: node.textContent.trim(),
                        box: getAbsBox(node),
                        tag: tag
                    });
                } else if (tag === 'img') {
                    result.images.push({
                        id: getStableId(node),
                        src: node.src || node.getAttribute("src") || "",
                        box: getAbsBox(node),
                        alt: node.alt || ""
                    });
                } else if (tag === 'button' || (tag === 'input' && ['button', 'submit'].includes(node.type))) {
                    result.buttons.push({
                        id: getStableId(node),
                        content: node.value || node.textContent.trim(),
                        box: getAbsBox(node)
                    });
                } else if (tag === 'a') {
                    result.links.push({
                        id: getStableId(node),
                        content: node.textContent.trim(),
                        href: node.href || node.getAttribute("href") || "",
                        box: getAbsBox(node)
                    });
                } else if (tag === 'table') {
                    // Skip children of table, handled by table engine later
                    return; 
                } else {
                    let hasText = false;
                    let directText = "";
                    for (let i = 0; i < node.childNodes.length; i++) {
                        if (node.childNodes[i].nodeType === Node.TEXT_NODE) {
                            let txt = node.childNodes[i].textContent.trim();
                            if (txt) { hasText = true; directText += txt + " "; }
                        }
                    }
                    directText = directText.trim();
                    if (hasText && directText) {
                        result.texts.push({
                            id: getStableId(node),
                            content: directText,
                            box: getAbsBox(node),
                            tag: tag
                        });
                    }
                }
                
                for (let i = 0; i < node.children.length; i++) {
                    processNode(node.children[i]);
                }
            }
            
            processNode(el);
            return result;
        }
    """
