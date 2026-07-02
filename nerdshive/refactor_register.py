import re

file_path = 'e:/1/src/pages/Register.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

imports = """
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { storageService } from '@/services/storageService';
"""
content = content.replace("import { apiClient } from '@/lib/apiClient';", "import { apiClient } from '@/lib/apiClient';" + imports)

replacements = [
    (r'const handleRegister = async \(e: React.FormEvent\) => \{.*?\};', '''const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (formData.reimbursement && !formData.orgName) {
        throw new Error("Organization Name is required when requesting reimbursement");
      }

      if (!idFile) {
        throw new Error("Government ID copy is required");
      }

      // 1. Register Auth User
      const authData = await authService.register(formData.email, formData.password);
      const userId = authData.session.user.id; // Or however session comes back

      // 2. Upload ID File
      const idFileExt = idFile.name.split('.').pop();
      const idFileName = ${userId}-.;
      const idUrl = await storageService.uploadFile('id-proofs', idFileName, idFile);

      // 3. Upload Photo if present
      let photoUrl = null;
      if (photoFile) {
        const photoExt = photoFile.name.split('.').pop();
        const photoFileName = ${userId}--photo.;
        photoUrl = await storageService.uploadFile('customer-photos', photoFileName, photoFile);
      }

      // 4. Create User Profile
      await userService.updateMe({
          full_name: formData.fullName,
          mobile: formData.mobile,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_number: formData.emergencyContactNumber,
          org_name: formData.orgName || 'N/A',
          department: formData.department,
          designation: formData.designation,
          employee_id: formData.employeeId,
          joining_date: formData.joiningDate,
          duration: formData.duration,
          requires_parking: formData.requiresParking,
          vehicle_type: formData.vehicleType,
          vehicle_brand_model: formData.vehicleBrandModel,
          vehicle_color: formData.vehicleColor,
          vehicle_registration: formData.vehicleRegistration,
          govt_id_type: formData.idType,
          govt_id_number: formData.idNumber,
          govt_id_copy_url: idUrl,
          customer_photo_url: photoUrl,
          gender: formData.gender,
          date_of_birth: formData.dateOfBirth,
          enrollment_source: 'self_registered',
          is_approved: false
        });

      toast({
        title: "Registration Submitted",
        description: "Your application is pending admin approval.",
      });

      // Clear the session so they must log in later when approved
      await authService.logout();

      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration.",
        variant: "destructive",
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
print("Register refactoring applied.")
