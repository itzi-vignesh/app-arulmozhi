import os
import json

log_path = r"C:\Users\arulmozhi S\.gemini\antigravity-ide\brain\1eff3677-aff6-46fa-92d9-1889c78325bb\.system_generated\logs\transcript.jsonl"

if not os.path.exists(log_path):
    print("Log not found")
    exit()

with open(log_path, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if 'cancelMeetingModalOpen' in line and 'Dialog' in line and 'Cancel Meeting' in line:
            try:
                data = json.loads(line)
                print(f"Step {data.get('step_index')} (Line {idx}): range info if any")
                if 'content' in data:
                    print(data['content'][:1500])
            except Exception as e:
                pass
