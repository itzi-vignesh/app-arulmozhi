import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, ArrowRight, Building2, Plus, Trash2, Camera } from "lucide-react";
import { CameraModal } from "@/components/ui/camera-modal";

interface DocumentUpload {
  type: string;
  customType: string;
  file: File | null;
}

export default function CompanyRegister() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const gstInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeCameraDocIndex, setActiveCameraDocIndex] = useState<number | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "",
    company_website: "",
    company_email: "",
    industry_type: "",
    custom_industry: "",
    gst_number: "",
    admin_full_name: "",
    admin_email: "",
    admin_mobile: "",
    admin_password: "",
    admin_confirm_password: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    seats_required: 0,
    allow_future_seat_requests: false,
    biometric_required: false,
  });

  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { type: "Registration Certificate", customType: "", file: null }
  ]);

  const updateFormData = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.company_name || !formData.company_name.trim()) {
          stepErrors.company_name = "Company Name is required.";
        }

        if (!formData.company_email || !formData.company_email.trim()) {
          stepErrors.company_email = "Company Email is required.";
        }

        if (!formData.industry_type) {
          stepErrors.industry_type = "Industry Type is required.";
        }

        if (formData.industry_type === "Other" && (!formData.custom_industry || !formData.custom_industry.trim())) {
          stepErrors.custom_industry = "Please specify your industry.";
        }

        if (!formData.gst_number || !formData.gst_number.trim()) {
          stepErrors.gst_number = "GST Number is required.";
        }
        break;

      case 2:
        if (!formData.admin_full_name || !formData.admin_full_name.trim()) {
          stepErrors.admin_full_name = "Full Name is required.";
        }

        if (!formData.admin_email || !formData.admin_email.trim()) {
          stepErrors.admin_email = "Email is required.";
        }

        if (!formData.admin_mobile || !formData.admin_mobile.trim()) {
          stepErrors.admin_mobile = "Mobile Number is required.";
        }

        if (!formData.admin_password) {
          stepErrors.admin_password = "Password is required.";
        }

        if (!formData.admin_confirm_password) {
          stepErrors.admin_confirm_password = "Confirm Password is required.";
        } else if (formData.admin_password !== formData.admin_confirm_password) {
          stepErrors.admin_confirm_password = "Passwords do not match.";
        }
        break;

      case 3:
        if (!formData.address || !formData.address.trim()) {
          stepErrors.address = "Registered Address is required.";
        }
        if (!formData.city || !formData.city.trim()) {
          stepErrors.city = "City is required.";
        }
        if (!formData.state || !formData.state.trim()) {
          stepErrors.state = "State is required.";
        }
        if (!formData.pincode || !formData.pincode.trim()) {
          stepErrors.pincode = "Pincode is required.";
        }
        break;

      case 4:
        if (!formData.seats_required || formData.seats_required <= 0) {
          stepErrors.seats_required = "Seats required must be greater than zero.";
        }
        break;

      case 5:
        const hasValidDoc = documents.some(doc => doc.file && (doc.type !== "Other" || doc.customType));
        if (!hasValidDoc) {
          stepErrors.documents = "Please upload at least one valid document.";
        }
        break;
    }

    setErrors(stepErrors);
    const firstError = Object.keys(stepErrors)[0];
    if (firstError) {
      if (firstError === 'industry_type') {
        document.getElementById('industry_type')?.focus();
      } else if (firstError === 'documents') {
        document.getElementById('documents-container')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        document.getElementById(firstError)?.focus();
      }
      return false;
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

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setLoading(true);

    try {
      const finalData: any = { ...formData };
      delete finalData.admin_confirm_password;
      delete finalData.custom_industry;
      
      if (formData.industry_type === "Other") {
        finalData.industry_type = formData.custom_industry;
      }

      const uploadedDocs = [];
      for (const doc of documents) {
        if (!doc.file) continue;
        const uploadFormData = new FormData();
        uploadFormData.append('file', doc.file);
        const actualType = doc.type === "Other" ? doc.customType : doc.type;
        const fileName = `${Date.now()}_${actualType.replace(/\s+/g, '_')}_${doc.file.name}`;
        
        try {
          const response = await apiClient.post(`/storage/company-documents/${fileName}`, uploadFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          uploadedDocs.push({
            type: actualType,
            name: doc.file.name,
            file_path: response.data.path
          });
        } catch (e) {
          console.error("Document upload failed", e);
        }
      }

      finalData.documents = uploadedDocs;

      await apiClient.post("/companies/register", finalData);
      toast({
        title: "Registration Successful",
        description: "Your corporate account request is pending approval by the Superuser.",
        variant: "default"
      });
      navigate("/login");
    } catch (error: any) {
      let errorMessage = "An error occurred";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errorMessage = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
        const fieldErrors: Record<string, string> = {};
        responseErrors.forEach((e: any) => {
          if (e.field) {
            let fName = e.field;
            if (fName === "company_name") fName = "company_name";
            if (fName === "gst_number") fName = "gst_number";
            if (fName === "company_email") fName = "company_email";
            if (fName === "company_website") fName = "company_website";
            if (fName === "pincode") fName = "pincode";
            if (fName === "seats_requested") fName = "seats_required";
            if (fName === "admin_full_name") fName = "admin_full_name";
            if (fName === "admin_mobile") fName = "admin_mobile";
            if (fName === "admin_email") fName = "admin_email";
            if (fName === "admin_password") fName = "admin_password";
            fieldErrors[fName] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((err: any) => err.msg).join(', ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Registration Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addDocument = () => {
    setDocuments([...documents, { type: "Registration Certificate", customType: "", file: null }]);
  };

  const removeDocument = (index: number) => {
    const newDocs = [...documents];
    newDocs.splice(index, 1);
    setDocuments(newDocs);
  };

  const updateDocument = (index: number, field: keyof DocumentUpload, value: any) => {
    const newDocs = [...documents];
    newDocs[index] = { ...newDocs[index], [field]: value };
    setDocuments(newDocs);
  };

  const industryOptions = [
    "IT Services", "Software Development", "Manufacturing", "Finance",
    "Healthcare", "Education", "Retail", "Logistics", "Consulting",
    "Telecommunications", "Other"
  ];

  const docTypeOptions = [
    "Registration Certificate", "GST Certificate", "PAN", "Address Proof", "Authorized Signatory ID", "Other"
  ];

  const selectClassName = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name" className={errors.company_name ? "text-destructive" : ""}>Company Name *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={e => updateFormData('company_name', e.target.value)}
                className={errors.company_name ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter company name"
              />
              {errors.company_name && <p className="text-xs font-medium text-destructive mt-1">{errors.company_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_website" className={errors.company_website ? "text-destructive" : ""}>Company Website</Label>
              <Input
                id="company_website"
                value={formData.company_website}
                onChange={e => updateFormData('company_website', e.target.value)}
                className={errors.company_website ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter company website (optional)"
              />
              {errors.company_website && <p className="text-xs font-medium text-destructive mt-1">{errors.company_website}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_email" className={errors.company_email ? "text-destructive" : ""}>Company Email *</Label>
              <Input
                id="company_email"
                type="email"
                value={formData.company_email}
                onChange={e => updateFormData('company_email', e.target.value)}
                className={errors.company_email ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter company email"
              />
              {errors.company_email && <p className="text-xs font-medium text-destructive mt-1">{errors.company_email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry_type" className={errors.industry_type ? "text-destructive" : ""}>Industry Type *</Label>
              <select
                id="industry_type"
                className={`${selectClassName} ${errors.industry_type ? "border-destructive focus:ring-destructive" : ""}`}
                value={formData.industry_type}
                onChange={e => updateFormData('industry_type', e.target.value)}
              >
                <option value="">Select Industry</option>
                {industryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {errors.industry_type && <p className="text-xs font-medium text-destructive mt-1">{errors.industry_type}</p>}
            </div>

            {formData.industry_type === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="custom_industry" className={errors.custom_industry ? "text-destructive" : ""}>Please specify industry *</Label>
                <Input
                  id="custom_industry"
                  value={formData.custom_industry}
                  onChange={e => updateFormData('custom_industry', e.target.value)}
                  className={errors.custom_industry ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.custom_industry && <p className="text-xs font-medium text-destructive mt-1">{errors.custom_industry}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="gst_number" className={errors.gst_number ? "text-destructive" : ""}>GST Number *</Label>
              <Input
                ref={gstInputRef}
                id="gst_number"
                value={formData.gst_number}
                onChange={e => {
                  updateFormData('gst_number', e.target.value.toUpperCase());
                }}
                placeholder="Enter GST number (e.g., 22ABCDE1234F1Z5)"
                className={errors.gst_number ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.gst_number && <p className="text-xs font-medium text-destructive mt-1">{errors.gst_number}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_full_name" className={errors.admin_full_name ? "text-destructive" : ""}>Full Name *</Label>
              <Input
                id="admin_full_name"
                value={formData.admin_full_name}
                onChange={e => updateFormData('admin_full_name', e.target.value)}
                className={errors.admin_full_name ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter full name"
              />
              {errors.admin_full_name && <p className="text-xs font-medium text-destructive mt-1">{errors.admin_full_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_email" className={errors.admin_email ? "text-destructive" : ""}>Email *</Label>
              <Input
                id="admin_email"
                type="email"
                value={formData.admin_email}
                onChange={e => updateFormData('admin_email', e.target.value)}
                className={errors.admin_email ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter email address"
              />
              {errors.admin_email && <p className="text-xs font-medium text-destructive mt-1">{errors.admin_email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_mobile" className={errors.admin_mobile ? "text-destructive" : ""}>Mobile Number *</Label>
              <Input
                id="admin_mobile"
                value={formData.admin_mobile}
                onChange={e => updateFormData('admin_mobile', e.target.value)}
                placeholder="10 digits"
                maxLength={10}
                className={errors.admin_mobile ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.admin_mobile && <p className="text-xs font-medium text-destructive mt-1">{errors.admin_mobile}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_password" className={errors.admin_password ? "text-destructive" : ""}>Password *</Label>
              <Input
                id="admin_password"
                type="password"
                value={formData.admin_password}
                onChange={e => updateFormData('admin_password', e.target.value)}
                className={errors.admin_password ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter password (min 8 characters)"
              />
              {errors.admin_password && <p className="text-xs font-medium text-destructive mt-1">{errors.admin_password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_confirm_password" className={errors.admin_confirm_password ? "text-destructive" : ""}>Confirm Password *</Label>
              <Input
                id="admin_confirm_password"
                type="password"
                value={formData.admin_confirm_password}
                onChange={e => updateFormData('admin_confirm_password', e.target.value)}
                className={errors.admin_confirm_password ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Confirm password"
              />
              {errors.admin_confirm_password && <p className="text-xs font-medium text-destructive mt-1">{errors.admin_confirm_password}</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address" className={errors.address ? "text-destructive" : ""}>Registered Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => updateFormData('address', e.target.value)}
                className={errors.address ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter registered address"
              />
              {errors.address && <p className="text-xs font-medium text-destructive mt-1">{errors.address}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className={errors.city ? "text-destructive" : ""}>City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={e => updateFormData('city', e.target.value)}
                className={errors.city ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter city"
              />
              {errors.city && <p className="text-xs font-medium text-destructive mt-1">{errors.city}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state" className={errors.state ? "text-destructive" : ""}>State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={e => updateFormData('state', e.target.value)}
                className={errors.state ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Enter state"
              />
              {errors.state && <p className="text-xs font-medium text-destructive mt-1">{errors.state}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincode" className={errors.pincode ? "text-destructive" : ""}>Pincode *</Label>
              <Input
                id="pincode"
                value={formData.pincode}
                onChange={e => updateFormData('pincode', e.target.value)}
                className={errors.pincode ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="6-digit pincode"
                maxLength={6}
              />
              {errors.pincode && <p className="text-xs font-medium text-destructive mt-1">{errors.pincode}</p>}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seats_required" className={errors.seats_required ? "text-destructive" : ""}>Seats Required *</Label>
              <Input
                id="seats_required"
                type="number"
                value={formData.seats_required || ""}
                onChange={e => updateFormData('seats_required', e.target.value ? parseInt(e.target.value) : 0)}
                className={errors.seats_required ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="Number of seats required"
              />
              {errors.seats_required && <p className="text-xs font-medium text-destructive mt-1">{errors.seats_required}</p>}
            </div>

            <div className="space-y-2">
              <Label>Future Scalability</Label>
              <p className="text-xs text-muted-foreground">Do you expect to scale your seat allocation in the future?</p>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allow_future_seat_requests"
                    checked={formData.allow_future_seat_requests === true}
                    onChange={() => updateFormData('allow_future_seat_requests', true)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allow_future_seat_requests"
                    checked={formData.allow_future_seat_requests === false}
                    onChange={() => updateFormData('allow_future_seat_requests', false)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Biometric Requirement</Label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="biometric_required"
                    checked={formData.biometric_required === true}
                    onChange={() => updateFormData('biometric_required', true)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="biometric_required"
                    checked={formData.biometric_required === false}
                    onChange={() => updateFormData('biometric_required', false)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>No</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div id="documents-container" className="space-y-4">
            <h3 className="font-semibold text-lg text-center">Dynamic Document Upload</h3>
            {errors.documents && <p className="text-sm font-medium text-destructive text-center mt-1">{errors.documents}</p>}
            {documents.map((doc, idx) => (
              <div key={idx} className={`p-4 border rounded-lg space-y-4 relative ${errors.documents ? "border-destructive" : ""}`}>
                {documents.length > 1 && (
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeDocument(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <div className="space-y-2 mt-2">
                  <Label>Document Type</Label>
                  <select className={selectClassName} value={doc.type} onChange={e => updateDocument(idx, 'type', e.target.value)}>
                    {docTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                {doc.type === "Other" && (
                  <div className="space-y-2">
                    <Label>Specify document type *</Label>
                    <Input value={doc.customType} onChange={e => updateDocument(idx, 'customType', e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Document File *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      id={`file-upload-${idx}`}
                      className="hidden"
                      onChange={(e) => {
                        updateDocument(idx, 'file', e.target.files?.[0] || null);
                        setErrors(prev => ({ ...prev, documents: "" }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => document.getElementById(`file-upload-${idx}`)?.click()}
                    >
                      Upload File
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setActiveCameraDocIndex(idx);
                        setShowCameraModal(true);
                      }}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                  {doc.file && (
                    <p className="text-sm text-success mt-1">
                      {doc.file.name ? `File "${doc.file.name}" selected successfully` : "Photo captured successfully"}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={addDocument}>
              <Plus className="w-4 h-4 mr-2" /> Add Document
            </Button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-card">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Corporate Registration</h1>
          <p className="text-muted-foreground mt-2">Register your organization on Nerdshive</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Step {currentStep} of 5</CardTitle>
            <CardDescription>
              {currentStep === 1 && "Company Information"}
              {currentStep === 2 && "Primary Contact Person"}
              {currentStep === 3 && "Company Registered Address"}
              {currentStep === 4 && "Capacity Information"}
              {currentStep === 5 && "Document Upload"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStep()}
            <div className="flex justify-between mt-6">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Previous
                </Button>
              )}
              <div className="ml-auto">
                {currentStep < 5 ? (
                  <Button type="button" onClick={nextStep} disabled={loading} className="gradient-primary">
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={loading} className="gradient-primary">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit Registration"}
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => navigate("/login")} className="text-sm text-primary hover:underline">
                Back to Login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <CameraModal
        isOpen={showCameraModal}
        onClose={() => {
          setShowCameraModal(false);
          setActiveCameraDocIndex(null);
        }}
        onCapture={(file) => {
          if (activeCameraDocIndex !== null) {
            updateDocument(activeCameraDocIndex, 'file', file);
            setErrors(prev => ({ ...prev, documents: "" }));
          }
        }}
        mode="document"
        title="Capture Document Photo"
        description="Position your document within the frame and capture a clear photo"
      />
    </div>
  );
}
