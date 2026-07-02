import os

def strip_dangling_methods(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    methods_to_strip = ['.neq(', '.gte(', '.lte(', '.ilike(', '.match(', '.is(', '.not(', '.or(', '.csv(', '.select(', '.eq(', '.single(', '.order(', '.limit(', '.in(', '.gt(']
    
    for line in lines:
        stripped = line.strip()
        skip = False
        for m in methods_to_strip:
            if stripped.startswith(m):
                skip = True
                break
        if not skip:
            new_lines.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

strip_dangling_methods("e:/1/src/pages/AdminDashboard.tsx")
strip_dangling_methods("e:/1/src/pages/SuperuserDashboard.tsx")
