import re

file_path = 'e:/1/src/pages/SuperuserDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (r'const fetchAdmins = async \(\) => \{.*?\};', '''const fetchAdmins = async () => {
    try {
      const data = await adminService.getAdmins();
      setAdmins(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };'''),

    (r'const handleAddAdmin = async \(\) => \{.*?\};', '''const handleAddAdmin = async () => {
    if (!adminFormData.email || !adminFormData.fullName) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await adminService.addAdmin(adminFormData.email, adminFormData.fullName);

      toast({
        title: "Admin Added",
        description: "New admin has been created and invited.",
        variant: "default"
      });

      setAdminFormData({ email: '', fullName: '' });
      fetchAdmins();
      fetchActivityLogs();
    } catch (error) {
      console.error('Error adding admin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add admin",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };'''),

    (r'const handleDeleteAdmin = async \(adminId: string\) => \{.*?\};', '''const handleDeleteAdmin = async (adminId: string) => {
    setLoading(true);
    try {
      await adminService.deleteAdmin(adminId);

      toast({
        title: "Admin Removed",
        description: "Admin access has been revoked.",
        variant: "default"
      });

      fetchAdmins();
      fetchActivityLogs();
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast({
        title: "Error",
        description: "Failed to remove admin",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''')
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SuperuserDashboard refactoring 2 applied.")
