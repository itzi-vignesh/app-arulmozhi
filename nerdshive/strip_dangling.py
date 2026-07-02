import os
import re

def strip_dangling_methods(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('.order(') or stripped.startswith('.limit(') or stripped.startswith('.eq(') or stripped.startswith('.single(') or stripped.startswith('.in(') or stripped.startswith('.gt('):
            continue # Skip these lines as they are dangling from old Supabase queries
        new_lines.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

strip_dangling_methods("e:/1/src/pages/AdminDashboard.tsx")
strip_dangling_methods("e:/1/src/pages/SuperuserDashboard.tsx")
