import re

file_path = 'e:/1/src/pages/Settings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const fileName = /govt-id-updated-.;", "const fileName = ${session.user.id}/govt-id-updated-.;")
content = content.replace("const photoFileName = /photo-updated-.;", "const photoFileName = ${session.user.id}/photo-updated-.;")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
