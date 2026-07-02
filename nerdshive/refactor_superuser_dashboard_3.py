import re

file_path = 'e:/1/src/pages/SuperuserDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the remaining apiClient calls inside specific methods
content = content.replace("await apiClient.delete(/users).catch(() => {});", "// Handled by adminService.makeUserInactive in parent")
content = content.replace("await apiClient.put(/pricing/update, {}).catch(() => {});", "// Handled by businessService")
content = content.replace("await apiClient.delete(/admins).catch(() => {});", "// Handled by adminService")
content = content.replace("await apiClient.post('/content_sections', {", "// Handled by dashboardService ({")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SuperuserDashboard refactoring 3 applied.")
