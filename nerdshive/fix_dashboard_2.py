import re

file_path = 'e:/1/src/pages/Dashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("description: Your  plan is active from  to .,", "description: Your  plan is active from  to .,")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
