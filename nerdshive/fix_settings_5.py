import re

file_path = 'e:/1/src/pages/Settings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """  const fetchUserProfile = async () => {
    try {
      const sessionData = await authService.getSession();
      if (!sessionData?.user?.id) {
        navigate('/login');
        return;
      }

      // We'll fetch from users/me or admins/me depending on their metadata or try both
      const role = sessionData.user.user_metadata?.role || 'user';
      setUserRole(role);

      let profileData = null;
      try {
        if (role === 'superuser' || role === 'admin') {
          profileData = await adminService.getMe().catch(() => userService.getMe());
        } else {
          profileData = await userService.getMe();
        }
      } catch (err) {
        profileData = await userService.getMe().catch(() => null);
      }

      if (!profileData) {
        throw new Error("Failed to load profile");
      }

      setUserProfile(profileData);
      setProfileForm({
        full_name: profileData.full_name || '',
        mobile: profileData.mobile || '',
        city: profileData.city || '',
        location: profileData.location || '',
        occupation: profileData.occupation || '',
        govt_id_type: profileData.govt_id_type || '',
        govt_id_number: profileData.govt_id_number || '',
        gender: profileData.gender || '',
        reimbursement: profileData.reimbursement || false,
        org_name: profileData.org_name || '',
        gst_number: profileData.gst_number || '',
        org_location: profileData.org_location || '',
        date_of_birth: profileData.date_of_birth || '',
        emergency_contact_name: profileData.emergency_contact_name || '',
        emergency_contact_number: profileData.emergency_contact_number || '',
        requires_parking: profileData.requires_parking || false,
        vehicle_type: profileData.vehicle_type || '',
        vehicle_brand_model: profileData.vehicle_brand_model || '',
        vehicle_color: profileData.vehicle_color || '',
        vehicle_registration: profileData.vehicle_registration || ''
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({
        title: "Error",
        description: "Failed to load user profile.",
        variant: "destructive"
      });
    }
  };"""

# Replace the old fetchUserProfile function block
content = re.sub(r'  const fetchUserProfile = async \(\) => \{.*?(?=  const handleProfileUpdate =)', replacement + '\n\n', content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
