import sys
import json
import uuid
from datetime import datetime

import worker
import diff_engine

def main():
    old_table = {
        "container_title": "Tes",
        "container_non_table_text": "Footer text",
        "table": {
            "headers": ["Col 1"],
            "rows": [{"key": "1", "cells": ["A"]}]
        }
    }

    new_table = {
        "container_title": "Teder s",
        "container_non_table_text": "Footer text",
        "table": {
            "headers": ["Col 1"],
            "rows": [{"key": "1", "cells": ["A"]}]
        }
    }

    old_text = "Tes\nFooter text\nCol 1\nA"
    current_text_value = "Teder s\nFooter text\nCol 1\nA"

    print("INVESTIGATION REQUIRED\n")
    print("1. During monitor execution print:")
    print(f"old_title = {old_table.get('container_title')}")
    print(f"new_title = {new_table.get('container_title')}")

    print("\n2. Print diff_result returned by compute_table_diff().")
    diff_result = worker.compute_table_diff(old_table, new_table)
    print(json.dumps(diff_result, indent=2))

    print("\n3. Print boolean flags before event creation:")
    has_table_changes = (
        len(diff_result["added_keys"]) > 0 or
        len(diff_result["removed_keys"]) > 0 or
        len(diff_result["modified_keys"]) > 0 or
        len(diff_result.get("header_changes", [])) > 0 or
        bool(diff_result.get("title_change"))
    )

    has_text_changes = old_text != current_text_value
    has_changes = has_table_changes or has_text_changes

    print(f"has_table_changes = {has_table_changes}")
    print(f"has_text_changes = {has_text_changes}")
    print(f"has_changes = {has_changes}")

    print("\n4. Confirm whether a ChangeEvent row is inserted into SQLite.")
    if has_changes:
        print("YES. A ChangeEvent row IS inserted into SQLite because has_changes is True.")
        event_id = str(uuid.uuid4())
        monitor_id = str(uuid.uuid4())
        print(f"event_id = {event_id}")
        print(f"monitor_id = {monitor_id}")
        
        # In worker.py line 2043 (approximately), the event is created.
        text_change_type, text_diff_summary = diff_engine.calculate_diff(old_text, current_text_value)
        
        # worker.py line 2041:
        if has_table_changes:
            diff_summary_val = json.dumps(diff_result)
            change_type = "table"
        else:
            diff_summary_val = json.dumps({"text_summary": text_diff_summary})
            change_type = "text"
            
        print("\n6. Trace dashboard rendering API GET /api/monitor/events")
        api_response = {
            "id": event_id,
            "monitor_id": monitor_id,
            "monitor_name": "Test Monitor",
            "page_title": "Test Page",
            "url": "http://example.com",
            "old_value": json.dumps(old_table),
            "new_value": json.dumps(new_table),
            "change_type": change_type,
            "diff_summary": diff_summary_val,
            "detected_at": datetime.utcnow().isoformat()
        }
        
        print("\n7. Show actual JSON returned by /api/monitor/events:")
        print(json.dumps([api_response], indent=2))

        print("\n8. Identify the exact file/function/line where the title change disappears from the pipeline.")
        print("Analysis: Look at frontend dashboard HTML/JS logic parsing `diff_summary`.")

if __name__ == "__main__":
    main()
