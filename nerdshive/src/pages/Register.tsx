import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { storageService } from '@/services/storageService';

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, ArrowRight, Camera, Hexagon, Shield } from "lucide-react";
import { CameraModal } from "@/components/ui/camera-modal";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import MfaSetupWizard from "@/components/MfaSetupWizard";

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  gender: string;
  mobile: string;
  city: string;
  location: string;
  occupation: string;
  govtIdType: string;
  govtIdNumber: string;
  reimbursement: boolean;
  orgName: string;
  gstNumber: string;
  orgLocation: string;
}

export default function Register() {
  const [currentStep, setCurrentStep] = useState(1);
  const [enableMfa, setEnableMfa] = useState(true);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupToken, setMfaSetupToken] = useState("");
  const [registeredUserId, setRegisteredUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const gstInputRef = useRef<HTMLInputElement>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [customerPhoto, setCustomerPhoto] = useState<File | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showCustomerCameraModal, setShowCustomerCameraModal] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    mobile: "",
    city: "",
    location: "",
    occupation: "",
    govtIdType: "",
    govtIdNumber: "",
    reimbursement: false,
    orgName: "",
    gstNumber: "",
    orgLocation: "",
  });

  const updateFormData = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };



  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: {
        const stepErrors: Record<string, string> = {};
        
        if (!formData.fullName || !formData.fullName.trim()) {
          stepErrors.fullName = "Full Name is required.";
        }

        if (!formData.email || !formData.email.trim()) {
          stepErrors.email = "Email is required.";
        }

        if (!formData.mobile || !formData.mobile.trim()) {
          stepErrors.mobile = "Mobile Number is required.";
        }

        if (!formData.password) {
          stepErrors.password = "Password is required.";
        }

        if (!formData.confirmPassword) {
          stepErrors.confirmPassword = "Confirm Password is required.";
        } else if (formData.password !== formData.confirmPassword) {
          stepErrors.confirmPassword = "Passwords do not match.";
        }

        setErrors(stepErrors);
        const firstError = Object.keys(stepErrors)[0];
        if (firstError) {
          document.getElementById(firstError)?.focus();
          return false;
        }
        break;
      }
      case 2: {
        const stepErrors: Record<string, string> = {};
        
        if (!formData.gender) stepErrors.gender = "Gender is required.";
        if (!formData.city || !formData.city.trim()) stepErrors.city = "City is required.";
        if (!formData.location || !formData.location.trim()) stepErrors.location = "Location is required.";
        if (!formData.occupation || !formData.occupation.trim()) stepErrors.occupation = "Occupation is required.";
        if (!formData.orgName || !formData.orgName.trim()) stepErrors.orgName = "Organization Name is required.";

        if (formData.reimbursement) {
          if (!formData.gstNumber || !formData.gstNumber.trim()) {
            stepErrors.gstNumber = "GST Number is required.";
          }
          if (!formData.orgLocation || !formData.orgLocation.trim()) {
            stepErrors.orgLocation = "Organization Location is required.";
          }
        }

        setErrors(stepErrors);
        const firstError = Object.keys(stepErrors)[0];
        if (firstError) {
          if (firstError === 'gender') {
            (document.querySelector("[role='combobox']") as HTMLElement)?.focus();
          } else {
            document.getElementById(firstError)?.focus();
          }
          return false;
        }
        break;
      }
      case 3: {
        const stepErrors: Record<string, string> = {};
        
        if (!formData.govtIdType) stepErrors.govtIdType = "Government ID Type is required.";
        
        if (!formData.govtIdNumber || !formData.govtIdNumber.trim()) {
          stepErrors.govtIdNumber = "Government ID Number is required.";
        }

        if (!idFile) stepErrors.idFile = "ID document photo is required.";

        setErrors(stepErrors);
        const firstError = Object.keys(stepErrors)[0];
        if (firstError) {
          if (firstError === 'govtIdType') {
            (document.querySelector("[role='combobox']") as HTMLElement)?.focus();
          } else {
            document.getElementById(firstError)?.focus();
          }
          return false;
        }
        break;
      }
      case 4: {
        const stepErrors: Record<string, string> = {};
        if (!customerPhoto) stepErrors.customerPhoto = "Selfie photo is required.";
        
        setErrors(stepErrors);
        if (Object.keys(stepErrors).length > 0) return false;
        break;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setErrors({});
    setCurrentStep(prev => prev - 1);
  };

  const handleCameraCapture = () => {
    setShowCameraModal(true);
  };

  const handleCameraPhotoCapture = (file: File) => {
    setIdFile(file);
    setShowCameraModal(false);
    toast({
      title: "Photo Captured",
      description: "ID document photo captured successfully.",
      variant: "default"
    });
  };

  const handleCustomerPhotoCapture = () => {
    setShowCustomerCameraModal(true);
  };

  const handleCustomerCameraPhotoCapture = (file: File) => {
    setCustomerPhoto(file);
    setShowCustomerCameraModal(false);
    toast({
      title: "Photo Captured",
      description: "Your photo captured successfully.",
      variant: "default"
    });
  };

  const completeRegistrationProfile = async (userId: string) => {
    setLoading(true);
    try {
      // Upload files with better error handling
      let govtIdCopyUrl = "";
      let customerPhotoUrl = "";

      try {
        // Upload ID document to Supabase Storage
        if (idFile) {
          const fileName = `${userId}/govt-id.jpg`;
          
          const formData = new FormData();
          formData.append('file', idFile);
          const response = await apiClient.post(`/storage/id-proofs/${fileName}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          govtIdCopyUrl = response.data.path;
        }

        // Upload customer photo to Supabase Storage
        if (customerPhoto) {
          const photoFileName = `${userId}/customer-photo.jpg`;
          
          const photoFormData = new FormData();
          photoFormData.append('file', customerPhoto);
          const response = await apiClient.post(`/storage/customer-photos/${photoFileName}`, photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          customerPhotoUrl = response.data.path;
        }
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        toast({
          title: "Upload Failed",
          description: uploadError instanceof Error ? uploadError.message : "Failed to upload files. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Check if this is a re-registration after rejection
      const { data: authUser } = await apiClient.get('/auth/session');
      const userMetadata = authUser?.user?.user_metadata;
      let isReregistration = false;
      let rejectionCount = 0;
      
      if (userMetadata?.last_rejection) {
        isReregistration = true;
        rejectionCount = (userMetadata.rejection_history?.length || 0) + 1;
      }

      // Insert user data into users table
      await apiClient.post('/users/', {
        auth_id: userId,
        email: formData.email.trim(),
        full_name: formData.fullName.trim(),
        gender: formData.gender,
        mobile: formData.mobile,
        city: formData.city.trim(),
        location: formData.location.trim(),
        occupation: formData.occupation.trim(),
        govt_id_type: formData.govtIdType,
        govt_id_number: formData.govtIdNumber.trim(),
        govt_id_copy_url: govtIdCopyUrl,
        customer_photo_url: customerPhotoUrl,
        reimbursement: formData.reimbursement,
        org_name: formData.reimbursement ? formData.orgName.trim() : null,
        gst_number: formData.reimbursement ? formData.gstNumber.trim() : null,
        org_location: formData.reimbursement ? formData.orgLocation.trim() : null,
        is_approved: false
      });

      // If this is a re-registration, update user metadata to clear rejection status
      if (isReregistration) {
        await apiClient.put('/users/me', {
          data: { 
            can_reregister: false,
            registration_count: rejectionCount,
            last_registration: new Date().toISOString()
          }
        });
      }

      toast({
        title: "Registration Successful!",
        description: "Your approval request has been sent to administrators. You will be notified once approved.",
        variant: "default"
      });

      // Sign out the user since they need approval
      await apiClient.post("/auth/logout");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/login");

    } catch (error: any) {
      console.error('Profile complete error:', error);
      let errorMsg = "Failed to submit profile details.";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errorMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
        const fieldErrors: Record<string, string> = {};
        responseErrors.forEach((e: any) => {
          if (e.field) {
            let fName = e.field;
            if (fName === "full_name") fName = "fullName";
            if (fName === "gst_number") fName = "gstNumber";
            if (fName === "org_name") fName = "orgName";
            if (fName === "org_location") fName = "orgLocation";
            if (fName === "govt_id_number") fName = "govtIdNumber";
            if (fName === "govt_id_type") fName = "govtIdType";
            fieldErrors[fName] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      toast({
        title: "Profile Completion Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("mfa_pending_token");

    try {
      // Create auth user
      const response = await apiClient.post("/auth/register", {
        email: formData.email.trim(),
        password: formData.password,
        enable_mfa: enableMfa
      });
      const authData = response.data;

      if (!authData || !authData.user) {
        toast({
          title: "Registration Failed",
          description: "Failed to create user account.",
          variant: "destructive"
        });
        return;
      }

      if (authData.mfa_setup_required) {
        setMfaSetupToken(authData.mfa_token);
        setRegisteredUserId(authData.user.id);
        setShowMfaSetup(true);
        // Do not proceed with file upload yet; wait for MFA setup to succeed.
        return;
      }

      // Persist tokens so apiClient interceptor can attach them to subsequent requests
      localStorage.setItem('access_token', authData.access_token);
      localStorage.setItem('refresh_token', authData.refresh_token);

      await completeRegistrationProfile(authData.user.id);

    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMsg = "An unexpected error occurred. Please try again.";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errorMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
        const fieldErrors: Record<string, string> = {};
        responseErrors.forEach((e: any) => {
          if (e.field) {
            let fName = e.field;
            if (fName === "full_name") fName = "fullName";
            if (fName === "gst_number") fName = "gstNumber";
            fieldErrors[fName] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') errorMsg = detail;
      } else if (error.message) {
        errorMsg = error.message;
      }
      toast({
        title: "Registration Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className={errors.fullName ? "text-destructive" : ""}>Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => updateFormData('fullName', e.target.value)}
                placeholder="Enter your full name"
                className={errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.fullName && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.fullName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className={errors.email ? "text-destructive" : ""}>Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                placeholder="Enter your email"
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.email && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile" className={errors.mobile ? "text-destructive" : ""}>Mobile Number *</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => updateFormData('mobile', e.target.value)}
                placeholder="Enter 10-digit mobile number"
                maxLength={10}
                className={errors.mobile ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.mobile && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.mobile}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className={errors.password ? "text-destructive" : ""}>Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                placeholder="Enter password (min 8 characters)"
                className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.password && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.password}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className={errors.confirmPassword ? "text-destructive" : ""}>Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                placeholder="Confirm your password"
                className={errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.confirmPassword && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Account Security Section */}
            <div className="pt-4 border-t border-muted mt-4 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm">Account Security</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Protect your account by enabling Multi-Factor Authentication using an Authenticator App.
              </p>
              <RadioGroup
                value={enableMfa ? "enable" : "skip"}
                onValueChange={(val) => setEnableMfa(val === "enable")}
                className="flex flex-col gap-2 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="mfa-enable" />
                  <Label htmlFor="mfa-enable" className="text-xs cursor-pointer font-normal">
                    Enable Authentication Now (Recommended)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="mfa-skip" />
                  <Label htmlFor="mfa-skip" className="text-xs cursor-pointer font-normal">
                    Skip for Now
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gender" className={errors.gender ? "text-destructive" : ""}>Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => updateFormData('gender', value)}>
                <SelectTrigger className={errors.gender ? "border-destructive focus-visible:ring-destructive" : ""}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non-binary">Non-Binary</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.gender}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className={errors.city ? "text-destructive" : ""}>City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateFormData('city', e.target.value)}
                placeholder="Enter your city"
                className={errors.city ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.city && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.city}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className={errors.location ? "text-destructive" : ""}>Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateFormData('location', e.target.value)}
                placeholder="Enter your address/location"
                className={errors.location ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.location && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.location}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation" className={errors.occupation ? "text-destructive" : ""}>Occupation *</Label>
              <Input
                id="occupation"
                value={formData.occupation}
                onChange={(e) => updateFormData('occupation', e.target.value)}
                placeholder="Enter your occupation"
                className={errors.occupation ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.occupation && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.occupation}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgName" className={errors.orgName ? "text-destructive" : ""}>Organization Name *</Label>
              <Input
                id="orgName"
                value={formData.orgName}
                onChange={(e) => updateFormData('orgName', e.target.value)}
                placeholder="Enter your organization name"
                className={errors.orgName ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.orgName && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.orgName}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="reimbursement"
                checked={formData.reimbursement}
                onCheckedChange={(checked) => updateFormData('reimbursement', !!checked)}
              />
              <Label htmlFor="reimbursement">
                I need reimbursement from my organization
              </Label>
            </div>
            
            {formData.reimbursement && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gstNumber" className={errors.gstNumber ? "text-destructive" : ""}>GST Number *</Label>
                  <Input
                    ref={gstInputRef}
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={(e) => {
                      updateFormData('gstNumber', e.target.value.toUpperCase());
                    }}
                    placeholder="Enter GST number (e.g., 22ABCDE1234F1Z5)"
                    className={errors.gstNumber ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.gstNumber && (
                    <p className="text-xs font-medium text-destructive mt-1">{errors.gstNumber}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgLocation" className={errors.orgLocation ? "text-destructive" : ""}>Organization Location *</Label>
                  <Input
                    id="orgLocation"
                    value={formData.orgLocation}
                    onChange={(e) => updateFormData('orgLocation', e.target.value)}
                    placeholder="Enter organization address"
                    className={errors.orgLocation ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.orgLocation && (
                    <p className="text-xs font-medium text-destructive mt-1">{errors.orgLocation}</p>
                  )}
                </div>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="govtIdType" className={errors.govtIdType ? "text-destructive" : ""}>Government ID Type *</Label>
              <Select value={formData.govtIdType} onValueChange={(value) => updateFormData('govtIdType', value)}>
                <SelectTrigger className={errors.govtIdType ? "border-destructive focus-visible:ring-destructive" : ""}>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AADHAAR">Aadhaar Card</SelectItem>
                  <SelectItem value="PAN">PAN Card</SelectItem>
                  <SelectItem value="OTHER">Other Government ID</SelectItem>
                </SelectContent>
              </Select>
              {errors.govtIdType && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.govtIdType}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="govtIdNumber" className={errors.govtIdNumber ? "text-destructive" : ""}>Government ID Number *</Label>
              <Input
                id="govtIdNumber"
                value={formData.govtIdNumber}
                onChange={(e) => updateFormData('govtIdNumber', e.target.value.toUpperCase())}
                placeholder={
                  formData.govtIdType === 'AADHAAR' ? 'Enter 12-digit Aadhaar number' :
                  formData.govtIdType === 'PAN' ? 'Enter 10-character PAN number' :
                  formData.govtIdType === 'OTHER' ? 'Enter your ID number' :
                  'Enter ID number'
                }
                className={errors.govtIdNumber ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.govtIdNumber && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.govtIdNumber}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className={errors.idFile ? "text-destructive" : ""}>Capture ID Document *</Label>
              <Button
                type="button"
                variant="outline"
                onClick={handleCameraCapture}
                className={`w-full ${errors.idFile ? "border-destructive text-destructive hover:bg-destructive/10" : ""}`}
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture ID Document Photo
              </Button>
              {idFile && (
                <p className="text-sm text-success">
                  ID document photo captured successfully
                </p>
              )}
              {errors.idFile && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.idFile}</p>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mb-4">
                <Camera className="w-16 h-16 mx-auto text-primary mb-4" />
                <h3 className="text-lg font-semibold">Capture Your Photo</h3>
                <p className="text-sm text-muted-foreground">
                  Take a clear photo of yourself for identity verification
                </p>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleCustomerPhotoCapture}
                className={`w-full ${errors.customerPhoto ? "border-destructive text-destructive hover:bg-destructive/10" : ""}`}
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture Photo
              </Button>
              
              {customerPhoto && (
                <p className="text-sm text-success mt-2">
                  Your photo captured successfully
                </p>
              )}
              {errors.customerPhoto && (
                <p className="text-xs font-medium text-destructive mt-1">{errors.customerPhoto}</p>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mb-4">
                <Hexagon className="w-16 h-16 mx-auto text-primary mb-4" />
                <h3 className="text-lg font-semibold">Review & Confirm</h3>
                <p className="text-sm text-muted-foreground">
                  Please review your information before submitting
                </p>
              </div>
              
              <div className="text-left space-y-3 bg-secondary/50 p-4 rounded-lg">
                <div><strong>Name:</strong> {formData.fullName}</div>
                <div><strong>Email:</strong> {formData.email}</div>
                <div><strong>Gender:</strong> {formData.gender}</div>
                <div><strong>Mobile:</strong> {formData.mobile}</div>
                <div><strong>City:</strong> {formData.city}</div>
                <div><strong>Location:</strong> {formData.location}</div>
                <div><strong>Occupation:</strong> {formData.occupation}</div>
                <div><strong>ID Type:</strong> {formData.govtIdType}</div>
                <div><strong>ID Number:</strong> {formData.govtIdNumber}</div>
                {formData.reimbursement && (
                  <>
                    <div><strong>Organization:</strong> {formData.orgName}</div>
                    <div><strong>GST Number:</strong> {formData.gstNumber}</div>
                    <div><strong>Org Location:</strong> {formData.orgLocation}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Branding */}
        <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-card">
          <img src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" alt="Nerdshive" className="w-12 h-12" />
        </div>
          <h1 className="text-3xl font-bold text-foreground">Join Nerdshive</h1>
          <p className="text-muted-foreground mt-2">Create your workspace account</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>
              Registration - Step {currentStep} of 5
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Let's start with your basic information"}
              {currentStep === 2 && "Tell us more about yourself and organization details"}
              {currentStep === 3 && "Upload a valid government-issued ID for identity verification."}
              {currentStep === 4 && "Capture your photo for identity verification"}
              {currentStep === 5 && "Review your information before submitting"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStep()}

            <div className="flex justify-between mt-6">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
              
              <div className="ml-auto">
                {currentStep < 5 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={loading}
                    className="gradient-primary hover:shadow-primary transition-smooth"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="gradient-primary hover:shadow-primary transition-smooth"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Complete Registration"
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-primary hover:text-primary-dark font-medium transition-smooth cursor-pointer"
                  disabled={loading}
                >
                  Sign in here
                </button>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Registering for a company?{" "}
                <button
                  onClick={() => navigate("/company-register")}
                  className="text-primary hover:text-primary-dark font-medium transition-smooth cursor-pointer"
                  disabled={loading}
                >
                  Register your company here
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Camera Modals */}
        <CameraModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onCapture={handleCameraPhotoCapture}
          mode="document"
          title="Capture ID Document"
          description="Position your government ID document clearly within the frame and capture a photo"
        />
        <CameraModal
          isOpen={showCustomerCameraModal}
          onClose={() => setShowCustomerCameraModal(false)}
          onCapture={handleCustomerCameraPhotoCapture}
          mode="selfie"
          title="Capture Your Photo"
          description="Take a clear selfie for identity verification. Make sure your face is well-lit and clearly visible"
        />
        <MfaSetupWizard
          isOpen={showMfaSetup}
          onClose={() => setShowMfaSetup(false)}
          onSuccess={() => completeRegistrationProfile(registeredUserId)}
          mfaToken={mfaSetupToken}
        />
      </div>
    </div>
  );
}