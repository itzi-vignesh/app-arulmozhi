import os
import json

log_path = r"C:\Users\arulmozhi S\.gemini\antigravity-ide\brain\1eff3677-aff6-46fa-92d9-1889c78325bb\.system_generated\logs\transcript.jsonl"
os.makedirs("scratch/blocks", exist_ok=True)

steps_to_extract = [3073, 3096, 3123, 3125, 3127, 3148, 3150, 3152, 3159, 3184, 3205, 3207, 3211, 3226, 3230, 3232, 3236]

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        step = data.get('step_index')
        if step in steps_to_extract:
            content = data.get('content', '')
            if 'Showing lines' in content:
                # Extract clean lines
                code_lines = []
                for l in content.split('\n'):
                    if ':' in l and l.split(':')[0].strip().isdigit():
                        prefix, code = l.split(':', 1)
                        if code.startswith(' '):
                            code = code[1:]
                        code_lines.append(code)
                
                out_name = f"scratch/blocks/step_{step}.txt"
                with open(out_name, 'w', encoding='utf-8') as outf:
                    outf.write('\n'.join(code_lines))
                print(f"Dumped step {step} to {out_name} ({len(code_lines)} lines)")
