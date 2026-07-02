import re

file_path = 'e:/1/src/pages/Settings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the orphaned code block
content = re.sub(
    r'const handleProfileUpdate = async \(e: React\.FormEvent\) => \{.*?const handleDocumentsUpdate = async \(e: React\.FormEvent\) => \{',
    '''const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { session, roles } = await authService.getSession();
      if (!session) throw new Error("Not authenticated");

      const updateData: any = {
        full_name: profile.full_name,
        mobile: profile.mobile,
        city: profile.city,
        location: profile.location,
        occupation: profile.occupation
      };

      if (roles?.is_superuser || roles?.is_admin || (!roles?.is_admin && !roles?.is_superuser)) {
          await userService.updateMe(updateData);
      }

      toast({ title: "Profile Updated", description: "Your profile has been updated successfully.", variant: "default" });
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentsUpdate = async (e: React.FormEvent) => {''',
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed Settings orphaned code.")
