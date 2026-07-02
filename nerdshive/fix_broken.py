import os
import re

def fix_broken_regex(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix duplicated const { ... }
    content = re.sub(r'const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*const\s*\{\s*data\s*\}', r'const { data }', content)
    content = re.sub(r'const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*const\s*\{\s*count\s*\}', r'const { count }', content)
    content = re.sub(r'const\s*\{\s*count\s*,\s*error\s*\}\s*=\s*const\s*\{\s*count\s*\}', r'const { count }', content)
    content = re.sub(r'const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*await\s*apiClient', r'const { data } = await apiClient', content)
    content = re.sub(r'const\s*\{\s*count\s*,\s*error\s*\}\s*=\s*await\s*apiClient', r'const { count } = await apiClient', content)
    content = re.sub(r'const\s*\{\s*error\s*\}\s*=\s*await\s*apiClient', r'await apiClient', content)

    # Any leftover single quotes around error handling
    content = re.sub(r'const\s*\{\s*data\s*:\s*([^,]+)\s*,\s*error\s*:\s*([^ }]+)\s*\}\s*=\s*const\s*\{\s*data\s*:\s*\1\s*\}', r'const { data: \1 }', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_broken_regex("e:/1/src/pages/AdminDashboard.tsx")
fix_broken_regex("e:/1/src/pages/SuperuserDashboard.tsx")
