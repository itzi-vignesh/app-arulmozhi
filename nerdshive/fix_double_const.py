import os
import re

def fix_broken_regex(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix the double consts
    content = re.sub(r'const\s*\{\s*count\s*,\s*error\s*\}\s*=\s*const\s*\{\s*data\s*\}\s*=\s*await', r'const { data: count } = await', content)
    content = re.sub(r'const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*const\s*\{\s*data\s*\}\s*=\s*await', r'const { data } = await', content)

    # In SuperuserDashboard there's a `.neq` dangling that broke, already stripped hopefully
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_broken_regex("e:/1/src/pages/AdminDashboard.tsx")
fix_broken_regex("e:/1/src/pages/SuperuserDashboard.tsx")
