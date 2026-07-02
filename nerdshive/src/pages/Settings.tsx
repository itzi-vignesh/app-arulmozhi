import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { storageService } from '@/services/storageService';
import { adminService } from '@/services/adminService';

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Lock, 
  FileText, 
  Camera, 
  ArrowLeft, 
  Save, 
  Eye, 
  EyeOff,
  Shield,
  Settings as SettingsIcon,
  Upload
} from "lucide-react";
import { CameraModal } from "@/components/ui/camera-modal";
import { ImageModal } from "@/components/ui/image-modal";

interface UserProfile {
  id: string;
  full_name?: string;
  email: string;
  mobile?: string;
  city?: string;
  location?: string;
  occupation?: string;
  govt_id_type?: string;
  govt_id_number?: string;
  govt_id_copy_url?: string;
  customer_photo_url?: string;
  gender?: string;
  reimbursement?: boolean;
  org_name?: string;
  gst_number?: string;
  org_location?: string;
  is_approved?: boolean;
  is_active?: boolean;
  created_at?: string;
  auth_id?: string;
  // New fields
  customer_id?: string;
  date_of_birth?: string;
  employee_id?: string;
  department?: string;
  designation?: string;
  joining_date?: string;
  duration?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  requires_parking?: boolean;
  vehicle_type?: string;
  vehicle_brand_model?: string;
  vehicle_color?: string;
  vehicle_registration?: string;
  enrollment_source?: string;
}

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'superuser'>('user');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showIdCameraModal, setShowIdCameraModal] = useState(false);
  const [newIdFile, setNewIdFile] = useState<File | null>(null);
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<File | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Profile update form
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    mobile: '',
    city: '',
    location: '',
    occupation: '',
    govt_id_type: '',
    govt_id_number: '',
    gender: '',
    reimbursement: false,
    org_name: '',
    gst_number: '',
    org_location: '',
    // New fields
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    requires_parking: false,
    vehicle_type: '',
    vehicle_brand_model: '',
    vehicle_color: '',
    vehicle_registration: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const sessionData = await authService.getSession();
      if (!sessionData?.session?.user?.id) {
        navigate('/login');
        return;
      }

      // We'll fetch from users/me or admins/me depending on their metadata or try both
      const role = sessionData.roles?.is_superuser 
        ? 'superuser' 
        : (sessionData.roles?.is_admin 
          ? 'admin' 
          : (sessionData.roles?.is_company_admin 
            ? 'company_admin' 
            : (sessionData.roles?.is_finance 
              ? 'finance' 
              : 'user')));
      setUserRole(role);

      let profileData = null;
      try {
        if (role === 'superuser' || role === 'admin') {
          profileData = await adminService.getMe().catch(() => userService.getMe());
        } else if (role === 'finance') {
          const { financeService } = await import('@/services/financeService');
          profileData = await financeService.getFinanceMe().catch(() => userService.getMe());
        } else {
          profileData = await userService.getMe();
        }
      } catch (err) {
        profileData = await userService.getMe().catch(() => null);
      }

      if (!profileData) {
        throw new Error("Failed to load profile");
      }

      // Fallback for email and default flags
      if (profileData && !profileData.email && sessionData?.session?.user?.email) {
        profileData.email = sessionData.session.user.email;
      }
      if (profileData && profileData.is_approved === undefined) {
        profileData.is_approved = true;
      }
      if (profileData && profileData.is_active === undefined) {
        profileData.is_active = true;
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
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { session, roles } = await authService.getSession();
      if (!session) throw new Error("Not authenticated");

      const updateData: any = {
        full_name: profileForm.full_name,
        mobile: profileForm.mobile,
        city: profileForm.city,
        location: profileForm.location,
        occupation: profileForm.occupation
      };

      if (!roles?.is_admin && !roles?.is_superuser) {
        Object.assign(updateData, {
          gender: profileForm.gender,
          govt_id_type: profileForm.govt_id_type,
          govt_id_number: profileForm.govt_id_number,
          reimbursement: profileForm.reimbursement,
          org_name: profileForm.org_name,
          gst_number: profileForm.gst_number,
          org_location: profileForm.org_location,
          date_of_birth: profileForm.date_of_birth || null,
          emergency_contact_name: profileForm.emergency_contact_name,
          emergency_contact_number: profileForm.emergency_contact_number,
          requires_parking: profileForm.requires_parking,
          vehicle_type: profileForm.vehicle_type || null,
          vehicle_brand_model: profileForm.vehicle_brand_model,
          vehicle_color: profileForm.vehicle_color,
          vehicle_registration: profileForm.vehicle_registration
        });
      }

      if (roles?.is_superuser || roles?.is_admin || (!roles?.is_admin && !roles?.is_superuser)) {
          await userService.updateMe(updateData);
      }

      toast({ title: "Profile Updated", description: "Your profile has been updated successfully.", variant: "default" });
      fetchUserProfile();
    } catch (error: any) {
      let errMsg = "Failed to update profile";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
      } else if (error.response?.data?.detail) {
        errMsg = error.response.data.detail;
      } else if (error.message) {
        errMsg = error.message;
      }
      toast({ title: "Update Failed", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast({
        title: "Success",
        description: "Password changed successfully",
        variant: "default"
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      let errMsg = "Failed to change password";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
      } else if (error.response?.data?.detail) {
        errMsg = error.response.data.detail;
      }
      toast({
        title: "Error",
        description: errMsg,
        variant: "destructive"
      });
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
        const fileName = `${session.user.id}/govt-id-updated-${Date.now()}.${fileExt}`;
        govtIdCopyUrl = await storageService.uploadIdProof(fileName, newIdFile);
      }

      if (newCustomerPhoto) {
        const fileExt = newCustomerPhoto.name ? newCustomerPhoto.name.split('.').pop() : 'jpg';
        const photoFileName = `${session.user.id}/photo-updated-${Date.now()}.${fileExt}`;
        customerPhotoUrl = await storageService.uploadCustomerPhoto(photoFileName, newCustomerPhoto);
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
  };

  const getSignedUrl = async (bucket: string, path: string): Promise<string | null> => {
    try {
      return storageService.getFileUrl(`${bucket}/${path}`);
    } catch (error) {
      console.error('Error in getSignedUrl:', error);
      return null;
    }
  };

  const viewDocument = async (bucket: string, path: string) => {
    const signedUrl = await getSignedUrl(bucket, path);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    } else {
      toast({
        title: "Error",
        description: "Failed to load document.",
        variant: "destructive"
      });
    }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (userRole === 'superuser') navigate('/superuser/dashboard');
                else if (userRole === 'admin') navigate('/admin/dashboard');
                else if (userRole === 'company_admin') navigate('/corporate/dashboard');
                else if (userRole === 'finance') navigate('/finance/dashboard');
                else navigate('/dashboard');
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <SettingsIcon className="w-8 h-8" />
                Settings
              </h1>
              <p className="text-muted-foreground">
                {userRole === 'company_admin' && userProfile?.full_name 
                  ? `Manage account and preferences for ${userProfile.full_name}`
                  : "Manage your account and preferences"}
              </p>
            </div>
          </div>
          <Badge variant={userRole === 'superuser' ? 'destructive' : (userRole === 'admin' || userRole === 'company_admin' || userRole === 'finance') ? 'default' : 'secondary'}>
            {userRole === 'company_admin' ? 'Corporate Admin' : userRole === 'finance' ? 'Finance' : (userRole.charAt(0).toUpperCase() + userRole.slice(1))}
          </Badge>
        </div>

        <Tabs defaultValue={userRole === 'company_admin' ? 'security' : 'profile'} className="space-y-6">
          <TabsList className={`grid w-full ${userRole === 'company_admin' ? 'grid-cols-2' : userRole === 'user' ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {userRole !== 'company_admin' && (
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
            )}
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Security
            </TabsTrigger>
            {userRole === 'user' && (
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents
              </TabsTrigger>
            )}
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
      Account
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          {userRole !== 'company_admin' && (
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email (Read-only)</Label>
                        <Input
                          id="email"
                          value={userProfile.email}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mobile">Mobile Number</Label>
                        <Input
                          id="mobile"
                          value={profileForm.mobile}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, mobile: e.target.value }))}
                          required
                        />
                      </div>
                      
                      {userRole !== 'superuser' && userRole !== 'admin' && userRole !== 'finance' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              value={profileForm.city}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, city: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                              id="location"
                              value={profileForm.location}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, location: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="occupation">Occupation</Label>
                            <Input
                              id="occupation"
                              value={profileForm.occupation}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, occupation: e.target.value }))}
                              required
                            />
                          </div>
                        </>
                      )}
                      
                      {userRole === 'user' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={profileForm.gender} onValueChange={(value) => setProfileForm(prev => ({ ...prev, gender: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="govt_id_type">Government ID Type</Label>
                            <Select value={profileForm.govt_id_type} onValueChange={(value) => setProfileForm(prev => ({ ...prev, govt_id_type: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ID type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                                <SelectItem value="pan">PAN Card</SelectItem>
                                <SelectItem value="passport">Passport</SelectItem>
                                <SelectItem value="driving_license">Driving License</SelectItem>
                                <SelectItem value="voter_id">Voter ID</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="govt_id_number">Government ID Number</Label>
                            <Input
                              id="govt_id_number"
                              value={profileForm.govt_id_number}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, govt_id_number: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="reimbursement"
                                checked={profileForm.reimbursement}
                                onCheckedChange={(checked) => setProfileForm(prev => ({ ...prev, reimbursement: checked as boolean }))}
                              />
                              <Label htmlFor="reimbursement">Need reimbursement from organization</Label>
                            </div>
                          </div>
                          {profileForm.reimbursement && (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="org_name">Organization Name</Label>
                                <Input
                                  id="org_name"
                                  value={profileForm.org_name}
                                  onChange={(e) => setProfileForm(prev => ({ ...prev, org_name: e.target.value }))}
                                  required={profileForm.reimbursement}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="gst_number">GST Number</Label>
                                <Input
                                  id="gst_number"
                                  value={profileForm.gst_number}
                                  onChange={(e) => setProfileForm(prev => ({ ...prev, gst_number: e.target.value }))}
                                  required={profileForm.reimbursement}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="org_location">Organization Location</Label>
                                <Input
                                  id="org_location"
                                  value={profileForm.org_location}
                                  onChange={(e) => setProfileForm(prev => ({ ...prev, org_location: e.target.value }))}
                                  required={profileForm.reimbursement}
                                />
                              </div>
                            </>
                          )}
                          
                          {/* Date of Birth */}
                          <div className="space-y-2">
                            <Label htmlFor="date_of_birth">Date of Birth</Label>
                            <Input
                              id="date_of_birth"
                              type="date"
                              value={profileForm.date_of_birth}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                            />
                          </div>
  
                          {/* Emergency Contact Section */}
                          <div className="space-y-2 md:col-span-2">
                            <h3 className="text-lg font-medium border-b pb-2">Emergency Contact</h3>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                            <Input
                              id="emergency_contact_name"
                              value={profileForm.emergency_contact_name}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                              placeholder="Contact person name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emergency_contact_number">Emergency Contact Number</Label>
                            <Input
                              id="emergency_contact_number"
                              value={profileForm.emergency_contact_number}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, emergency_contact_number: e.target.value }))}
                              placeholder="Contact person phone"
                            />
                          </div>
  
                          {/* Parking Section */}
                          <div className="space-y-2 md:col-span-2">
                            <h3 className="text-lg font-medium border-b pb-2">Vehicle & Parking</h3>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="requires_parking"
                                checked={profileForm.requires_parking}
                                onCheckedChange={(checked) => setProfileForm(prev => ({ ...prev, requires_parking: checked as boolean }))}
                              />
                              <Label htmlFor="requires_parking">Do you require parking?</Label>
                            </div>
                          </div>
                          {profileForm.requires_parking && (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                                <Select value={profileForm.vehicle_type} onValueChange={(value) => setProfileForm(prev => ({ ...prev, vehicle_type: value }))}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select vehicle type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                                    <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                                    <SelectItem value="bicycle">Bicycle</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="vehicle_brand_model">Vehicle Brand & Model</Label>
                                <Input
                                  id="vehicle_brand_model"
                                  value={profileForm.vehicle_brand_model}
                                  onChange={(e) => setProfileForm(prev => ({ ...prev, vehicle_brand_model: e.target.value }))}
                                  placeholder="e.g., Honda Activa"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="vehicle_color">Vehicle Color</Label>
                                <Input
                                  id="vehicle_color"
                                  value={profileForm.vehicle_color}
                                  onChange={(e) => setProfileForm(prev => ({ ...prev, vehicle_color: e.target.value }))}
                                  placeholder="e.g., Black"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="vehicle_registration">Vehicle Registration Number</Label>
                                <Input
                                  id="vehicle_registration"
                                  value={profileForm.vehicle_registration}
                                  onChange={(e) => setProfileForm(prev => ({ ...prev, vehicle_registration: e.target.value }))}
                                  placeholder="e.g., TN01AB1234"
                                />
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    
                    <Button type="submit" disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? "Updating..." : "Update Profile"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="current_password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={loading}>
                    <Lock className="w-4 h-4 mr-2" />
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab (Only for regular users) */}
          {userRole === 'user' && (
            <TabsContent value="documents">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Documents</CardTitle>
                    <CardDescription>
                      View your current ID proof and profile photo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Government ID Proof</Label>
                        <div className="border rounded-lg p-4 text-center">
                          {userProfile.govt_id_copy_url ? (
                            <ImageModal
                              imageUrl={userProfile.govt_id_copy_url}
                              title="Government ID Proof"
                              triggerText="View ID Proof"
                              triggerVariant="outline"
                              bucket="id-proofs"
                              isStoragePath
                            />
                          ) : (
                            <p className="text-muted-foreground">No ID proof uploaded</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Profile Photo</Label>
                        <div className="border rounded-lg p-4 text-center">
                          {userProfile.customer_photo_url ? (
                            <ImageModal
                              imageUrl={userProfile.customer_photo_url || ''}
                              title="Profile Photo"
                              triggerText="View Photo"
                              triggerVariant="outline"
                              bucket="customer-photos"
                              isStoragePath
                            />
                          ) : (
                            <p className="text-muted-foreground">No photo uploaded</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Update Documents</CardTitle>
                    <CardDescription>
                      Capture new ID proof or profile photo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>New ID Proof</Label>
                        <Button
                          variant="outline"
                          onClick={() => setShowIdCameraModal(true)}
                          className="w-full"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          {newIdFile ? 'Retake ID Photo' : 'Capture ID Photo'}
                        </Button>
                        {newIdFile && (
                          <p className="text-sm text-green-600">✓ New ID photo ready</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>New Profile Photo</Label>
                        <Button
                          variant="outline"
                          onClick={() => setShowCameraModal(true)}
                          className="w-full"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          {newCustomerPhoto ? 'Retake Profile Photo' : 'Capture Profile Photo'}
                        </Button>
                        {newCustomerPhoto && (
                          <p className="text-sm text-green-600">✓ New profile photo ready</p>
                        )}
                      </div>
                    </div>
                    
                    {(newIdFile || newCustomerPhoto) && (
                      <Button onClick={handleDocumentUpdate} disabled={loading}>
                        <Upload className="w-4 h-4 mr-2" />
                        {loading ? "Updating..." : "Update Documents"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Account Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  View your account status and details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProfile.full_name && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Full Name</Label>
                      <div className="p-3 bg-muted rounded font-medium text-foreground">
                        {userProfile.full_name}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <div className="p-3 bg-muted rounded">
                      <Badge variant={userRole === 'superuser' ? 'destructive' : (userRole === 'admin' || userRole === 'company_admin' || userRole === 'finance') ? 'default' : 'secondary'}>
                        {userRole === 'company_admin' ? 'Corporate Admin' : userRole === 'finance' ? 'Finance' : (userRole.charAt(0).toUpperCase() + userRole.slice(1))}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Account Status</Label>
                    <div className="p-3 bg-muted rounded">
                      <Badge variant={userProfile.is_approved ? 'default' : 'destructive'}>
                        {userProfile.is_approved ? '✅ Approved' : '⏳ Pending Approval'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Member Since</Label>
                    <div className="p-3 bg-muted rounded">
                      {new Date(userProfile.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  
                  {userRole === 'user' && (
                    <div className="space-y-2">
                      <Label>Activity Status</Label>
                      <div className="p-3 bg-muted rounded">
                        <Badge variant={userProfile.is_active !== false ? 'default' : 'destructive'}>
                          {userProfile.is_active !== false ? '✅ Active' : '❌ Inactive'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Camera Modals */}
      <CameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCustomerPhotoCapture}
        mode="selfie"
        title="Update Profile Photo"
        description="Take a clear photo of yourself for your profile"
      />

      <CameraModal
        isOpen={showIdCameraModal}
        onClose={() => setShowIdCameraModal(false)}
        onCapture={handleIdPhotoCapture}
        mode="document"
        title="Update ID Proof"
        description="Take a clear photo of your government ID document"
      />
    </div>
  );
}
