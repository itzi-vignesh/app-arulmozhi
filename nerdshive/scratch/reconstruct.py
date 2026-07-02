import os
import json

log_path = r"C:\Users\arulmozhi S\.gemini\antigravity-ide\brain\1eff3677-aff6-46fa-92d9-1889c78325bb\.system_generated\logs\transcript.jsonl"
orig_path = "src/pages/CorporateDashboard.tsx"

if not os.path.exists(log_path):
    print("Log not found")
    exit()

with open(log_path, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        data = json.loads(line)
        if data.get('type') == 'VIEW_FILE' and 'CorporateDashboard.tsx' in line:
            content = data.get('content', '')
            if 'Showing lines' in content:
                parts = content.split('Showing lines ')[1].split('\n')[0]
                print(f"Step {data.get('step_index')} (Line {idx}): range {parts}")
