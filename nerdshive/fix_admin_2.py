import re

file_path = 'e:/1/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'  const fetchApprovedUsers = async \(\) => \{.*?\} catch \(error\) \{\n      console\.error\(\'Error fetching approved users:\', error\);\n    \}\n  \};\n',
    '''  const fetchApprovedUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: true });
      setApprovedUsers(data || []);
    } catch (error) {
      console.error('Error fetching approved users:', error);
    }
  };\n''',
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
