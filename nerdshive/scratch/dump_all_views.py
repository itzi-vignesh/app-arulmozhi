import os
import json

log_path = r"C:\Users\arulmozhi S\.gemini\antigravity-ide\brain\1eff3677-aff6-46fa-92d9-1889c78325bb\.system_generated\logs\transcript.jsonl"
os.makedirs("scratch/blocks", exist_ok=True)

with open(log_path, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        data = json.loads(line)
        content = data.get('content', '')
        if data.get('type') == 'VIEW_FILE' and 'CorporateDashboard.tsx' in line and 'Showing lines' in content:
            parts = content.split('Showing lines ')[1].split('\n')[0]
            start_l, end_l = map(int, parts.split(' to '))
            
            code_lines = []
            for l in content.split('\n'):
                if ':' in l and l.split(':')[0].strip().isdigit():
                    prefix, code = l.split(':', 1)
                    if code.startswith(' '):
                        code = code[1:]
                    code_lines.append(code)
            
            step = data.get('step_index')
            out_name = f"scratch/blocks/lines_{start_l}_{end_l}_step_{step}.txt"
            with open(out_name, 'w', encoding='utf-8') as outf:
                outf.write('\n'.join(code_lines))
            print(f"Dumped step {step}: lines {start_l} to {end_l} to {out_name} ({len(code_lines)} lines)")
