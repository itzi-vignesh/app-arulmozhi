import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { adminService } from '@/services/adminService';
import { invoiceService } from '@/services/invoiceService';
import { businessService } from '@/services/businessService';
import { dashboardService } from '@/services/dashboardService';
import { auditService } from '@/services/auditService';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { financeService } from '@/services/financeService';

import { ImageModal } from "@/components/ui/image-modal";
import { formatDate } from "@/lib/dateUtils";
import { buildCombinedUsage } from "@/lib/historyUtils";
import { RejectionReasonModal } from "@/components/ui/rejection-reason-modal";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { NotificationBell } from "@/components/ui/notification-bell";
import { 
  LogOut, 
  UserPlus, 
  UserCheck, 
  Users, 
  MessageSquare, 
  FileText, 
  Activity,
  Upload,
  Eye,
  Check,
  X,
  Trash2,
  Loader2,
  Lock,
  Hexagon,
  Edit,
  Plus,
  Mail,
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  Phone,
  CreditCard,
  Building,
  Image as ImageIcon,
  History,
  Shield,
  Settings,
  Clock
} from "lucide-react";
import { CheckInApprovalTab } from "@/components/CheckInApprovalTab";
import { PaymentVerificationTab } from "@/components/PaymentVerificationTab";
import { InvoiceRenderer } from "@/components/InvoiceRenderer";
import { ActivityTabComponent } from "@/components/ActivityTabComponent";
import { OrganizationApprovalTab } from "@/components/OrganizationApprovalTab";

import { Download } from "lucide-react";
import { AdminMeetingsTab } from "@/components/AdminMeetingsTab";

interface Admin {
  id: string;
  email?: string;
  created_at: string;
  created_by?: string;
  auth_id: string;
}

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

interface ActivityLog {
  id: string;
  action: string;
  performed_by: string;
  performed_by_name: string;
  performed_by_role: string;
  target_user_id?: string;
  target_user_name?: string;
  target_user_email?: string;
  details: any;
  created_at: string;
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

interface SuperuserCustomerDetailCardProps {
  user: User;
  usageLogs: UsageLog[];
  plans: Plan[];
  getSignedUrl: (bucket: string, path: string) => Promise<string | null>;
}

interface SuperuserCustomerDetailCardPropsExtended extends SuperuserCustomerDetailCardProps {
  isExpanded: boolean;
  onToggle: () => void;
  getInactivePeriod: (lastVisit: Date | null) => string;
  onRefresh?: () => void;
}

const SuperuserCustomerDetailCard = ({ user, usageLogs, plans, getSignedUrl, isExpanded, onToggle, getInactivePeriod, onRefresh }: SuperuserCustomerDetailCardPropsExtended) => {
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

  const handleDeleteUser = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${user.full_name}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await apiClient.delete(`/users`).catch(() => {});
      const error = null; /* stripped */

      if (error) throw error;

      toast({
        title: "User Deleted",
        description: `${user.full_name} has been permanently deleted.`,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
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
                      const planName = item.plan_type === 'day' ? 'Day Pass' : item.plan_type === 'week' ? 'Weekly Pass' : 'Monthly Pass';
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

            {/* Superuser Actions */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Superuser Actions
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteUser}
                    disabled={loading}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    {loading ? "Deleting..." : "Delete User"}
                  </Button>
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

// ImageModal wrapper component
function ImageModalWrapper({ bucket, fileName, title, triggerText }: { bucket: string; fileName: string; title: string; triggerText: string }) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getSignedUrlLocal = async (bucket: string, path: string): Promise<string | null> => {
    try {
      let filePath = path;
      if (path && path.includes('/storage/v1/object/public/')) {
        const urlParts = path.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          const pathParts = urlParts[1].split('/');
          pathParts.shift();
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

  const loadImage = async () => {
    setLoading(true);
    try {
      const signedUrl = await getSignedUrlLocal(bucket, fileName);
      if (signedUrl) {
        setImageUrl(signedUrl);
      }
    } catch (error) {
      console.error('Error getting signed URL:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImage();
  }, [bucket, fileName]);

  if (loading || !imageUrl) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  return (
    <ImageModal
      imageUrl={imageUrl}
      title={title}
      triggerText={triggerText}
    />
  );
}

export default function SuperuserDashboard() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [securityPolicy, setSecurityPolicy] = useState({
    mfa: {
      superuser: true,
      admin: true,
      finance: true,
      corporate_admin: false,
      customer: false,
      employee: false
    }
  });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [financeUsers, setFinanceUsers] = useState<any[]>([]);
  const [searchFinanceQuery, setSearchFinanceQuery] = useState("");
  const [financeAddOpen, setFinanceAddOpen] = useState(false);
  const [financeEditOpen, setFinanceEditOpen] = useState(false);
  const [selectedFinanceUser, setSelectedFinanceUser] = useState<any>(null);
  const [financeName, setFinanceName] = useState("");
  const [financeEmail, setFinanceEmail] = useState("");
  const [financeMobile, setFinanceMobile] = useState("");
  const [financePassword, setFinancePassword] = useState("");
  const [financeConfirmPassword, setFinanceConfirmPassword] = useState("");
  const [financeCity, setFinanceCity] = useState("");
  const [financeLocation, setFinanceLocation] = useState("");
  const [financeOccupation, setFinanceOccupation] = useState("");
  const [financePermissions, setFinancePermissions] = useState<string[]>([]);
  const [resetPasswordFinanceUser, setResetPasswordFinanceUser] = useState<any>(null);
  const [resetPasswordFinanceOpen, setResetPasswordFinanceOpen] = useState(false);
  const [newPasswordFinance, setNewPasswordFinance] = useState("");
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [pendingCheckInCount, setPendingCheckInCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [pendingOrgCount, setPendingOrgCount] = useState(0);
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

  const [loading, setLoading] = useState(false);
  const [billingOverview, setBillingOverview] = useState<any[]>([]);
  const [superuserPayingInvoiceId, setSuperuserPayingInvoiceId] = useState<string | null>(null);
  const [selectedCompanyInvoices, setSelectedCompanyInvoices] = useState<any[]>([]);
  const [companyInvoicesModalOpen, setCompanyInvoicesModalOpen] = useState(false);
  const [selectedCompanyPaymentHistory, setSelectedCompanyPaymentHistory] = useState<any[]>([]);
  const [companyPaymentsModalOpen, setCompanyPaymentsModalOpen] = useState(false);
  const [selectedCompanyForInvoiceView, setSelectedCompanyForInvoiceView] = useState<any>(null);
  const [selectedInvoiceToShow, setSelectedInvoiceToShow] = useState<any>(null);

  const fetchBillingOverview = async () => {
    setLoading(true);
    try {
      const data = await invoiceService.getSuperuserBillingOverview();
      setBillingOverview(data);
    } catch (error) {
      toast({ title: "Failed to fetch billing overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewCompanyInvoices = async (companyId: string, companyName: string) => {
    setLoading(true);
    try {
      const data = await invoiceService.getCompanyInvoices(companyId);
      setSelectedCompanyInvoices(data);
      setSelectedCompanyForInvoiceView({ id: companyId, company_name: companyName });
      setCompanyInvoicesModalOpen(true);
    } catch (error) {
      toast({ title: "Failed to fetch company invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewCompanyPayments = async (companyId: string, companyName: string) => {
    setLoading(true);
    try {
      const data = await invoiceService.getCompanyInvoices(companyId);
      setSelectedCompanyPaymentHistory(data.filter((inv: any) => inv.status === 'paid'));
      setSelectedCompanyForInvoiceView({ id: companyId, company_name: companyName });
      setCompanyPaymentsModalOpen(true);
    } catch (error) {
      toast({ title: "Failed to fetch payment history", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSuperuserPayInvoice = async (invoiceId: string) => {
    setSuperuserPayingInvoiceId(invoiceId);
    try {
      await invoiceService.payInvoice(invoiceId);
      toast({ title: "Success", description: "Invoice marked as paid." });
      fetchBillingOverview();
      if (selectedCompanyForInvoiceView) {
        const data = await invoiceService.getCompanyInvoices(selectedCompanyForInvoiceView.id);
        setSelectedCompanyInvoices(data);
        setSelectedCompanyPaymentHistory(data.filter((inv: any) => inv.status === 'paid'));
      }
    } catch (error) {
      toast({ title: "Failed to mark invoice as paid", variant: "destructive" });
    } finally {
      setSuperuserPayingInvoiceId(null);
    }
  };

  const handleSuspendSubscription = async (companyId: string) => {
    setLoading(true);
    try {
      await invoiceService.suspendSubscription(companyId);
      toast({ title: "Subscription Suspended" });
      fetchBillingOverview();
    } catch (error) {
      toast({ title: "Failed to suspend subscription", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async (companyId: string) => {
    setLoading(true);
    try {
      await invoiceService.reactivateSubscription(companyId);
      toast({ title: "Subscription Reactivated" });
      fetchBillingOverview();
    } catch (error) {
      toast({ title: "Failed to reactivate subscription", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [pricing, setPricing] = useState<PricingPlan[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
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

  const [adminFormData, setAdminFormData] = useState({ email: '', fullName: '' });
  
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
    fetchAdmins();
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
    fetchFinanceUsers();

    // Set up real-time subscriptions
    /* WebSockets replaced by HTTP polling */


    return () => {
      
      
      
      
      
      
      
    };
  }, []);

  const fetchSecurityPolicy = async () => {
    try {
      const data = await authService.getPlatformPolicy();
      setSecurityPolicy(data);
    } catch (err) {
      console.error("Failed to fetch security policy:", err);
      toast({
        title: "Error",
        description: "Failed to load platform security policy.",
        variant: "destructive"
      });
    }
  };

  const saveSecurityPolicy = async () => {
    setSavingPolicy(true);
    try {
      await authService.updatePlatformPolicy(securityPolicy);
      toast({
        title: "Success",
        description: "Platform security policies updated successfully."
      });
    } catch (err) {
      console.error("Failed to save security policy:", err);
      toast({
        title: "Error",
        description: "Failed to save platform security policies.",
        variant: "destructive"
      });
    } finally {
      setSavingPolicy(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const data = await adminService.getAdmins();
      setAdmins(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchFinanceUsers = async () => {
    try {
      const data = await financeService.getFinanceUsers();
      setFinanceUsers(data || []);
    } catch (error) {
      console.error('Error fetching finance users:', error);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: false, exclude_corporate: true });
      setPendingUsers(data || []);
      setPendingUserCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending users:', error);
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
      const data = await businessService.getSuperuserPlans();
      setPricing(data || []);
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

  const handleCreatePricing = async () => {
    if (!addPlanName.trim() || !addPrice.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a plan name and price.",
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
        category: addCategory
      };

      await businessService.createSuperuserPlan(payload);

      toast({
        title: "Pricing Plan Created",
        description: "New pricing plan has been added successfully.",
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
        description: "Please enter a plan name and price.",
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

      await businessService.updateSuperuserPlan(editingPricing.id, payload);

      toast({
        title: "Pricing Plan Updated",
        description: "Plan details have been updated successfully.",
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
      fetchActivityLogs(); // Refresh activity logs to show the update immediately
    } catch (error: any) {
      console.error('Error updating pricing:', error);
      let errMsg = "Failed to update pricing plan. Please try again.";
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

  const handleAddAdmin = async () => {
    const email = newAdminEmail.trim();
    const password = newAdminPassword.trim();
    
    console.log("handleAddAdmin triggered", { email, passwordLength: password.length });

    if (!email || !password) {
      toast({ title: "Validation Error", description: "Please enter both Email and Password", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await adminService.addAdmin(email, password);

      toast({
        title: "Admin Added",
        description: "New admin has been created successfully.",
        variant: "default"
      });

      setNewAdminEmail('');
      setNewAdminPassword('');
      fetchAdmins();
      fetchActivityLogs();
    } catch (error: any) {
      console.error('Error adding admin:', error);
      let errMsg = "Failed to add admin";
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

  const handleRemoveAdmin = async (adminId: string) => {
    setLoading(true);
    try {
      await adminService.deleteAdmin(adminId);

      toast({
        title: "Admin Removed",
        description: "Admin has been removed successfully.",
        variant: "default"
      });

      fetchAdmins();
    } catch (error: any) {
      console.error('Error removing admin:', error);
      toast({
        title: "Removal Failed",
        description: error.response?.data?.detail || error.message || "Failed to remove admin. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (financePassword !== financeConfirmPassword) {
      toast({
        title: "Passwords Mismatch",
        description: "Password and Confirm Password fields must match.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      await financeService.inviteFinanceUser({
        email: financeEmail,
        password: financePassword,
        full_name: financeName,
        mobile: financeMobile || null,
        city: financeCity || null,
        location: financeLocation || null,
        occupation: financeOccupation || null,
        permissions: financePermissions
      });
      toast({
        title: "Finance User Created",
        description: "Finance account has been created successfully.",
        variant: "default"
      });
      setFinanceAddOpen(false);
      setFinanceEmail("");
      setFinancePassword("");
      setFinanceConfirmPassword("");
      setFinanceName("");
      setFinanceMobile("");
      setFinanceCity("");
      setFinanceLocation("");
      setFinanceOccupation("");
      setFinancePermissions([]);
      fetchFinanceUsers();
    } catch (error: any) {
      console.error('Error creating finance user:', error);
      toast({
        title: "Creation Failed",
        description: error.response?.data?.detail || error.message || "Failed to create finance user.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFinanceUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinanceUser) return;
    
    setLoading(true);
    try {
      await financeService.updateFinanceUser(selectedFinanceUser.id, {
        full_name: financeName,
        mobile: financeMobile,
        city: financeCity,
        location: financeLocation,
        occupation: financeOccupation,
        permissions: financePermissions
      });
      toast({
        title: "Finance User Updated",
        description: "Finance account details updated successfully.",
        variant: "default"
      });
      setFinanceEditOpen(false);
      setSelectedFinanceUser(null);
      fetchFinanceUsers();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.response?.data?.detail || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFinanceStatus = async (user: any) => {
    setLoading(true);
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      await financeService.updateFinanceUser(user.id, { status: newStatus });
      toast({
        title: `Finance User ${newStatus === "active" ? "Activated" : "Deactivated"}`,
        description: `Finance user status has been set to ${newStatus}.`,
        variant: "default"
      });
      fetchFinanceUsers();
    } catch (error: any) {
      toast({
        title: "Status Toggle Failed",
        description: error.response?.data?.detail || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetFinancePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordFinanceUser || !newPasswordFinance.trim()) return;
    
    setLoading(true);
    try {
      await financeService.resetFinancePassword(resetPasswordFinanceUser.id, JSON.stringify(newPasswordFinance));
      toast({
        title: "Password Reset Success",
        description: "Finance user password reset successfully.",
        variant: "default"
      });
      setResetPasswordFinanceOpen(false);
      setNewPasswordFinance("");
      setResetPasswordFinanceUser(null);
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.response?.data?.detail || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFinanceUser = async (financeId: string) => {
    if (!confirm("Are you sure you want to permanently delete this finance user? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      await financeService.deleteFinanceUser(financeId);
      toast({
        title: "Finance User Deleted",
        description: "Finance account has been permanently removed.",
        variant: "default"
      });
      fetchFinanceUsers();
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.response?.data?.detail || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      // Call the service method here, assuming adminService.updateContent is implemented
      await adminService.updateContent({
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
    <AuthGuard requiredRole="superuser" requireApproval={false}>
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
                  <h1 className="text-2xl font-bold text-foreground">Superuser Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Full system administration</p>
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
          <Tabs defaultValue="admins" className="space-y-6" onValueChange={(value) => {
            // Refresh data when tab changes
            if (value === 'admins') {
              fetchAdmins();
            } else if (value === 'approvals') {
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
            } else if (value === 'billing') {
              fetchBillingOverview();
            } else if (value === 'finance') {
              fetchFinanceUsers();
            } else if (value === 'security') {
              fetchSecurityPolicy();
            }
          }}>
            <TabsList className="grid w-full grid-cols-10">
              <TabsTrigger value="admins">
                <UserPlus className="w-4 h-4 mr-2" />
                Admins
              </TabsTrigger>
              <TabsTrigger value="finance">
                <Shield className="w-4 h-4 mr-2" />
                Finance
              </TabsTrigger> 
              <TabsTrigger value="approvals">
                <UserCheck className="w-4 h-4 mr-2" />
                Approvals
                {(pendingUserCount + pendingCheckInCount + pendingOrgCount) > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingUserCount + pendingCheckInCount + pendingOrgCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="customers">
                <Users className="w-4 h-4 mr-2" />
                Customers
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
              <TabsTrigger value="billing">
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="security">
                <Lock className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
            </TabsList>

            {/* Admin Management Tab */}
            <TabsContent value="admins">
              <div className="space-y-6">
                {/* Add New Admin */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Add New Admin</CardTitle>
                    <CardDescription>
                      Create admin accounts with email credentials
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adminEmail">Email</Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="Enter admin email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminPassword">Password</Label>
                        <Input
                          id="adminPassword"
                          type="password"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="Enter password (min 6 chars)"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddAdmin}
                      disabled={loading}
                      className="w-full gradient-primary hover:shadow-primary transition-smooth"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Admin...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Add Admin & Send Credentials
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Current Admins */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Current Admins</CardTitle>
                    <CardDescription>
                      Manage existing administrator accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {admins.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No admins found.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {admins.map((admin) => (
                            <TableRow key={admin.id}>
                              <TableCell className="font-medium">{admin.email}</TableCell>
                              <TableCell>
                                {formatDate(admin.created_at)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  onClick={() => handleRemoveAdmin(admin.id)}
                                  variant="destructive"
                                  size="sm"
                                  disabled={loading}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Finance Management Tab */}
            <TabsContent value="finance">
              <div className="space-y-6">
                <Card className="shadow-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle>Finance Management</CardTitle>
                      <CardDescription>
                        Create, edit, activate, deactivate, or delete Finance accounts
                      </CardDescription>
                    </div>
                    <Button onClick={() => {
                      setFinanceName("");
                      setFinanceEmail("");
                      setFinanceMobile("");
                      setFinancePassword("");
                      setFinanceConfirmPassword("");
                      setFinanceCity("");
                      setFinanceLocation("");
                      setFinanceOccupation("");
                      setFinancePermissions([]);
                      setFinanceAddOpen(true);
                    }} size="sm">
                      <Plus className="w-4 h-4 mr-2" /> Add Finance User
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 mb-4">
                      <Input
                        placeholder="Search finance users by name or email..."
                        value={searchFinanceQuery}
                        onChange={(e) => setSearchFinanceQuery(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                    
                    {financeUsers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        No finance users found.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financeUsers
                            .filter(u => 
                              u.full_name?.toLowerCase().includes(searchFinanceQuery.toLowerCase()) || 
                              u.email?.toLowerCase().includes(searchFinanceQuery.toLowerCase())
                            )
                            .map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-semibold">{user.full_name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.mobile || "N/A"}</TableCell>
                                <TableCell>
                                  <Badge variant={user.status === "active" ? "default" : "secondary"}>
                                    {user.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatDate(user.created_at)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedFinanceUser(user);
                                        setFinanceName(user.full_name || "");
                                        setFinanceEmail(user.email || "");
                                        setFinanceMobile(user.mobile || "");
                                        setFinanceCity(user.city || "");
                                        setFinanceLocation(user.location || "");
                                        setFinanceOccupation(user.occupation || "");
                                        setFinancePermissions(user.permissions || []);
                                        setFinanceEditOpen(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={user.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}
                                      onClick={() => handleToggleFinanceStatus(user)}
                                    >
                                      {user.status === "active" ? "Deactivate" : "Activate"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setResetPasswordFinanceUser(user);
                                        setNewPasswordFinance("");
                                        setResetPasswordFinanceOpen(true);
                                      }}
                                    >
                                      Reset Pass
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteFinanceUser(user.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Dialogs for Add/Edit/Reset Pass */}
                <Dialog open={financeAddOpen} onOpenChange={setFinanceAddOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Finance User</DialogTitle>
                      <DialogDescription>
                        Fill in the details to create a new Finance role account
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInviteFinance} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={financeName} onChange={(e) => setFinanceName(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={financeEmail} onChange={(e) => setFinanceEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone/Mobile</Label>
                        <Input value={financeMobile} onChange={(e) => setFinanceMobile(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input type="password" value={financePassword} onChange={(e) => setFinancePassword(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Confirm Password</Label>
                          <Input type="password" value={financeConfirmPassword} onChange={(e) => setFinanceConfirmPassword(e.target.value)} required />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={financeCity} onChange={(e) => setFinanceCity(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Location</Label>
                          <Input value={financeLocation} onChange={(e) => setFinanceLocation(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Occupation</Label>
                          <Input value={financeOccupation} onChange={(e) => setFinanceOccupation(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setFinanceAddOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>Add User</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={financeEditOpen} onOpenChange={setFinanceEditOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Finance User</DialogTitle>
                      <DialogDescription>
                        Update profile details for the selected Finance account
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateFinanceUser} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={financeName} onChange={(e) => setFinanceName(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone/Mobile</Label>
                        <Input value={financeMobile} onChange={(e) => setFinanceMobile(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={financeCity} onChange={(e) => setFinanceCity(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Location</Label>
                          <Input value={financeLocation} onChange={(e) => setFinanceLocation(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Occupation</Label>
                          <Input value={financeOccupation} onChange={(e) => setFinanceOccupation(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => {
                          setFinanceEditOpen(false);
                          setSelectedFinanceUser(null);
                        }}>Cancel</Button>
                        <Button type="submit" disabled={loading}>Save Changes</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={resetPasswordFinanceOpen} onOpenChange={setResetPasswordFinanceOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                      <DialogDescription>
                        Set a new password for {resetPasswordFinanceUser?.full_name}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleResetFinancePassword} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input type="password" value={newPasswordFinance} onChange={(e) => setNewPasswordFinance(e.target.value)} required />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => {
                          setResetPasswordFinanceOpen(false);
                          setResetPasswordFinanceUser(null);
                        }}>Cancel</Button>
                        <Button type="submit" disabled={loading}>Reset Password</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            {/* Approval Requests Tab */}
            <TabsContent value="approvals">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Approval Management</CardTitle>
                  <CardDescription>
                    Manage user registration and check-in approvals with superuser privileges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeApprovalsTab} onValueChange={setActiveApprovalsTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="organizations">
                        <Building className="w-4 h-4 mr-2" />
                        Company Approvals
                        {pendingOrgCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {pendingOrgCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="customers">
                        <UserCheck className="w-4 h-4 mr-2" />
                        Customer Approvals
                        {pendingUserCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {pendingUserCount}
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

                    <TabsContent value="organizations">
                      <OrganizationApprovalTab onCountChange={setPendingOrgCount} />
                    </TabsContent>

                    <TabsContent value="checkins">
                      <CheckInApprovalTab 
                        onCountChange={setPendingCheckInCount}
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
                        View detailed information, usage history, and manage all approved workspace members with full superuser privileges
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
                      <SuperuserCustomerDetailCard
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
                    Manage Customer and Corporate plans. Changes will reflect everywhere dynamically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activePricingTab} onValueChange={(val) => {
                    setActivePricingTab(val);
                    setAddCategory(val === "corporate_plans" ? "corporate" : "customer");
                  }} className="space-y-6">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <TabsList className="grid w-full grid-cols-2 lg:w-96">
                        <TabsTrigger value="customer_plans">Customer Plans</TabsTrigger>
                        <TabsTrigger value="corporate_plans">Corporate Plans</TabsTrigger>
                      </TabsList>
                      <Button
                        onClick={() => {
                          setAddPlanName("");
                          setAddPrice("");
                          setAddBillingType(activePricingTab === "corporate_plans" ? "seat" : "month");
                          setAddFeatures([]);
                          setAddFeatureText("");
                          setAddIsActive(true);
                          setAddCategory(activePricingTab === "corporate_plans" ? "corporate" : "customer");
                          setAddPlanOpen(true);
                        }}
                        className="gradient-primary"
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add Plan
                      </Button>
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-auto"
                                    onClick={() => {
                                      setEditingPricing(plan);
                                      setEditPlanName(plan.plan_name);
                                      setNewAmount(plan.price.toString());
                                      setEditBillingType(plan.billing_type);
                                      setEditFeatures(plan.features_json || []);
                                      setEditIsActive(plan.is_active);
                                      setEditCategory(plan.category);
                                      setNewFeatureText("");
                                    }}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Plan
                                  </Button>
                                  <Dialog open={!!editingPricing && editingPricing.id === plan.id} onOpenChange={(open) => { if (!open) setEditingPricing(null); }}>
                                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Edit Pricing Plan</DialogTitle>
                                      <DialogDescription>
                                        Modify details for {plan.plan_name}. All changes save directly to the database.
                                      </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="plan_name">Plan Name</Label>
                                          <Input
                                            id="plan_name"
                                            value={editPlanName}
                                            onChange={(e) => setEditPlanName(e.target.value)}
                                            placeholder="Plan Name"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="category">Category</Label>
                                          <Select value={editCategory} onValueChange={setEditCategory}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="customer">Customer</SelectItem>
                                              <SelectItem value="corporate">Corporate</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="price">Price (₹)</Label>
                                          <Input
                                            id="price"
                                            type="number"
                                            value={newAmount}
                                            onChange={(e) => setNewAmount(e.target.value)}
                                            placeholder="Price"
                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" onWheel={(e) => e.currentTarget.blur()}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="billing_type">Billing Type</Label>
                                          <Select value={editBillingType} onValueChange={setEditBillingType}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="day">Day</SelectItem>
                                              <SelectItem value="week">Week</SelectItem>
                                              <SelectItem value="month">Month</SelectItem>
                                              <SelectItem value="seat">Seat</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label>Plan Status</Label>
                                        <div className="flex items-center space-x-4">
                                          <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                            <input
                                              type="radio"
                                              name="is_active"
                                              checked={editIsActive === true}
                                              onChange={() => setEditIsActive(true)}
                                              className="w-4 h-4 text-primary"
                                            />
                                            <span>Enabled</span>
                                          </label>
                                          <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                            <input
                                              type="radio"
                                              name="is_active"
                                              checked={editIsActive === false}
                                              onChange={() => setEditIsActive(false)}
                                              className="w-4 h-4 text-primary"
                                            />
                                            <span>Disabled</span>
                                          </label>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Features List</Label>
                                        <div className="space-y-2">
                                          {editFeatures.map((feat, idx) => (
                                            <div key={idx} className="flex items-center space-x-2">
                                              <Input
                                                value={feat}
                                                onChange={(e) => {
                                                  const updated = [...editFeatures];
                                                  updated[idx] = e.target.value;
                                                  setEditFeatures(updated);
                                                }}
                                                className="flex-1 text-sm"
                                              />
                                              <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => {
                                                  const updated = editFeatures.filter((_, i) => i !== idx);
                                                  setEditFeatures(updated);
                                                }}
                                              >
                                                Remove
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex items-center space-x-2 mt-2">
                                          <Input
                                            value={newFeatureText}
                                            onChange={(e) => setNewFeatureText(e.target.value)}
                                            placeholder="Add new feature..."
                                            className="text-sm"
                                          />
                                          <Button
                                            type="button"
                                            onClick={() => {
                                              if (newFeatureText.trim()) {
                                                setEditFeatures([...editFeatures, newFeatureText.trim()]);
                                                setNewFeatureText("");
                                              }
                                            }}
                                          >
                                            Add
                                          </Button>
                                        </div>
                                      </div>

                                      <Button
                                        onClick={handleUpdatePricing}
                                        disabled={loading}
                                        className="w-full gradient-primary mt-4"
                                      >
                                        {loading ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving Changes...
                                          </>
                                        ) : (
                                          "Save Changes"
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
                    
                    {/* CORPORATE PLANS TAB */}
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-auto"
                                    onClick={() => {
                                      setEditingPricing(plan);
                                      setEditPlanName(plan.plan_name);
                                      setNewAmount(plan.price.toString());
                                      setEditBillingType(plan.billing_type);
                                      setEditFeatures(plan.features_json || []);
                                      setEditIsActive(plan.is_active);
                                      setEditCategory(plan.category);
                                      setNewFeatureText("");
                                    }}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Plan
                                  </Button>
                                  <Dialog open={!!editingPricing && editingPricing.id === plan.id} onOpenChange={(open) => { if (!open) setEditingPricing(null); }}>
                                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Edit Pricing Plan</DialogTitle>
                                      <DialogDescription>
                                        Modify details for {plan.plan_name}. All changes save directly to the database.
                                      </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="plan_name">Plan Name</Label>
                                          <Input
                                            id="plan_name"
                                            value={editPlanName}
                                            onChange={(e) => setEditPlanName(e.target.value)}
                                            placeholder="Plan Name"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="category">Category</Label>
                                          <Select value={editCategory} onValueChange={setEditCategory}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="customer">Customer</SelectItem>
                                              <SelectItem value="corporate">Corporate</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="price">Price (₹)</Label>
                                          <Input
                                            id="price"
                                            type="number"
                                            value={newAmount}
                                            onChange={(e) => setNewAmount(e.target.value)}
                                            placeholder="Price"
                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" onWheel={(e) => e.currentTarget.blur()}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="billing_type">Billing Type</Label>
                                          <Select value={editBillingType} onValueChange={setEditBillingType}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="day">Day</SelectItem>
                                              <SelectItem value="week">Week</SelectItem>
                                              <SelectItem value="month">Month</SelectItem>
                                              <SelectItem value="seat">Seat</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label>Plan Status</Label>
                                        <div className="flex items-center space-x-4">
                                          <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                            <input
                                              type="radio"
                                              name="is_active"
                                              checked={editIsActive === true}
                                              onChange={() => setEditIsActive(true)}
                                              className="w-4 h-4 text-primary"
                                            />
                                            <span>Enabled</span>
                                          </label>
                                          <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                            <input
                                              type="radio"
                                              name="is_active"
                                              checked={editIsActive === false}
                                              onChange={() => setEditIsActive(false)}
                                              className="w-4 h-4 text-primary"
                                            />
                                            <span>Disabled</span>
                                          </label>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <Label>Features List</Label>
                                        <div className="space-y-2">
                                          {editFeatures.map((feat, idx) => (
                                            <div key={idx} className="flex items-center space-x-2">
                                              <Input
                                                value={feat}
                                                onChange={(e) => {
                                                  const updated = [...editFeatures];
                                                  updated[idx] = e.target.value;
                                                  setEditFeatures(updated);
                                                }}
                                                className="flex-1 text-sm"
                                              />
                                              <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => {
                                                  const updated = editFeatures.filter((_, i) => i !== idx);
                                                  setEditFeatures(updated);
                                                }}
                                              >
                                                Remove
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex items-center space-x-2 mt-2">
                                          <Input
                                            value={newFeatureText}
                                            onChange={(e) => setNewFeatureText(e.target.value)}
                                            placeholder="Add new feature..."
                                            className="text-sm"
                                          />
                                          <Button
                                            type="button"
                                            onClick={() => {
                                              if (newFeatureText.trim()) {
                                                setEditFeatures([...editFeatures, newFeatureText.trim()]);
                                                setNewFeatureText("");
                                              }
                                            }}
                                          >
                                            Add
                                          </Button>
                                        </div>
                                      </div>

                                      <Button
                                        onClick={handleUpdatePricing}
                                        disabled={loading}
                                        className="w-full gradient-primary mt-4"
                                      >
                                        {loading ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving Changes...
                                          </>
                                        ) : (
                                          "Save Changes"
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

                    {/* ADD PRICING PLAN DIALOG */}
                    <Dialog open={addPlanOpen} onOpenChange={setAddPlanOpen}>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Add New Pricing Plan</DialogTitle>
                          <DialogDescription>
                            Create a new pricing plan. Changes will be saved directly to the database.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="add_plan_name">Plan Name</Label>
                              <Input
                                id="add_plan_name"
                                value={addPlanName}
                                onChange={(e) => setAddPlanName(e.target.value)}
                                placeholder="Plan Name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="add_category">Category</Label>
                              <Select value={addCategory} onValueChange={setAddCategory}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="customer">Customer</SelectItem>
                                  <SelectItem value="corporate">Corporate</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="add_price">Price (₹)</Label>
                              <Input
                                id="add_price"
                                type="number"
                                value={addPrice}
                                onChange={(e) => setAddPrice(e.target.value)}
                                placeholder="Price"
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" onWheel={(e) => e.currentTarget.blur()}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="add_billing_type">Billing Type</Label>
                              <Select value={addBillingType} onValueChange={setAddBillingType}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="day">Day</SelectItem>
                                  <SelectItem value="week">Week</SelectItem>
                                  <SelectItem value="month">Month</SelectItem>
                                  <SelectItem value="seat">Seat</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Plan Status</Label>
                            <div className="flex items-center space-x-4">
                              <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                <input
                                  type="radio"
                                  name="add_is_active"
                                  checked={addIsActive === true}
                                  onChange={() => setAddIsActive(true)}
                                  className="w-4 h-4 text-primary"
                                />
                                <span>Enabled</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                <input
                                  type="radio"
                                  name="add_is_active"
                                  checked={addIsActive === false}
                                  onChange={() => setAddIsActive(false)}
                                  className="w-4 h-4 text-primary"
                                />
                                <span>Disabled</span>
                              </label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Features List</Label>
                            <div className="space-y-2">
                              {addFeatures.map((feat, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                  <Input
                                    value={feat}
                                    onChange={(e) => {
                                      const updated = [...addFeatures];
                                      updated[idx] = e.target.value;
                                      setAddFeatures(updated);
                                    }}
                                    className="flex-1 text-sm"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      const updated = addFeatures.filter((_, i) => i !== idx);
                                      setAddFeatures(updated);
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                              <Input
                                value={addFeatureText}
                                onChange={(e) => setAddFeatureText(e.target.value)}
                                placeholder="Add new feature..."
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                onClick={() => {
                                  if (addFeatureText.trim()) {
                                    setAddFeatures([...addFeatures, addFeatureText.trim()]);
                                    setAddFeatureText("");
                                  }
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          </div>

                          <Button
                            onClick={handleCreatePricing}
                            disabled={loading}
                            className="w-full gradient-primary mt-4"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating Plan...
                              </>
                            ) : (
                              "Create Plan"
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
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

            {/* Superuser Billing Management Tab */}
            <TabsContent value="billing">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Superuser Billing & Subscription Management</CardTitle>
                  <CardDescription>Monitor and manage workspace subscriptions, invoices, and outstanding balances for all approved companies.</CardDescription>
                </CardHeader>
                <CardContent>
                  {billingOverview.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No companies found with active pricing plans.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company / Customer</TableHead>
                          <TableHead>Current Plan</TableHead>
                          <TableHead>Seats</TableHead>
                          <TableHead>Outstanding</TableHead>
                          <TableHead>Plan Subscribed Date</TableHead>
                          <TableHead>Plan Expiry Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingOverview.map((item) => {
                          const isOverdueAfterExpiry = (() => {
                            if (Number(item.outstanding_amount) <= 0 || !item.plan_expiry_date) return false;
                            const expiry = new Date(item.plan_expiry_date);
                            expiry.setHours(23, 59, 59, 999);
                            return new Date() > expiry;
                          })();
                          
                          return (
                            <TableRow key={item.company_id}>
                              <TableCell className="py-3 font-semibold text-foreground">
                                <div>{item.company_name}</div>
                                <div className="text-[10px] text-muted-foreground font-normal capitalize">
                                  {item.type === 'company' ? 'Company' : 'Customer'}
                                </div>
                                {isOverdueAfterExpiry && (
                                  <div className="mt-1">
                                    <span className="inline-block px-2 py-0.5 text-[9px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 rounded-full border border-red-200 dark:border-red-900/40">
                                      not paid
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {item.current_plan_name || <span className="text-muted-foreground italic text-xs">No Plan selected</span>}
                              </TableCell>
                              <TableCell>{item.seats}</TableCell>
                              <TableCell className="py-3">
                                <span className="font-semibold text-destructive">₹{Number(item.outstanding_amount).toLocaleString()}</span>
                                {Number(item.outstanding_amount) > 0 && item.due_date && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                                    Due: {new Date(item.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.plan_subscribed_date 
                                  ? new Date(item.plan_subscribed_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                                  : '-'
                                }
                              </TableCell>
                              <TableCell>
                                {item.plan_expiry_date 
                                  ? new Date(item.plan_expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                                  : '-'
                                }
                              </TableCell>
                              <TableCell className="text-right py-3">
                                <div className="flex gap-2 justify-end">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleViewCompanyInvoices(item.company_id, item.company_name)}
                                  >
                                    Invoices
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleViewCompanyPayments(item.company_id, item.company_name)}
                                  >
                                    Payments
                                  </Button>
                                  {item.subscription_status === 'SUSPENDED' ? (
                                    <Button 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700 text-white font-medium"
                                      onClick={() => handleReactivateSubscription(item.company_id)}
                                    >
                                      Reactivate
                                    </Button>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleSuspendSubscription(item.company_id)}
                                      disabled={!item.current_plan_name}
                                    >
                                      Suspend
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Policy Management Tab */}
            <TabsContent value="security">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span>Platform Security Policy</span>
                  </CardTitle>
                  <CardDescription>
                    Configure platform-wide security options, password complexity settings, and roles requiring Multi-Factor Authentication (MFA).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Multi-Factor Authentication (MFA) Enforcement</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Select which user roles are required to set up and verify Multi-Factor Authentication (MFA) upon sign-in.
                    </p>
                    
                    <div className="space-y-4 max-w-md border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between pb-2 border-b border-muted">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">MFA Required</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="policy-superuser" className="text-sm font-medium">Superuser</Label>
                        <Checkbox
                          id="policy-superuser"
                          checked={securityPolicy.mfa.superuser}
                          onCheckedChange={(checked) => setSecurityPolicy(prev => ({
                            ...prev,
                            mfa: { ...prev.mfa, superuser: !!checked }
                          }))}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="policy-admin" className="text-sm font-medium">Platform Admin</Label>
                        <Checkbox
                          id="policy-admin"
                          checked={securityPolicy.mfa.admin}
                          onCheckedChange={(checked) => setSecurityPolicy(prev => ({
                            ...prev,
                            mfa: { ...prev.mfa, admin: !!checked }
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="policy-finance" className="text-sm font-medium">Finance Team</Label>
                        <Checkbox
                          id="policy-finance"
                          checked={securityPolicy.mfa.finance}
                          onCheckedChange={(checked) => setSecurityPolicy(prev => ({
                            ...prev,
                            mfa: { ...prev.mfa, finance: !!checked }
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="policy-corp" className="text-sm font-medium">Corporate Admin (Opt-in default)</Label>
                        <Checkbox
                          id="policy-corp"
                          checked={securityPolicy.mfa.corporate_admin}
                          onCheckedChange={(checked) => setSecurityPolicy(prev => ({
                            ...prev,
                            mfa: { ...prev.mfa, corporate_admin: !!checked }
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="policy-customer" className="text-sm font-medium">Customer (Opt-in default)</Label>
                        <Checkbox
                          id="policy-customer"
                          checked={securityPolicy.mfa.customer}
                          onCheckedChange={(checked) => setSecurityPolicy(prev => ({
                            ...prev,
                            mfa: { ...prev.mfa, customer: !!checked }
                          }))}
                        />
                      </div>


                    </div>
                  </div>

                  <Button onClick={saveSecurityPolicy} disabled={savingPolicy}>
                    {savingPolicy ? "Saving Policy..." : "Save Policies"}
                  </Button>
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

        {/* Superuser Company Invoices Modal */}
        <Dialog open={companyInvoicesModalOpen} onOpenChange={setCompanyInvoicesModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoices for {selectedCompanyForInvoiceView?.company_name}</DialogTitle>
              <DialogDescription>All invoices issued to this organization</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {selectedCompanyInvoices.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No invoices generated yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Seats</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCompanyInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-semibold">
                          <Button 
                            variant="link" 
                            className="p-0 h-auto font-semibold text-primary hover:underline"
                            onClick={() => setSelectedInvoiceToShow(inv)}
                          >
                            {inv.invoice_number || "INV-00000"}
                          </Button>
                        </TableCell>
                        <TableCell>{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>{inv.plan_name}</TableCell>
                        <TableCell>{inv.seats}</TableCell>
                        <TableCell className="font-semibold">₹{Number(inv.total_amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={inv.status === 'paid' ? 'default' : 'secondary'}
                            className={inv.status === 'paid' ? 'bg-green-500/15 text-green-700 border-green-200' : 'bg-amber-500/15 text-amber-700 border-amber-200'}
                          >
                            {inv.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setCompanyInvoicesModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Superuser Company Payments Modal */}
        <Dialog open={companyPaymentsModalOpen} onOpenChange={setCompanyPaymentsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment History for {selectedCompanyForInvoiceView?.company_name}</DialogTitle>
              <DialogDescription>All paid transactions and invoice settlements</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {selectedCompanyPaymentHistory.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No settled payments yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCompanyPaymentHistory.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-semibold">{inv.invoice_number || "INV-00000"}</TableCell>
                        <TableCell className="font-bold text-green-600">₹{Number(inv.total_amount).toLocaleString()}</TableCell>
                        <TableCell>
                          {inv.payment_date 
                            ? new Date(inv.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                            : new Date(inv.invoice_date).toLocaleDateString('en-IN')
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-500 hover:bg-green-600 text-white">PAID</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setCompanyPaymentsModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoice Preview Dialog */}
        <Dialog open={!!selectedInvoiceToShow} onOpenChange={(o) => { if (!o) setSelectedInvoiceToShow(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice #{selectedInvoiceToShow?.invoice_number}</DialogTitle>
              <DialogDescription>
                Issued on {selectedInvoiceToShow && new Date(selectedInvoiceToShow.invoice_date).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            {selectedInvoiceToShow && (
              <div className="py-4">
                <InvoiceRenderer invoice={selectedInvoiceToShow} mode="desktop" />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setSelectedInvoiceToShow(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
