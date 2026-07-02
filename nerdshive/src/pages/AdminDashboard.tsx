import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { adminService } from '@/services/adminService';
import { businessService } from '@/services/businessService';
import { dashboardService } from '@/services/dashboardService';
import { auditService } from '@/services/auditService';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';

import { ImageModal } from "@/components/ui/image-modal";
import { formatDate } from "@/lib/dateUtils";
import { buildCombinedUsage } from "@/lib/historyUtils";
import { RejectionReasonModal } from "@/components/ui/rejection-reason-modal";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationBell } from "@/components/ui/notification-bell";
import { 
  LogOut, 
  UserCheck, 
  Users, 
  MessageSquare, 
  FileText, 
  Activity,
  Upload,
  Eye,
  Check,
  X,
  Loader2,
  Hexagon,
  Edit,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Building,
  Image as ImageIcon,
  History,
  Shield,
  Trash2,
  Settings,
  Clock
} from "lucide-react";
import { CheckInApprovalTab } from "@/components/CheckInApprovalTab";
import { PaymentVerificationTab } from "@/components/PaymentVerificationTab";
import { ActivityTabComponent } from "@/components/ActivityTabComponent";

import { Download } from "lucide-react";
import { AdminMeetingsTab } from "@/components/AdminMeetingsTab";
import { OrganizationApprovalTab } from "@/components/OrganizationApprovalTab";

interface User {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
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
  is_approved: boolean;
  is_active?: boolean;
  status?: string;
  created_at: string;
  auth_id: string;
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
  approval_history?: {
    approved_at?: string;
    approved_by?: string;
    approved_by_name?: string;
    approved_by_email?: string;
    registration_count?: number;
    was_rejected_before?: boolean;
  };
}

interface Query {
  id: string;
  query_text: string;
  response: string | null;
  status: string;
  created_at: string;
  user_id: string;
  users?: {
    full_name: string;
    email: string;
  };
}

interface UsageLog {
  id: string;
  plan_type: string;
  date_selected: string;
  amount: number;
  created_at: string;
  user_id: string;
  users?: {
    full_name: string;
    email: string;
  };
}

interface ContentSection {
  section: string;
  content: string;
  last_updated: string;
}

interface PricingPlan {
  id: string;
  category: string;
  plan_name: string;
  price: number;
  billing_type: string;
  features_json: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}


interface CustomerDetailCardProps {
  user: User;
  usageLogs: UsageLog[];
  plans: Plan[];
  getSignedUrl: (bucket: string, path: string) => Promise<string | null>;
}

interface Plan {
  id: string;
  user_id: string;
  plan_type: string;
  amount: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface CustomerDetailCardPropsExtended extends CustomerDetailCardProps {
  isExpanded: boolean;
  onToggle: () => void;
  getInactivePeriod: (lastVisit: Date | null) => string;
  onRefresh?: () => void;
}

const CustomerDetailCard = ({ user, usageLogs, plans, getSignedUrl, isExpanded, onToggle, getInactivePeriod, onRefresh }: CustomerDetailCardPropsExtended) => {
  const [loading, setLoading] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const { toast } = useToast();

  const userUsageLogs = usageLogs.filter(log => log.user_id === user.id);
  const userPlans = plans.filter(plan => plan.user_id === user.id);
  
  // Get truly active plan based on current date
  const today = new Date().toISOString().split('T')[0];
  const activePlan = userPlans.find(plan => 
    plan.is_active && 
    plan.start_date <= today && 
    plan.end_date >= today
  );
  const hasActivePlan = !!activePlan;
  
  // Combine usage logs and plans for complete history (deduped & sorted)
  const combinedHistory = buildCombinedUsage(
    userUsageLogs as any,
    userPlans as any
  );
  
  const totalSpent = combinedHistory.reduce((sum, item) => sum + Number(item.amount), 0);
  const lastVisit = combinedHistory.length > 0 
    ? new Date(combinedHistory[0].date)
    : null;

  const confirmDeactivate = async () => {
    setLoading(true);
    try {
      await adminService.makeUserInactive(user.auth_id);
      toast({
        title: "User Made Inactive",
        description: `${user.full_name} has been made inactive.`,
      });
      setDeactivateOpen(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error making user inactive:', error);
      toast({
        title: "Error",
        description: "Failed to make user inactive. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmActivate = async () => {
    setLoading(true);
    try {
      await adminService.activateUser(user.auth_id);
      toast({
        title: "User Activated",
        description: `${user.full_name} has been activated successfully.`,
      });
      setActivateOpen(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error activating user:', error);
      toast({
        title: "Error",
        description: "Failed to activate user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{user.full_name}</h3>
                {user.status === "INACTIVE" ? (
                  <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 text-[10px] py-0 px-1.5 h-4">
                    INACTIVE
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-[10px] py-0 px-1.5 h-4">
                    ACTIVE
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {activePlan && (
                <Badge variant="default" className="mt-1 bg-green-100 text-green-800 text-xs">
                  Active: {activePlan.plan_type} plan
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Total: ₹{totalSpent.toFixed(2)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 space-y-6 border-t pt-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="font-medium text-sm">Account Status</span>
              {user.status === "INACTIVE" ? (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  INACTIVE
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  ACTIVE
                </Badge>
              )}
            </div>

            {/* Current Active Plan */}
            {activePlan && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Current Active Plan
                </h4>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Plan Type:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800 capitalize">
                        {activePlan.plan_type} Plan
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Amount:</span>
                      <span>₹{activePlan.amount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Valid From:</span>
                      <span>{new Date(activePlan.start_date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Valid Until:</span>
                      <span>{new Date(activePlan.end_date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Status:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        ✅ Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customer ID & Personal Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Personal Information
                </h4>
                <div className="space-y-2 text-sm">
                  {user.customer_id && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3 h-3 text-muted-foreground" />
                      <span><strong>Customer ID:</strong> {user.customer_id}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{user.mobile}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span>{user.city}, {user.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3 h-3 text-muted-foreground" />
                    <span>{user.occupation}</span>
                  </div>
                  {user.gender && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 text-muted-foreground">👤</span>
                      <span className="capitalize">{user.gender}</span>
                    </div>
                  )}
                  {user.date_of_birth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>DOB: {new Date(user.date_of_birth).toLocaleDateString('en-GB')}</span>
                    </div>
                  )}
                  {user.enrollment_source && user.enrollment_source !== 'self_registered' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Bulk Enrolled</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Employment Information */}
              {(user.employee_id || user.department || user.designation) && (
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Employment Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    {user.employee_id && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3 h-3 text-muted-foreground" />
                        <span>Employee ID: {user.employee_id}</span>
                      </div>
                    )}
                    {user.org_name && (
                      <div className="flex items-center gap-2">
                        <Building className="w-3 h-3 text-muted-foreground" />
                        <span>{user.org_name}</span>
                      </div>
                    )}
                    {user.department && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span>Dept: {user.department}</span>
                      </div>
                    )}
                    {user.designation && (
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-muted-foreground" />
                        <span>Role: {user.designation}</span>
                      </div>
                    )}
                    {user.joining_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>Joined: {new Date(user.joining_date).toLocaleDateString('en-GB')}</span>
                      </div>
                    )}
                    {user.duration && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="capitalize">{user.duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Contact & Vehicle Info */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Emergency Contact */}
              {(user.emergency_contact_name || user.emergency_contact_number) && (
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Emergency Contact
                  </h4>
                  <div className="space-y-2 text-sm">
                    {user.emergency_contact_name && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span>{user.emergency_contact_name}</span>
                      </div>
                    )}
                    {user.emergency_contact_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{user.emergency_contact_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicle & Parking */}
              {user.requires_parking && (
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Vehicle & Parking
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                        Parking Required
                      </Badge>
                    </div>
                    {user.vehicle_type && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="capitalize">{user.vehicle_type}</span>
                      </div>
                    )}
                    {user.vehicle_brand_model && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Model:</span>
                        <span>{user.vehicle_brand_model}</span>
                      </div>
                    )}
                    {user.vehicle_color && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Color:</span>
                        <span>{user.vehicle_color}</span>
                      </div>
                    )}
                    {user.vehicle_registration && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Reg No:</span>
                        <span>{user.vehicle_registration}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Organization Information (for reimbursement) */}
            {user.reimbursement && (user.org_name || user.gst_number) && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Reimbursement Details
                </h4>
                <div className="space-y-2 text-sm">
                  {user.org_name && (
                    <div className="flex items-center gap-2">
                      <Building className="w-3 h-3 text-muted-foreground" />
                      <span>{user.org_name}</span>
                    </div>
                  )}
                  {user.gst_number && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3 h-3 text-muted-foreground" />
                      <span>GST: {user.gst_number}</span>
                    </div>
                  )}
                  {user.org_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span>{user.org_location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3 h-3 text-green-600" />
                    <span className="text-green-600">Reimbursement Enabled</span>
                  </div>
                </div>
              </div>
            )}

            {/* ID Document */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Identity Document
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2 text-sm">
                  <div><strong>Type:</strong> {user.govt_id_type}</div>
                  <div><strong>Number:</strong> {user.govt_id_number}</div>
                </div>
                 {user.govt_id_copy_url && (
                   <div className="space-y-2">
                     <div className="text-sm font-medium">Document Image:</div>
                      <ImageModal
                        imageUrl={user.govt_id_copy_url}
                        title={`${user.full_name} - Government ID`}
                        triggerText="View Document"
                        triggerVariant="outline"
                        bucket="id-proofs"
                        isStoragePath
                      />
                   </div>
                 )}
              </div>
            </div>

            {/* Customer Photo */}
            {user.customer_photo_url && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Customer Photo
                </h4>
               <ImageModal
                 imageUrl={user.customer_photo_url}
                 title={`${user.full_name} - Photo`}
                 triggerText="View Photo"
                 triggerVariant="outline"
                 bucket="customer-photos"
                 isStoragePath
               />
              </div>
            )}

            {/* Usage History */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Usage History ({combinedHistory.length} visits)
              </h4>
              {combinedHistory.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                    <span>Plan</span>
                    <span>Date</span>
                    <span>Amount</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {combinedHistory.slice(0, 10).map((item) => {
                      const planName = item.plan_type === 'day' ? 'Day Pass' : 
                                      item.plan_type === 'week' ? 'Weekly Pass' : 'Monthly Pass';
                      return (
                        <div key={`${item.source}-${item.id}`} className="grid grid-cols-3 gap-4 text-sm py-1">
                          <span>{planName}</span>
                          <span>{formatDate(item.date)}</span>
                          <span>₹{item.amount}</span>
                        </div>
                      );
                    })}
                  </div>
                  {combinedHistory.length > 10 && (
                    <div className="text-xs text-muted-foreground">
                      ... and {combinedHistory.length - 10} more visits
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No usage history yet</p>
              )}
            </div>

            {/* Account Statistics */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Account Statistics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-muted rounded">
                  <div className="font-medium">₹{totalSpent.toFixed(2)}</div>
                  <div className="text-muted-foreground">Total Spent</div>
                </div>
                <div className="text-center p-3 bg-muted rounded">
                  <div className="font-medium">{combinedHistory.length}</div>
                  <div className="text-muted-foreground">Total Visits</div>
                </div>
                <div className="text-center p-3 bg-muted rounded">
                  <div className="font-medium">
                    {lastVisit ? formatDate(lastVisit) : 'Never'}
                  </div>
                  <div className="text-muted-foreground">Last Visit</div>
                </div>
                <div className="text-center p-3 bg-muted rounded">
                  <div className="font-medium">
                    {formatDate(user.created_at)}
                  </div>
                  <div className="text-muted-foreground">Member Since</div>
                </div>
              </div>
            </div>

            {/* Approval History */}
            {user.approval_history && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Approval History
                </h4>
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      ✅ Approved
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Approved on:</span>
                    <span className="text-sm">{formatDate(user.approval_history.approved_at || user.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Approved by:</span>
                    <span className="text-sm font-medium">{user.approval_history.approved_by_name || user.approval_history.approved_by_email || (user.approval_history.approved_by ? 'Approved' : 'Pending')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Registration attempts:</span>
                    <span className="text-sm">{user.approval_history.registration_count || 1}</span>
                  </div>
                  {user.approval_history.was_rejected_before && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Previous status:</span>
                      <Badge variant="destructive" className="text-xs">
                        Previously Rejected
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Admin Actions */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Admin Actions
              </h4>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {user.status === "INACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivateOpen(true)}
                      disabled={loading}
                      className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <Shield className="w-4 h-4 text-green-600" />
                      {loading ? "Processing..." : "Activate"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeactivateOpen(true)}
                      disabled={loading || hasActivePlan}
                      className="flex items-center gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <Shield className="w-4 h-4" />
                      {loading ? "Processing..." : "Make Inactive"}
                      {!hasActivePlan && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({getInactivePeriod(lastVisit)})
                        </span>
                      )}
                    </Button>
                  )}
                </div>
                {hasActivePlan && (
                  <p className="text-xs text-muted-foreground">
                    Cannot make inactive - user has an active plan
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Deactivate Confirmation Dialog */}
    <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate Customer?</DialogTitle>
          <DialogDescription>
            The customer will immediately lose access to NerdShive and will not be able to log in until the account is activated again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={confirmDeactivate} disabled={loading}>Deactivate</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Activate Confirmation Dialog */}
    <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate Customer?</DialogTitle>
          <DialogDescription>
            This customer will regain access to NerdShive and can log in immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setActivateOpen(false)}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={confirmActivate} disabled={loading}>Activate</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [pricing, setPricing] = useState<PricingPlan[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [queryResponse, setQueryResponse] = useState("");
  const [editingContent, setEditingContent] = useState<ContentSection | null>(null);
  const [newContent, setNewContent] = useState("");
  const [editingPricing, setEditingPricing] = useState<PricingPlan | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [newGstRate, setNewGstRate] = useState("");
  const [editPlanName, setEditPlanName] = useState("");
  const [editBillingType, setEditBillingType] = useState("");
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editCategory, setEditCategory] = useState("customer");
  const [newFeatureText, setNewFeatureText] = useState("");

  // Add plan states
  const [activePricingTab, setActivePricingTab] = useState("customer_plans");
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [addPlanName, setAddPlanName] = useState("");
  const [addCategory, setAddCategory] = useState("customer");
  const [addPrice, setAddPrice] = useState("");
  const [addBillingType, setAddBillingType] = useState("month");
  const [addFeatures, setAddFeatures] = useState<string[]>([]);
  const [addIsActive, setAddIsActive] = useState(true);
  const [addFeatureText, setAddFeatureText] = useState("");

  const [loading, setLoading] = useState(false);
  const [adminFormData, setAdminFormData] = useState({ email: '', fullName: '' });
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [pendingCheckInCount, setPendingCheckInCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [pendingQueriesCount, setPendingQueriesCount] = useState(0);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [activeApprovalsTab, setActiveApprovalsTab] = useState("customers");
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    type: 'user' | 'checkin';
    targetId: string;
    targetName: string;
  }>({
    isOpen: false,
    type: 'user',
    targetId: '',
    targetName: ''
  });

  const navigate = useNavigate();
  const { toast } = useToast();



  // Helper function to calculate inactive period
  const getInactivePeriod = (lastVisitDate: Date | null): string => {
    if (!lastVisitDate) return 'No activity';
    
    const now = new Date();
    const diffMs = now.getTime() - lastVisitDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 0 ? 'Less than a week' : `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  };

  // Helper function to generate signed URLs for private storage
  const getSignedUrl = async (bucket: string, path: string): Promise<string | null> => {
    try {
      // Extract file path from full URL if needed
      let filePath = path;
      if (path && path.includes('/storage/v1/object/public/')) {
        const urlParts = path.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          const pathParts = urlParts[1].split('/');
          pathParts.shift(); // Remove bucket name
          filePath = pathParts.join('/');
        }
      }

      // Our FastAPI backend handles auth via the /storage/ endpoint natively
      // So we can simply return the constructed URL pointing to the file
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';
      return `${baseUrl}/storage/${filePath}`;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchPendingUsers();
    fetchApprovedUsers();
    fetchQueries();
    fetchUsageLogs();
    fetchPlans();
    fetchActivityLogs();
    fetchContentSections();
    fetchPricing();
    fetchCheckInCount();
    fetchPaymentCount();
    fetchQueriesCount();
    fetchActivityCount();

    // Phase 1: HTTP Polling replacing Supabase WebSockets
    // We poll every 30 seconds to refresh dashboard metrics instead of maintaining a WebSocket
    const pollingInterval = setInterval(() => {
      fetchPendingUsers();
      fetchApprovedUsers();
      fetchQueries();
      fetchUsageLogs();
      fetchPlans();
      fetchCheckInCount();
      fetchPaymentCount();
      fetchActivityCount();
    }, 30000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: false, exclude_corporate: true });
      setPendingUsers(data || []);
      setPendingUserCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending users:', error);
    }
  };

  const fetchApprovedUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: true, exclude_corporate: true });
      setApprovedUsers(data || []);
    } catch (error) {
      console.error('Error fetching approved users:', error);
    }
  };


  const fetchQueries = async () => {
    try {
      const data = await dashboardService.getQueries();
      setQueries(data || []);
    } catch (error) {
      console.error('Error fetching queries:', error);
    }
  };

  const fetchUsageLogs = async () => {
    try {
      const data = await dashboardService.getUsageLogs();
      setUsageLogs(data || []);
    } catch (error) {
      console.error('Error fetching usage logs:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await businessService.getPlans();
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchContentSections = async () => {
    try {
      const data = await dashboardService.getContentSections();
      setContentSections(data || []);
    } catch (error) {
      console.error('Error fetching content sections:', error);
    }
  };

  const fetchPricing = async () => {
    try {
      const [customerPlans, corporatePlans] = await Promise.all([
        businessService.getAdminCustomerPlans(),
        businessService.getCorporatePlans()
      ]);
      setPricing([...customerPlans, ...corporatePlans]);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };


  const fetchActivityLogs = async () => {
    try {
      const data = await auditService.getActivityLogs();
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const fetchCheckInCount = async () => {
    try {
      const checkins = await businessService.getCheckins({ status: 'pending' });
      setPendingCheckInCount(checkins.length || 0);
    } catch (error) {
      console.error('Error fetching check-in count:', error);
    }
  };

  const fetchPaymentCount = async () => {
    try {
      const checkins = await businessService.getCheckins({ checkin_approved: false });
      const unverifiedCount = checkins.filter(c => c.payment_status !== 'rejected' && c.plan && !c.plan.payment_verified).length;
      setPendingPaymentCount(unverifiedCount);
    } catch (error) {
      console.error('Error fetching payment count:', error);
    }
  };

  const fetchQueriesCount = async () => {
    try {
      const queries = await dashboardService.getQueries({ status: 'pending' });
      setPendingQueriesCount(queries.length || 0);
    } catch (error) {
      console.error('Error fetching queries count:', error);
    }
  };

  const fetchActivityCount = async () => {
    try {
      const count = await dashboardService.getActivityCount();
      setNewActivityCount(count || 0);
    } catch (error) {
      console.error('Error fetching activity count:', error);
    }
  };

  const markActivityTabAsViewed = async () => {
    try {
      await dashboardService.markActivityTabViewed();
      setNewActivityCount(0);
    } catch (error) {
      console.error('Error marking activity tab as viewed:', error);
    }
  };


  const handleApproveUser = async (userId: string) => {
    setLoading(true);
    try {
      await adminService.approveUser(userId);

      toast({
        title: "User Approved",
        description: "User has been approved successfully.",
        variant: "default"
      });

      fetchPendingUsers();
      fetchApprovedUsers();
      fetchActivityLogs(); 
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectUser = async (userId: string, reason?: string) => {
    setLoading(true);
    try {
      await adminService.rejectUser(userId, reason);

      toast({
        title: "User Rejected",
        description: reason 
          ? `User's application has been rejected. Reason: ${reason}` 
          : `User's application has been rejected and completely removed from the system.`,
        variant: "default"
      });

      fetchPendingUsers();
      fetchActivityLogs(); 
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "Rejection Failed",
        description: "Failed to reject user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToQuery = async () => {
    if (!selectedQuery || !queryResponse.trim()) return;

    setLoading(true);
    try {
      await dashboardService.updateQuery(selectedQuery.id, { response: queryResponse, status: 'answered' });

      toast({
        title: "Response Sent",
        description: "Query has been responded to successfully.",
        variant: "default"
      });

      setQueryResponse("");
      setSelectedQuery(null);
      fetchQueries();
    } catch (error) {
      console.error('Error responding to query:', error);
      toast({
        title: "Error",
        description: "Failed to send response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContent = async () => {
    if (!editingContent || !newContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter content.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/content_sections', {
        section: editingContent.section,
        content: newContent.trim()
      });

      toast({
        title: "Content Updated",
        description: "Content has been updated successfully.",
        variant: "default"
      });

      setEditingContent(null);
      setNewContent("");
      fetchContentSections();
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePricing = async () => {
    if (!addPlanName.trim() || !addPrice.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a plan name and price.",
        variant: "destructive"
      });
      return;
    }

    if (addCategory === 'corporate') {
      toast({
        title: "Access Denied",
        description: "Admin is not allowed to create Corporate plans.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        plan_name: addPlanName.trim(),
        price: parseFloat(addPrice),
        billing_type: addBillingType,
        features_json: addFeatures,
        is_active: addIsActive,
        category: "customer"
      };

      await businessService.createAdminCustomerPlan(payload);

      toast({
        title: "Pricing Plan Created",
        description: "New customer plan has been added successfully.",
        variant: "default"
      });

      setAddPlanOpen(false);
      setAddPlanName("");
      setAddPrice("");
      setAddFeatures([]);
      setAddFeatureText("");
      setAddIsActive(true);
      fetchPricing();
      fetchActivityLogs();
    } catch (error: any) {
      console.error('Error creating pricing plan:', error);
      let errMsg = "Failed to create pricing plan. Please try again.";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
      } else if (error.response?.data?.detail) {
        errMsg = error.response.data.detail;
      }
      toast({
        title: "Creation Failed",
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePricing = async () => {
    if (!editingPricing || !newAmount.trim() || !editPlanName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter plan name and price.",
        variant: "destructive"
      });
      return;
    }

    if (editingPricing.category === 'corporate') {
      toast({
        title: "Access Denied",
        description: "Admin is not allowed to modify Corporate plans.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        plan_name: editPlanName,
        price: parseFloat(newAmount),
        billing_type: editBillingType,
        features_json: editFeatures,
        is_active: editIsActive,
        category: editCategory
      };

      await businessService.updateAdminCustomerPlan(editingPricing.id, payload);

      toast({
        title: "Pricing Plan Updated",
        description: "Customer plan details have been updated successfully.",
        variant: "default"
      });

      setEditingPricing(null);
      setNewAmount("");
      setNewGstRate("");
      setEditPlanName("");
      setEditBillingType("");
      setEditFeatures([]);
      setNewFeatureText("");
      fetchPricing();
      fetchActivityLogs();
    } catch (error: any) {
      console.error('Error updating pricing:', error);
      let errMsg = "Failed to update pricing. Please try again.";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
      } else if (error.response?.data?.detail) {
        errMsg = error.response.data.detail;
      }
      toast({
        title: "Update Failed",
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate("/login");
    } catch (error) {
      console.error('Error logging out:', error);
      navigate("/login");
    }
  };

  return (
    <AuthGuard requiredRole="admin" requireApproval={false}>
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
        {/* Header */}
        <header className="bg-card shadow-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <img 
                    src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" 
                    alt="Nerdshive" 
                    className="h-16 w-auto object-contain" 
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Manage Nerdshive workspace</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <NotificationBell />
                <Button
                  onClick={() => navigate("/settings")}
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                 <LogOut className="w-4 h-4 mr-2" />
                 Logout
               </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Tabs defaultValue="approvals" className="space-y-6" onValueChange={(value) => {
              // Refresh data when tab changes
              if (value === 'approvals') {
                fetchPendingUsers();
              } else if (value === 'customers') {
                fetchApprovedUsers();
                fetchUsageLogs();
                fetchPlans();
              } else if (value === 'queries') {
                fetchQueries();
              } else if (value === 'pricing') {
                fetchPricing();
              } else if (value === 'content') {
                fetchContentSections();
            } else if (value === 'activity') {
              fetchActivityLogs();
              markActivityTabAsViewed();
            }
            }}>
              <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="approvals">
                <UserCheck className="w-4 h-4 mr-2" />
                Approvals
                {(pendingUserCount + pendingCheckInCount + pendingPaymentCount) > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingUserCount + pendingCheckInCount + pendingPaymentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="customers">
                <Users className="w-4 h-4 mr-2" />
                Customers
              </TabsTrigger>
              <TabsTrigger value="company">
                <Building className="w-4 h-4 mr-2" />
                Company
              </TabsTrigger>
              <TabsTrigger value="queries">
                <MessageSquare className="w-4 h-4 mr-2" />
                Queries & Meetings
                {pendingQueriesCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingQueriesCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pricing">
                <FileText className="w-4 h-4 mr-2" />
                Pricing
              </TabsTrigger>
              <TabsTrigger value="content">
                <FileText className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="w-4 h-4 mr-2" />
                Activity
                {newActivityCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {newActivityCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Approval Requests Tab */}
            <TabsContent value="approvals">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Approval Management</CardTitle>
                  <CardDescription>
                    Manage user registration and check-in approvals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeApprovalsTab} onValueChange={setActiveApprovalsTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="customers">
                        <UserCheck className="w-4 h-4 mr-2" />
                        Customer Approvals
                        {pendingUserCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {pendingUserCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="payments">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Payment Verification
                        {pendingPaymentCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {pendingPaymentCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="checkins">
                        <Users className="w-4 h-4 mr-2" />
                        Check-in Approvals
                        {pendingCheckInCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {pendingCheckInCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="customers">
                      {pendingUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <UserCheck className="w-8 h-8 mx-auto mb-2" />
                          <p>No pending user registrations</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingUsers.map((user) => (
                            <div
                              key={user.id}
                              className="p-4 border rounded-lg space-y-4"
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                  <h3 className="font-medium">{user.full_name}</h3>
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                  <p className="text-sm text-muted-foreground">{user.mobile}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {user.city}, {user.location}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Occupation: {user.occupation}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    ID: {user.govt_id_type} - {user.govt_id_number}
                                  </p>
                                </div>
                                <div className="flex space-x-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedUser(user)}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>User Details</DialogTitle>
                                        <DialogDescription>
                                          Complete user information and documents
                                        </DialogDescription>
                                      </DialogHeader>
                                       {selectedUser && (
                                         <div className="space-y-4">
                                           <div>
                                             <h4 className="font-medium">Personal Information</h4>
                                             <p>Name: {selectedUser.full_name}</p>
                                             <p>Email: {selectedUser.email}</p>
                                             <p>Mobile: {selectedUser.mobile}</p>
                                             <p>Location: {selectedUser.city}, {selectedUser.location}</p>
                                             <p>Occupation: {selectedUser.occupation}</p>
                                           </div>
                                           
                                           {selectedUser.customer_photo_url && (
                                             <div>
                                               <h4 className="font-medium">Customer Photo</h4>
                                                <ImageModal
                                                  imageUrl={selectedUser.customer_photo_url}
                                                  title={`${selectedUser.full_name} - Photo`}
                                                  triggerText="View Photo"
                                                  triggerVariant="outline"
                                                  bucket="customer-photos"
                                                  isStoragePath
                                                />
                                             </div>
                                           )}
                                           
                                           <div>
                                             <h4 className="font-medium">Government ID</h4>
                                             <p>Type: {selectedUser.govt_id_type}</p>
                                             <p>Number: {selectedUser.govt_id_number}</p>
                                             {selectedUser.govt_id_copy_url && (
                                                <ImageModal
                                                  imageUrl={selectedUser.govt_id_copy_url}
                                                  title={`${selectedUser.full_name} - Government ID`}
                                                  triggerText="View Document"
                                                  triggerVariant="outline"
                                                  bucket="id-proofs"
                                                  isStoragePath
                                                />
                                             )}
                                           </div>
                                         </div>
                                       )}
                                    </DialogContent>
                                  </Dialog>
                                  <Button
                                    onClick={() => handleApproveUser(user.id)}
                                    size="sm"
                                    disabled={loading}
                                    className="gradient-primary"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setRejectionModal({
                                        isOpen: true,
                                        type: 'user',
                                        targetId: user.id,
                                        targetName: user.full_name
                                      });
                                    }}
                                    variant="destructive"
                                    size="sm"
                                    disabled={loading}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="payments">
                      <PaymentVerificationTab onCountChange={setPendingPaymentCount} />
                    </TabsContent>

                    <TabsContent value="checkins">
                      <CheckInApprovalTab 
                        onCountChange={setPendingCheckInCount}
                        onSwitchToPaymentVerification={() => setActiveApprovalsTab("payments")}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Customers Tab */}
            <TabsContent value="customers">
              <div className="space-y-4">
                <Card className="shadow-card">
                  <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Approved Customers ({approvedUsers.length})</CardTitle>
                      <CardDescription>
                        View detailed information, usage history, and manage all approved workspace members
                      </CardDescription>
                    </div>

                  </CardHeader>
                </Card>

                {approvedUsers.length === 0 ? (
                  <Card>
                    <CardContent className="p-8">
                      <p className="text-center text-muted-foreground">
                        No approved customers yet.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {approvedUsers.map((user) => (
                      <CustomerDetailCard
                        key={user.id}
                        user={user}
                        usageLogs={usageLogs}
                        plans={plans}
                        getSignedUrl={getSignedUrl}
                        isExpanded={expandedCustomer === user.id}
                        onToggle={() => setExpandedCustomer(expandedCustomer === user.id ? null : user.id)}
                        getInactivePeriod={getInactivePeriod}
                        onRefresh={fetchApprovedUsers}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Queries Tab */}
            <TabsContent value="queries">
              <Tabs defaultValue="queries_sub" className="space-y-6">
                <TabsList className="grid grid-cols-2 w-full lg:w-[400px]">
                  <TabsTrigger value="queries_sub">Queries</TabsTrigger>
                  <TabsTrigger value="meetings_sub">Meetings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="queries_sub" className="space-y-6">
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle>User Queries</CardTitle>
                      <CardDescription>
                        Respond to user questions and concerns
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {queries.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No queries submitted yet.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {queries.map((query) => (
                            <div
                              key={query.id}
                              className="p-4 border rounded-lg space-y-2"
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <p className="font-medium">{query.users?.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{query.users?.email}</p>
                                  <p className="text-sm">{query.query_text}</p>
                                  {query.response && (
                                    <div className="mt-2 p-2 bg-muted rounded">
                                      <p className="text-sm font-medium">Response:</p>
                                      <p className="text-sm">{query.response}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    variant={query.status === 'closed' ? 'default' : 'secondary'}
                                  >
                                    {query.status || 'open'}
                                  </Badge>
                                  {query.status !== 'closed' && (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          onClick={() => setSelectedQuery(query)}
                                          className="gradient-primary"
                                        >
                                          Respond
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Respond to Query</DialogTitle>
                                          <DialogDescription>
                                            Send a response to {query.users?.full_name}
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div>
                                            <Label>User Query</Label>
                                            <p className="text-sm bg-muted p-2 rounded mt-1">
                                              {query.query_text}
                                            </p>
                                          </div>
                                          <div>
                                            <Label htmlFor="response">Your Response</Label>
                                            <Textarea
                                              id="response"
                                              value={queryResponse}
                                              onChange={(e) => setQueryResponse(e.target.value)}
                                              placeholder="Enter your response..."
                                              rows={4}
                                            />
                                          </div>
                                          <Button
                                            onClick={handleRespondToQuery}
                                            disabled={loading}
                                            className="w-full gradient-primary"
                                          >
                                            {loading ? (
                                              <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending...
                                              </>
                                            ) : (
                                              "Send Response"
                                            )}
                                          </Button>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(query.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="meetings_sub" className="space-y-6">
                  <AdminMeetingsTab />
                </TabsContent>
              </Tabs>
            </TabsContent>
            {/* Pricing Management Tab */}
            <TabsContent value="pricing">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Pricing Restructure Management</CardTitle>
                  <CardDescription>
                    View workspace plans. Pricing plans are Read-Only.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activePricingTab} onValueChange={setActivePricingTab} className="space-y-6">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <TabsList className="grid w-full grid-cols-2 lg:w-96">
                        <TabsTrigger value="customer_plans">Customer Plans</TabsTrigger>
                        <TabsTrigger value="corporate_plans">Corporate Plans</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    {/* CUSTOMER PLANS TAB */}
                    <TabsContent value="customer_plans" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                        {pricing.filter(p => p.category === 'customer').sort((a, b) => Number(a.price) - Number(b.price)).map((plan) => {
                          const gstRate = 18;
                          const price = Number(plan.price);
                          const gstAmount = price * (gstRate / 100);
                          const totalAmount = price + gstAmount;
                          return (
                            <Card key={plan.id} className={`shadow-card flex flex-col ${!plan.is_active ? 'opacity-60 bg-muted/20' : ''}`}>
                              <CardHeader>
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-xl font-bold">{plan.plan_name}</CardTitle>
                                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                                    {plan.is_active ? "Active" : "Disabled"}
                                  </Badge>
                                </div>
                                <CardDescription>
                                  Billing: {plan.billing_type === "seat" ? "monthly" : `${plan.billing_type}ly`}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="flex-1 flex flex-col space-y-4">
                                <div className="text-center bg-muted/40 p-4 rounded-lg">
                                  <div className="text-3xl font-extrabold text-foreground">₹{price}</div>
                                  <div className="text-xs text-muted-foreground">+ ₹{Math.round(gstAmount)} GST</div>
                                  <div className="text-sm font-semibold text-primary mt-1">₹{Math.round(totalAmount)} Total</div>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase">Features:</div>
                                  <ul className="text-xs text-muted-foreground space-y-1">
                                    {plan.features_json?.slice(0, 3).map((feat, i) => (
                                      <li key={i} className="flex items-center space-x-1">
                                        <span className="text-primary font-bold">✓</span>
                                        <span className="truncate">{feat}</span>
                                      </li>
                                    ))}
                                    {plan.features_json?.length > 3 && (
                                      <li className="text-[10px] italic text-muted-foreground/80 pl-3">
                                        + {plan.features_json.length - 3} more features
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </TabsContent>
                    
                    {/* CORPORATE PLANS TAB (READ-ONLY FOR ADMIN) */}
                    <TabsContent value="corporate_plans" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                        {pricing.filter(p => p.category === 'corporate').sort((a, b) => Number(a.price) - Number(b.price)).map((plan) => {
                          const gstRate = 18;
                          const price = Number(plan.price);
                          const gstAmount = price * (gstRate / 100);
                          const totalAmount = price + gstAmount;
                          return (
                            <Card key={plan.id} className={`shadow-card flex flex-col ${!plan.is_active ? 'opacity-60 bg-muted/20' : ''}`}>
                              <CardHeader>
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-xl font-bold">{plan.plan_name}</CardTitle>
                                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                                    {plan.is_active ? "Active" : "Disabled"}
                                  </Badge>
                                </div>
                                <CardDescription>
                                  Billing: {plan.billing_type === "seat" ? "monthly" : `${plan.billing_type}ly`}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="flex-1 flex flex-col space-y-4">
                                <div className="text-center bg-muted/40 p-4 rounded-lg">
                                  <div className="text-3xl font-extrabold text-foreground">₹{price}</div>
                                  <div className="text-xs text-muted-foreground">+ ₹{Math.round(gstAmount)} GST (Per Seat)</div>
                                  <div className="text-sm font-semibold text-primary mt-1">₹{Math.round(totalAmount)} Total</div>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase">Features:</div>
                                  <ul className="text-xs text-muted-foreground space-y-1">
                                    {plan.features_json?.map((feat, i) => (
                                      <li key={i} className="flex items-center space-x-1">
                                        <span className="text-primary font-bold">✓</span>
                                        <span>{feat}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content Management Tab */}
            <TabsContent value="content">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {['rules', 'guide', 'wifi'].map((sectionName) => {
                  const section = contentSections.find(c => c.section === sectionName);
                  return (
                    <Card key={sectionName} className="shadow-card">
                      <CardHeader>
                        <CardTitle className="capitalize">{sectionName}</CardTitle>
                        <CardDescription>
                          Manage {sectionName} content
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-sm bg-muted p-3 rounded max-h-32 overflow-y-auto">
                          {section?.content || `No ${sectionName} content yet.`}
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingContent(section || { 
                                  section: sectionName, 
                                  content: '', 
                                  last_updated: '' 
                                });
                                setNewContent(section?.content || '');
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit {sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}</DialogTitle>
                              <DialogDescription>
                                Update the {sectionName} content for users
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="content">Content</Label>
                                <Textarea
                                  id="content"
                                  value={newContent}
                                  onChange={(e) => setNewContent(e.target.value)}
                                  placeholder={`Enter ${sectionName} content...`}
                                  rows={8}
                                />
                              </div>
                              <Button
                                onClick={handleUpdateContent}
                                disabled={loading}
                                className="w-full gradient-primary"
                              >
                                {loading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  "Update Content"
                                )}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Activity Feed Tab */}
            <TabsContent value="activity">
              <ActivityTabComponent activityLogs={activityLogs} />
            </TabsContent>

            {/* Company Directory Tab */}
            <TabsContent value="company">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Company Management</CardTitle>
                  <CardDescription>
                    View organization details and enrolled employees directory
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OrganizationApprovalTab readOnly={true} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Rejection Reason Modal */}
        <RejectionReasonModal
          isOpen={rejectionModal.isOpen}
          onClose={() => setRejectionModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={(reason) => {
            if (rejectionModal.type === 'user') {
              handleRejectUser(rejectionModal.targetId, reason);
            }
            setRejectionModal(prev => ({ ...prev, isOpen: false }));
          }}
          title={rejectionModal.type === 'user' ? "Reject User Application" : "Reject Check-in Request"}
          description={`Are you sure you want to reject ${rejectionModal.targetName}? Please provide a reason for rejection.`}
          isLoading={loading}
        />
      </div>
    </AuthGuard>
  );
}