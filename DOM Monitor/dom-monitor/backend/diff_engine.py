import re
import difflib

def extract_number(text: str):
    """
    Strips out non-numerical components (except minus/decimal) and attempts 
    to parse a clean float or integer. Returns None if parsing fails.
    """
    if not text:
        return None
    # Keep digits, dots, and negative signs
    clean = re.sub(r'[^\d\.\-]', '', text)
    try:
        if '.' in clean:
            return float(clean)
        return int(clean)
    except ValueError:
        return None

def get_currency_symbol(text: str):
    """
    Finds the first currency symbol character or general non-alphanumeric prefix in the string.
    """
    if not text:
        return None
    # Match symbols like ₹, $, €, £, ¥, etc.
    match = re.search(r'[^\d\s\.\,\-\w\(\)\[\]\{\}\:\;]', text)
    return match.group(0) if match else None

def calculate_diff(old_val: str, new_val: str):
    """
    Calculates differences and classifies them into:
    - 'numeric': For simple price or general numeric updates.
    - 'text': Pure text differences.
    - 'mixed': Numerical adjustments combined with context string updates.
    
    Returns a tuple of (change_type, diff_summary).
    """
    old_clean = (old_val or "").strip()
    new_clean = (new_val or "").strip()

    # 1. Parse numeric values
    old_num = extract_number(old_clean)
    new_num = extract_number(new_clean)

    # Detect if they are strictly numerical or simple price strings
    is_old_numeric_like = re.match(r'^[^\d]*\d+[\d\s\.\,\-]*$', old_clean) is not None if old_clean else False
    is_new_numeric_like = re.match(r'^[^\d]*\d+[\d\s\.\,\-]*$', new_clean) is not None if new_clean else False

    if old_num is not None and new_num is not None and is_old_numeric_like and is_new_numeric_like:
        diff_val = new_num - old_num
        sign = "+" if diff_val > 0 else "-" if diff_val < 0 else ""
        currency = get_currency_symbol(old_clean) or get_currency_symbol(new_clean) or ""
        abs_diff = abs(diff_val)
        
        if isinstance(diff_val, float):
            diff_str = f"{sign}{currency}{abs_diff:.2f}"
        else:
            diff_str = f"{sign}{currency}{abs_diff}"
            
        return "numeric", f"Difference: {diff_str}"

    # 2. Check for mixed updates (combines text and numerical digits)
    has_digits_old = any(c.isdigit() for c in old_clean)
    has_digits_new = any(c.isdigit() for c in new_clean)
    
    if has_digits_old or has_digits_new:
        return "mixed", f"Old: {old_clean} | New: {new_clean}"

    # 3. Text changes using word diff comparison
    old_words = old_clean.split()
    new_words = new_clean.split()

    matcher = difflib.SequenceMatcher(None, old_words, new_words)
    removed = []
    added = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ('replace', 'delete'):
            removed.extend(old_words[i1:i2])
        if tag in ('replace', 'insert'):
            added.extend(new_words[j1:j2])

    summary_parts = []
    if removed:
        summary_parts.append(f"Removed: {' '.join(removed)}")
    if added:
        summary_parts.append(f"Added: {' '.join(added)}")

    summary = " | ".join(summary_parts) if summary_parts else "No visible text change"
    return "text", summary

def get_changed_fragment(old_val: str, new_val: str) -> str:
    """
    Extracts the specific fragment that changed, helping identify 
    minor modifications in long text content.
    Returns: "old_fragment → new_fragment"
    """
    old_clean = (old_val or "").strip()
    new_clean = (new_val or "").strip()
    
    if not old_clean and not new_clean:
        return ""
    if not old_clean:
        return f"(Empty) → {new_clean}"
    if not new_clean:
        return f"{old_clean} → (Empty)"

    # If the text is relatively short, show the full transition
    if len(old_clean) < 80 and len(new_clean) < 80:
        return f"{old_clean} → {new_clean}"

    # Use difflib to find mismatch blocks
    matcher = difflib.SequenceMatcher(None, old_clean, new_clean)
    opcodes = matcher.get_opcodes()
    
    # We look for first mismatch block (replace, delete, insert)
    mismatches = [op for op in opcodes if op[0] in ('replace', 'delete', 'insert')]
    if not mismatches:
        return f"{old_clean[:40]}... → {new_clean[:40]}..."
        
    tag, i1, i2, j1, j2 = mismatches[0]
    
    # Add context around the mismatch (15 characters)
    start_old = max(0, i1 - 15)
    end_old = min(len(old_clean), i2 + 15)
    
    prefix_old = "..." if start_old > 0 else ""
    suffix_old = "..." if end_old < len(old_clean) else ""
    
    old_frag = f"{prefix_old}{old_clean[start_old:end_old]}{suffix_old}"
    
    start_new = max(0, j1 - 15)
    end_new = min(len(new_clean), j2 + 15)
    
    prefix_new = "..." if start_new > 0 else ""
    suffix_new = "..." if end_new < len(new_clean) else ""
    
    new_frag = f"{prefix_new}{new_clean[start_new:end_new]}{suffix_new}"
    
    return f"{old_frag} → {new_frag}"
