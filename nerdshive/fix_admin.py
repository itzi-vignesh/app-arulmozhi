import re

file_path = 'e:/1/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("description:  has been made inactive. They will need to re-register to access the system.,", "description: ${user.full_name} has been made inactive. They will need to re-register to access the system.," )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
