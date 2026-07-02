import re

file_path = 'e:/1/src/pages/Settings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'const handleProfileUpdate = async \(e: React\.FormEvent\) => \{.*?const handleDocumentUpdate = async \(\) => \{.*?\n  \};',
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
      fetchUserProfile();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleIdPhotoCapture = (file: File) => {
    setNewIdFile(file);
    setShowIdCameraModal(false);
    toast({
      title: "ID Photo Captured",
      description: "New ID photo captured successfully. Click 'Update Documents' to save.",
      variant: "default"
    });
  };

  const handleCustomerPhotoCapture = (file: File) => {
    setNewCustomerPhoto(file);
    setShowCameraModal(false);
    toast({
      title: "Photo Captured",
      description: "New photo captured successfully. Click 'Update Documents' to save.",
      variant: "default"
    });
  };

  const handleDocumentUpdate = async () => {
    if (!newIdFile && !newCustomerPhoto) {
      toast({
        title: "No Changes",
        description: "No new documents to update.",
        variant: "default"
      });
      return;
    }

    setLoading(true);
    try {
      const { session } = await authService.getSession();
      if (!session?.user?.id) throw new Error('No session found');

      let govtIdCopyUrl = userProfile?.govt_id_copy_url || '';
      let customerPhotoUrl = userProfile?.customer_photo_url || '';

      if (newIdFile) {
        const fileExt = newIdFile.name ? newIdFile.name.split('.').pop() : 'jpg';
        const fileName = ${session.user.id}/govt-id-updated-.;
        govtIdCopyUrl = await storageService.uploadFile('id-proofs', fileName, newIdFile);
      }

      if (newCustomerPhoto) {
        const fileExt = newCustomerPhoto.name ? newCustomerPhoto.name.split('.').pop() : 'jpg';
        const photoFileName = ${session.user.id}/photo-updated-.;
        customerPhotoUrl = await storageService.uploadFile('customer-photos', photoFileName, newCustomerPhoto);
      }

      await userService.updateMe({
        govt_id_copy_url: govtIdCopyUrl,
        customer_photo_url: customerPhotoUrl
      });

      toast({
        title: "Documents Updated",
        description: "Your documents have been updated successfully.",
        variant: "default"
      });

      setNewIdFile(null);
      setNewCustomerPhoto(null);
      fetchUserProfile();
    } catch (error) {
      console.error('Error updating documents:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update documents. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Settings refactored phase 2.")
