import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { businessService } from '@/services/businessService';
import { dashboardService } from '@/services/dashboardService';
import { notificationService } from '@/services/notificationService';
import { InvoiceRenderer } from '@/components/InvoiceRenderer';
import { Invoice } from '@/services/invoiceService';

import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/dateUtils";
import { buildCombinedUsage } from "@/lib/historyUtils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NotificationBell } from "@/components/ui/notification-bell";
import { CheckInOutTab } from "@/components/CheckInOutTab";
import { 
  LogOut, 
  Calendar, 
  History, 
  MessageSquare, 
  Bell, 
  FileText, 
  Wifi, 
  HelpCircle,
  Loader2,
  Hexagon,
  Settings,
  Clock
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MeetingCalendar } from "@/components/MeetingCalendar";

const getTodayLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getOverlappedInterval = (hour: number, item: { start_time: string; end_time: string }) => {
  const [startH, startM] = item.start_time.split(':').map(Number);
  const [endH, endM] = item.end_time.split(':').map(Number);
  
  const itemStartMin = startH * 60 + startM;
  const itemEndMin = endH * 60 + endM;
  const hourStartMin = hour * 60;
  const hourEndMin = (hour + 1) * 60;
  
  const overlapStartMin = Math.max(itemStartMin, hourStartMin);
  const overlapEndMin = Math.min(itemEndMin, hourEndMin);
  
  const formatMinToTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  
  return {
    start: formatMinToTime(overlapStartMin),
    end: formatMinToTime(overlapEndMin)
  };
};

const isMeetingExpired = (meeting: any) => {
  if (!meeting || !meeting.meeting_date || !meeting.end_time) return false;
  const [year, month, day] = meeting.meeting_date.split("-").map(Number);
  const [hours, minutes] = meeting.end_time.split(":").map(Number);
  const now = new Date();
  const meetingEnd = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return meetingEnd < now;
};

const formatLocalDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIdx = parseInt(month, 10) - 1;
  const mName = monthNames[mIdx] || month;
  return `${parseInt(day, 10)} ${mName} ${year}`;
};


interface UsageLog {
  id: string;
  plan_type: string;
  date_selected: string;
  amount: number;
  created_at: string;
}

interface Update {
  id: string;
  message: string;
  type: string;
  created_at: string;
}

interface Query {
  id: string;
  message: string;
  response: string | null;
  status: string;
  created_at: string;
}

interface ContentSection {
  section: string;
  content: string;
}

interface PricingPlan {
  id: string;
  plan_type: string;
  amount: number;
  gst_rate: number;
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

interface CheckIn {
  id: string;
  user_id: string;
  plan_id: string;
  checkin_time?: string | null;
  checkout_time?: string | null;
  checkin_approved: boolean;
  checkin_approved_by?: string | null;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [usageHistory, setUsageHistory] = useState<UsageLog[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [pricing, setPricing] = useState<PricingPlan[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [blinkCheckInTab, setBlinkCheckInTab] = useState(false);
  const [hasMeetingAccess, setHasMeetingAccess] = useState(true);
  const [activeTab, setActiveTab] = useState("book");
  const [isPaymentOverdue, setIsPaymentOverdue] = useState(false);
  const [selectedCustInvoice, setSelectedCustInvoice] = useState<Invoice | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Meetings State
  const [corpMeetings, setCorpMeetings] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [bookingForm, setBookingForm] = useState({
    meeting_title: "",
    purpose: "",
    meeting_date: "",
    start_time: "",
    end_time: "",
    participants: 1 as number | string,
    room_id: "",
    department: "",
    notes: ""
  });
  const [requestMeetingModalOpen, setRequestMeetingModalOpen] = useState(false);
  const [cancelMeetingModalOpen, setCancelMeetingModalOpen] = useState(false);
  const [selectedMeetingToCancel, setSelectedMeetingToCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Availability & Room states
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);

  const [availabilityData, setAvailabilityData] = useState<any[]>([]);
  const [fetchingAvailability, setFetchingAvailability] = useState(false);
  const [dialogAvailability, setDialogAvailability] = useState<any[]>([]);
  const [dialogAvailabilityError, setDialogAvailabilityError] = useState("");
  const [checkingDialogAvailability, setCheckingDialogAvailability] = useState(false);

  const formatDateToInput = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const fetchRooms = async () => {
    try {
      const res = await apiClient.get('/meetings/rooms');
      setRooms(res.data);
      if (res.data.length > 0) {
        setSelectedRoomId(res.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchMeetingsForRoom = async (roomId: string) => {
    if (!roomId) return;
    try {
      const res = await apiClient.get(`/meetings/?room_id=${roomId}`);
      setMeetings(res.data);
    } catch (error) {
      console.error("Error fetching meetings for room:", error);
    }
  };

  const fetchAvailability = async (date: string, roomId: string) => {
    if (!roomId) return;
    setFetchingAvailability(true);
    try {
      const res = await apiClient.get(`/meetings/availability?date=${date}&room=${roomId}`);
      setAvailabilityData(res.data);
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setFetchingAvailability(false);
    }
  };

  const fetchCorpMeetings = async () => {
    try {
      const res = await apiClient.get('/meetings/');
      setCorpMeetings(res.data);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  };

  useEffect(() => {
    if (selectedRoomId) {
      fetchMeetingsForRoom(selectedRoomId);
    }
  }, [selectedRoomId, currentDate]);

  useEffect(() => {
    if (selectedCalendarDate && selectedRoomId) {
      const dateStr = formatDateToInput(selectedCalendarDate);
      fetchAvailability(dateStr, selectedRoomId);
    }
  }, [selectedCalendarDate, selectedRoomId]);

  // Dialog Availability & Validation
  useEffect(() => {
    const fetchDialogAvailability = async () => {
      if (!bookingForm.meeting_date || !bookingForm.room_id) {
        setDialogAvailability([]);
        return;
      }
      setCheckingDialogAvailability(true);
      try {
        const res = await apiClient.get(`/meetings/availability?date=${bookingForm.meeting_date}&room=${bookingForm.room_id}`);
        setDialogAvailability(res.data);
      } catch (error) {
        console.error("Error fetching dialog availability:", error);
      } finally {
        setCheckingDialogAvailability(false);
      }
    };
    fetchDialogAvailability();
  }, [bookingForm.meeting_date, bookingForm.room_id]);

  const checkDialogOverlap = (date: string, start: string, end: string, availabilityList: any[]) => {
    if (!date || !start || !end) return "";
    
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const requestedStartMin = startH * 60 + startM;
    const requestedEndMin = endH * 60 + endM;
    
    if (requestedEndMin <= requestedStartMin) {
      return "End time must be after start time.";
    }

    // Check if the slot date & time is in the past
    const now = new Date();
    now.setSeconds(0, 0);
    const [y, m, d] = date.split('-').map(Number);
    const requestedEnd = new Date(y, m - 1, d, endH, endM, 0, 0);
    if (requestedEnd < now) {
      return "You cannot book a meeting in a timed out slot.";
    }
    
    for (const item of availabilityList) {
      const [itemStartH, itemStartM] = item.start_time.split(':').map(Number);
      const [itemEndH, itemEndM] = item.end_time.split(':').map(Number);
      const itemStartMin = itemStartH * 60 + itemStartM;
      const itemEndMin = itemEndH * 60 + itemEndM;
      
      // Check overlap
      if (requestedStartMin < itemEndMin && itemStartMin < requestedEndMin) {
        return "This meeting slot is already booked or has already been requested. Please choose another available time.";
      }
    }
    
    return "";
  };

  useEffect(() => {
    if (!bookingForm.meeting_date || !bookingForm.room_id || !bookingForm.start_time || !bookingForm.end_time) {
      setDialogAvailabilityError("");
      return;
    }
    const err = checkDialogOverlap(
      bookingForm.meeting_date,
      bookingForm.start_time,
      bookingForm.end_time,
      dialogAvailability
    );
    setDialogAvailabilityError(err);
  }, [bookingForm.meeting_date, bookingForm.room_id, bookingForm.start_time, bookingForm.end_time, dialogAvailability]);

  const getHourStatus = (hour: number, availabilityList: any[]) => {
    const startHourMin = hour * 60;
    const endHourMin = (hour + 1) * 60;
    
    let status = "AVAILABLE";
    
    for (const item of availabilityList) {
      const [startH, startM] = item.start_time.split(':').map(Number);
      const [endH, endM] = item.end_time.split(':').map(Number);
      const itemStartMin = startH * 60 + startM;
      const itemEndMin = endH * 60 + endM;
      
      // Check overlap
      if (startHourMin < itemEndMin && itemStartMin < endHourMin) {
        if (item.status === "BOOKED") {
          return "BOOKED";
        }
        status = "PENDING";
      }
    }
    return status;
  };

  const handleSlotClick = (hour: number) => {
    const startTimeStr = `${String(hour).padStart(2, '0')}:00`;
    const endTimeStr = `${String(hour + 1).padStart(2, '0')}:00`;
    
    setBookingForm({
      meeting_title: "",
      purpose: "",
      meeting_date: selectedCalendarDate ? formatDateToInput(selectedCalendarDate) : "",
      start_time: startTimeStr,
      end_time: endTimeStr,
      participants: 1,
      room_id: selectedRoomId || "",
      department: "",
      notes: ""
    });
    setRequestMeetingModalOpen(true);
  };

  const handleBookingSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bookingForm.meeting_title.trim() || !bookingForm.purpose.trim() || !bookingForm.meeting_date || !bookingForm.start_time || !bookingForm.end_time) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      const formatTimeStr = (t: string) => t.length === 5 ? `${t}:00` : t;
      const payload = {
        ...bookingForm,
        start_time: formatTimeStr(bookingForm.start_time),
        end_time: formatTimeStr(bookingForm.end_time),
        room_id: bookingForm.room_id || null
      };
      await apiClient.post('/meetings/request', payload);
      toast({ title: "Meeting request submitted successfully" });
      setRequestMeetingModalOpen(false);
      setAvailableRooms([]); // Reset available rooms on success
      if (bookingForm.room_id) {
        setSelectedRoomId(bookingForm.room_id);
      }
      if (bookingForm.meeting_date) {
        const [y, m, d] = bookingForm.meeting_date.split('-').map(Number);
        setSelectedCalendarDate(new Date(y, m - 1, d));
      }
      fetchCorpMeetings();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        const errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
        toast({ title: "Submission failed", description: errMsg, variant: "destructive" });
      } else if (detail && detail.error_code === "MULTIPLE_ROOMS_AVAILABLE") {
        setAvailableRooms(detail.rooms);
        toast({ 
          title: "Multiple Rooms Available", 
          description: "Please select your preferred room." 
        });
      } else {
        const errMsg = typeof detail === "string" ? detail : (detail?.message || "Failed to submit request");
        toast({ title: "Submission failed", description: errMsg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedMeetingToCancel) return;
    setLoading(true);
    try {
      await apiClient.put(`/meetings/${selectedMeetingToCancel.id}/cancel`, {
        cancel_reason: cancelReason
      });
      toast({ title: "Meeting cancelled successfully" });
      setCancelMeetingModalOpen(false);
      fetchCorpMeetings();
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "Failed to cancel meeting";
      toast({ title: "Cancellation failed", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  const fetchMeetingAccess = async () => {
    try {
      const res = await apiClient.get('/meetings/check-access');
      setHasMeetingAccess(res.data.has_access);
    } catch (error) {
      console.error('Error checking meeting access:', error);
    }
  };

  useEffect(() => {
    const checkPaymentOverdueStatus = async () => {
      try {
        const { roles } = await authService.getSession();
        if (roles?.is_payment_overdue) {
          setIsPaymentOverdue(true);
          setActiveTab("invoices");
        } else {
          setIsPaymentOverdue(false);
        }
      } catch (error) {
        console.error("Failed to fetch session for payment overdue check:", error);
      }
    };

    checkPaymentOverdueStatus();
    fetchMeetingAccess();
    fetchUserData();
    fetchUpdates();
    fetchQueries();
    fetchContentSections();
    fetchPricing();
    fetchPlans();
    fetchCheckins();
    fetchInvoices();
    fetchRooms();
    fetchCorpMeetings();
    
    // Polling mechanism replacing Supabase WebSockets
    const pollInterval = setInterval(() => {
      checkPaymentOverdueStatus();
      fetchMeetingAccess();
      fetchQueries();
      fetchUpdates();
      fetchPricing();
      fetchPlans();
      fetchCheckins();
      fetchInvoices();
      fetchCorpMeetings();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    if (!hasMeetingAccess && activeTab === "meetings") {
      setActiveTab("query");
      toast({
        title: "Access Revoked",
        description: "Meeting Room Access is no longer available because it has been removed from your current workspace plan.",
        variant: "destructive"
      });
    }
  }, [hasMeetingAccess, activeTab]);

  const fetchUserData = async () => {
    try {
      const userRecord = await userService.getMe();
      if (userRecord) setUser(userRecord);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUpdates = async () => {
    try {
      const updates = await dashboardService.getUpdates();
      setUpdates(updates || []);
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };

  const fetchQueries = async () => {
    try {
      const queries = await dashboardService.getMyQueries();
      setQueries(queries || []);
    } catch (error) {
      console.error('Error fetching queries:', error);
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
      const data = await businessService.getCustomerPlans();
      const mapped = data.map((plan: any) => ({
        id: plan.id,
        plan_type: plan.billing_type,
        plan_name: plan.plan_name,
        amount: Number(plan.price),
        gst_rate: 18,
        features_json: plan.features_json
      }));
      setPricing(mapped || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const plans = await businessService.getMyPlans();
      setPlans(plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await apiClient.get("/invoices/");
      setInvoices(res.data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setLoading(true);
    try {
      await apiClient.post(`/invoices/${invoiceId}/pay`);
      toast({
        title: "Payment Successful",
        description: "Your invoice has been successfully marked as paid.",
      });
      fetchInvoices();
      fetchPlans();
      fetchCheckins();
    } catch (error) {
      console.error("Error paying invoice:", error);
      toast({
        title: "Payment Failed",
        description: "Failed to process invoice payment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckins = async () => {
    try {
      const checkins = await businessService.getMyCheckins();
      setCheckins(checkins || []);
    } catch (error) {
      console.error('Error fetching checkins:', error);
    }
  };

  const getActivePlan = () => {
    const today = new Date().toISOString().split('T')[0];
    return plans.find(plan => 
      plan.is_active && 
      plan.start_date <= today && 
      plan.end_date >= today
    );
  };

  const handleBookPlan = async () => {
    // Check if user already has an active plan
    if (getActivePlan()) {
      toast({
        title: "Active Plan Found",
        description: "You already have an active plan. Please wait for it to expire before booking a new one.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedPlan || !selectedDate) {
      toast({
        title: "Validation Error",
        description: "Please select both plan type and date.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const userRecord = await userService.getMe();
      if (!userRecord) throw new Error("User not found");

      const selectedPlanPricing = pricing.find(p => p.plan_type === selectedPlan);
      if (!selectedPlanPricing) throw new Error("Plan pricing not found");

      const price = Number(selectedPlanPricing.amount);
      const totalAmount = price + (price * selectedPlanPricing.gst_rate / 100);

      // Calculate start and end dates based on plan type
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      
      if (selectedPlan === 'week') {
        endDate.setDate(startDate.getDate() + 6); // 7 days total
      } else if (selectedPlan === 'month') {
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(startDate.getDate() - 1); // Last day of month period
      }

      await businessService.createPlan({
          user_id: userRecord.id,
          plan_type: selectedPlan,
          amount: Math.round(totalAmount),
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          is_active: true
        });

      toast({
        title: "Plan Purchased Successfully!",
        description: `Your ${selectedPlan} plan is active from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.`,
        variant: "default"
      });

      setSelectedPlan("");
      setSelectedDate("");
      fetchPlans();
      fetchInvoices();
    } catch (error) {
      console.error('Error booking plan:', error);
      toast({
        title: "Booking Failed",
        description: "Failed to book plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuery = async () => {
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const userRecord = await userService.getMe();
      if (!userRecord) throw new Error("User not found");

      await dashboardService.createQuery({
        user_id: userRecord.id,
        query_text: queryText
      });

      toast({
        title: "Query Submitted",
        description: "We will get back to you soon.",
        variant: "default"
      });

      setQueryText("");
      fetchQueries();
    } catch (error) {
      console.error('Error submitting query:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit query. Please try again.",
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

  const getContentBySection = (section: string) => {
    const found = contentSections.find(c => c.section === section);
    return found?.content || `${section.charAt(0).toUpperCase() + section.slice(1)} information will be available here.`;
  };

  return (
    <AuthGuard requiredRole="user" requireApproval={true}>
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
                  <h1 className="text-2xl font-bold text-foreground">Nerdshive</h1>
                  <p className="text-sm text-muted-foreground">Welcome back, {user?.full_name}</p>
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
          {isPaymentOverdue && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="text-red-800 font-bold text-sm">Services Suspended - Payment Overdue</h3>
                <p className="text-red-700 text-xs mt-1">
                  You have one or more unpaid invoices past their due dates. Workspace booking, check-in, and support services have been temporarily suspended. Please make payment immediately to restore active services.
                </p>
              </div>
            </div>
          )}

          <Tabs 
            value={activeTab} 
            onValueChange={(val) => {
              if (isPaymentOverdue && val !== "invoices") return;
              setActiveTab(val);
            }} 
            className="space-y-6"
          >
            <TabsList className={`grid w-full grid-cols-3 h-auto p-1 bg-muted/50 gap-1 ${
              hasMeetingAccess 
                ? "md:grid-cols-7 lg:w-auto lg:grid-cols-7" 
                : "md:grid-cols-6 lg:w-auto lg:grid-cols-6"
            }`}>
              <TabsTrigger value="book" disabled={isPaymentOverdue}>
                <Calendar className="w-4 h-4 mr-2" />
                Book Plan
              </TabsTrigger>
              <TabsTrigger value="checkin" className={blinkCheckInTab ? 'blink-tab' : ''} disabled={isPaymentOverdue}>
                <Clock className="w-4 h-4 mr-2" />
                Check In/Out
              </TabsTrigger>
              {hasMeetingAccess && (
                <TabsTrigger value="meetings" disabled={isPaymentOverdue}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Meetings
                </TabsTrigger>
              )}
              <TabsTrigger value="history" disabled={isPaymentOverdue}>
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <FileText className="w-4 h-4 mr-2" />
                Invoices
              </TabsTrigger>
              <TabsTrigger value="query" disabled={isPaymentOverdue}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Query
              </TabsTrigger>
              <TabsTrigger value="guide" disabled={isPaymentOverdue}>
                <HelpCircle className="w-4 h-4 mr-2" />
                Guide
              </TabsTrigger>
            </TabsList>

            {/* Book Plan Tab */}
            <TabsContent value="book">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Book Your Workspace</CardTitle>
                  <CardDescription>
                    {getActivePlan() ? `You have an active ${getActivePlan()?.plan_type} plan` : "Select a plan and date to book your workspace"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getActivePlan() && (
                    <div className="bg-muted p-4 rounded-lg mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">Active Plan</h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {getActivePlan()?.plan_type} Plan - ₹{getActivePlan()?.amount}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Valid from {formatDate(getActivePlan()!.start_date)} to {formatDate(getActivePlan()!.end_date)}
                          </p>
                        </div>
                        <div className="text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        You cannot book another plan while you have an active one. Please wait for your current plan to expire or check in/out using the Check In/Out tab.
                      </p>
                    </div>
                  )}

                  {/* Dynamic pricing cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {pricing.sort((a, b) => {
                      const order = { 'day': 1, 'week': 2, 'month': 3 };
                      return (order[a.plan_type as keyof typeof order] || 4) - (order[b.plan_type as keyof typeof order] || 4);
                    }).map((plan: any) => {
                      const price = Number(plan.amount);
                      const gstAmount = price * (plan.gst_rate / 100);
                      const totalAmount = price + gstAmount;
                      const hasActive = !!getActivePlan();
                      const isSelected = !hasActive && selectedPlan === plan.plan_type;
                      return (
                        <Card 
                          key={plan.id} 
                          className={`flex flex-col transition-all duration-300 border-2 relative ${
                            hasActive
                              ? 'opacity-60 grayscale cursor-not-allowed border-muted bg-muted/20 pointer-events-none'
                              : isSelected
                                ? 'cursor-pointer border-primary shadow-lg bg-primary/5 scale-[1.02]' 
                                : 'cursor-pointer hover:border-primary/50 bg-card hover:scale-[1.01]'
                          }`}
                          onClick={() => {
                            if (!hasActive) {
                              setSelectedPlan(plan.plan_type);
                            }
                          }}
                        >
                          {isSelected && (
                            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs rounded-bl-lg font-semibold">
                              Selected
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle className="text-lg font-bold">{plan.plan_name}</CardTitle>
                            <div className="mt-2">
                              <div className="text-3xl font-extrabold text-foreground">₹{price}</div>
                              <div className="text-xs text-muted-foreground mt-1">+ ₹{Math.round(gstAmount)} GST</div>
                              <div className="text-sm font-semibold text-primary mt-1">₹{Math.round(totalAmount)} Total</div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 flex flex-col justify-between">
                            <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                              {plan.features_json?.map((feat: string, i: number) => (
                                <li key={i} className="flex items-start space-x-2">
                                  <span className="text-primary font-bold mt-0.5">✓</span>
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {!getActivePlan() && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="plan">Selected Plan</Label>
                          <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose plan type" />
                            </SelectTrigger>
                            <SelectContent>
                              {pricing.sort((a, b) => {
                                const order = { 'day': 1, 'week': 2, 'month': 3 };
                                return (order[a.plan_type as keyof typeof order] || 4) - (order[b.plan_type as keyof typeof order] || 4);
                              }).map((plan) => {
                                const price = Number(plan.amount);
                                const totalAmount = price + (price * plan.gst_rate / 100);
                                const planLabel = plan.plan_type === 'day' ? 'Day Pass' :
                                                 plan.plan_type === 'week' ? 'Weekly Pass' : 'Monthly Pass';
                                return (
                                  <SelectItem key={plan.id} value={plan.plan_type}>
                                    {planLabel} - ₹{Math.round(totalAmount)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date">Start Date</Label>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleBookPlan}
                        disabled={loading}
                        className="w-full gradient-primary hover:shadow-primary transition-smooth mt-4"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Booking...
                          </>
                        ) : (
                          "Book Plan"
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Check In/Out Tab */}
            <TabsContent value="checkin">
              <CheckInOutTab 
                plans={plans} 
                checkins={checkins} 
                onUpdate={() => {
                  fetchPlans();
                  fetchCheckins();
                }} 
              />
            </TabsContent>
            
            {/* Usage History Tab */}
            <TabsContent value="history">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Usage History</CardTitle>
                  <CardDescription>
                    View your past bookings and usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const combinedHistory = buildCombinedUsage(usageHistory, plans);

                    if (combinedHistory.length === 0) {
                      return (
                        <p className="text-center text-muted-foreground py-8">
                          No usage history found. Book your first plan!
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-center">Plan Type</TableHead>
                              <TableHead className="text-center">Date</TableHead>
                              <TableHead className="text-center">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {combinedHistory.map((item) => {
                              const planName =
                                item.plan_type === 'day'
                                  ? 'Day Pass'
                                  : item.plan_type === 'week'
                                  ? 'Weekly Pass'
                                  : 'Monthly Pass';
                              return (
                                <TableRow key={`${item.source}-${item.id}`}>
                                  <TableCell className="font-medium text-center">{planName}</TableCell>
                                  <TableCell className="text-center">{formatDate(item.date)}</TableCell>
                                  <TableCell className="text-center">₹{item.amount}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Submit Query Tab */}
            <TabsContent value="query">
              <div className="space-y-6">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Submit Query</CardTitle>
                    <CardDescription>
                      Send a message to administrators
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="query">Your Query</Label>
                      <Textarea
                        id="query"
                        placeholder="Enter your query or concern..."
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <Button
                      onClick={handleSubmitQuery}
                      disabled={loading}
                      className="w-full gradient-primary hover:shadow-primary transition-smooth"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Query"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Previous Queries */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Your Queries</CardTitle>
                    <CardDescription>
                      Track your submitted queries and responses
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
                              <p className="font-medium">Query</p>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                query.status === 'closed' 
                                  ? 'bg-success/10 text-success' 
                                  : 'bg-warning/10 text-warning'
                              }`}>
                                {query.status || 'open'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{query.message}</p>
                            {query.response && (
                              <>
                                <p className="font-medium text-sm mt-3">Admin Response:</p>
                                <p className="text-sm bg-muted p-2 rounded">{query.response}</p>
                              </>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Submitted: {formatDate(query.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>



            {/* Guide Tab */}
            <TabsContent value="guide">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: getContentBySection('rules').replace(/\n/g, '<br>') 
                      }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <HelpCircle className="w-5 h-5 mr-2" />
                      Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: getContentBySection('guide').replace(/\n/g, '<br>') 
                      }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Wifi className="w-5 h-5 mr-2" />
                      WiFi Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: getContentBySection('wifi').replace(/\n/g, '<br>') 
                      }} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings" className="space-y-6">
              <div className="bg-card p-4 rounded-xl border">
                <h2 className="text-lg font-bold">Workspace Meetings</h2>
                <p className="text-sm text-muted-foreground">Select a date on the calendar, click any green hourly available slot on the schedule, and request a booking.</p>
              </div>

              {/* Workspace Meeting Availability Calendar (Left) and Details/Lists (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Left Column: Calendar */}
                <div className="flex flex-col h-full">
                  <MeetingCalendar
                    userRole="corporate"
                    meetings={meetings}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    selectedCalendarDate={selectedCalendarDate}
                    setSelectedCalendarDate={setSelectedCalendarDate}
                    startOfWeek="mon"
                    className="h-full"
                  />
                </div>

                {/* Right Column: Schedule */}
                <div className="flex flex-col h-full">
                  {selectedCalendarDate && (
                    <Card className="shadow-sm h-full flex flex-col justify-between">
                      <CardContent className="p-4 space-y-4 flex-1 flex flex-col">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="font-bold text-sm text-foreground">
                            {selectedCalendarDate.getDate()} {selectedCalendarDate.toLocaleString("default", { month: "long" })} {selectedCalendarDate.getFullYear()} Schedule
                          </h4>
                          <span className="text-xs text-muted-foreground font-semibold">
                            Room: {rooms.find(r => r.id === selectedRoomId)?.room_name || "Meeting Room"}
                          </span>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center space-x-3 text-[10px] font-medium text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                            Available
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                            Pending
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                            Booked
                          </span>
                        </div>

                        {fetchingAvailability ? (
                          <div className="flex items-center justify-center py-6 flex-1">
                            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                            <span className="text-xs text-muted-foreground">Checking availability...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 flex-1">
                            {Array.from({ length: 12 }, (_, i) => i + 8).map((hour) => {
                              const status = getHourStatus(hour, availabilityData);
                              const displayStart = `${String(hour).padStart(2, '0')}:00`;
                              const displayEnd = `${String(hour + 1).padStart(2, '0')}:00`;

                              const isPast = (() => {
                                if (!selectedCalendarDate) return false;
                                const now = new Date();
                                const slotEnd = new Date(
                                  selectedCalendarDate.getFullYear(),
                                  selectedCalendarDate.getMonth(),
                                  selectedCalendarDate.getDate(),
                                  hour + 1,
                                  0,
                                  0,
                                  0
                                );
                                return slotEnd < now;
                              })();

                              let colorClasses = "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400";
                              let statusText = "Available 🟢";

                              if (isPast) {
                                colorClasses = "bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500 opacity-60 border-gray-200 dark:border-gray-800";
                                statusText = "Timed Out ⚪";
                              } else if (status === "BOOKED") {
                                colorClasses = "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400";
                                statusText = "Booked 🔴";
                              } else if (status === "PENDING") {
                                colorClasses = "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400";
                                statusText = "Pending 🟡";
                              }

                              const content = (
                                <div className={`p-2 border rounded-lg text-center ${colorClasses} ${(!isPast) ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-150" : ""} select-none`}>
                                  <p className="text-xs font-semibold">{displayStart} - {displayEnd}</p>
                                  <p className="text-[9px] uppercase font-bold mt-0.5 tracking-wider">{statusText}</p>
                                </div>
                              );

                              if (isPast) {
                                return (
                                  <div key={hour}>
                                    {content}
                                  </div>
                                );
                              }

                              if (status === "AVAILABLE") {
                                return (
                                  <div 
                                    key={hour} 
                                    onClick={() => handleSlotClick(hour)}
                                  >
                                    {content}
                                  </div>
                                );
                              }

                              const overlapping = availabilityData.filter(item => {
                                const [startH, startM] = item.start_time.split(':').map(Number);
                                const [endH, endM] = item.end_time.split(':').map(Number);
                                const itemStartMin = startH * 60 + startM;
                                const itemEndMin = endH * 60 + endM;
                                const startHourMin = hour * 60;
                                const endHourMin = (hour + 1) * 60;
                                return startHourMin < itemEndMin && itemStartMin < endHourMin;
                              });

                              return (
                                <Popover key={hour}>
                                  <PopoverTrigger asChild>
                                    {content}
                                  </PopoverTrigger>
                                  <PopoverContent className="w-52 p-2.5 text-xs">
                                    <h5 className="font-bold border-b pb-1 mb-1 uppercase text-[9px] tracking-wider text-muted-foreground">Slot Occupancy</h5>
                                    <div className="space-y-1">
                                      {overlapping.map((item, idx) => {
                                        const overlap = getOverlappedInterval(hour, item);
                                        const isBooked = item.status === "BOOKED";
                                        return (
                                          <div key={idx} className="flex justify-between items-center bg-muted/40 p-1 px-1.5 rounded border text-[11px]">
                                            <span className="font-semibold">{overlap.start} - {overlap.end}</span>
                                            <Badge 
                                              variant={isBooked ? "destructive" : "outline"} 
                                              className={`text-[8px] h-3.5 px-1 leading-none uppercase font-bold ${
                                                isBooked 
                                                  ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/30" 
                                                  : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/30"
                                              }`}
                                            >
                                              {isBooked ? "Booked" : "Pending"}
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Stacked Meeting Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
                {/* Upcoming Meetings */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 border-b">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Upcoming Meetings</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") >= new Date(new Date().setHours(0,0,0,0))).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-1">No upcoming approved meetings.</p>
                      ) : (
                        corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") >= new Date(new Date().setHours(0,0,0,0))).map(m => (
                          <Card key={m.id} className="border-l-4 border-l-green-500 shadow-sm">
                            <CardContent className="p-3 flex justify-between items-start text-xs">
                              <div className="space-y-0.5">
                                <p className="font-bold text-sm">{m.meeting_title}</p>
                                <p className="text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                                {m.decision_notes && <p className="italic text-muted-foreground mt-1">Note: "{m.decision_notes}"</p>}
                              </div>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 text-[10px] h-6 px-2" onClick={() => {
                                setSelectedMeetingToCancel(m);
                                setCancelReason("");
                                setCancelMeetingModalOpen(true);
                              }}>Cancel</Button>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Pending Requests */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 border-b">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {corpMeetings.filter(m => m.status === 'PENDING').length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-1">No pending requests.</p>
                      ) : (
                        corpMeetings.filter(m => m.status === 'PENDING').map(m => {
                          const isExpired = isMeetingExpired(m);
                          return (
                            <Card key={m.id} className={`border-l-4 ${isExpired ? 'border-l-gray-400' : 'border-l-amber-500'} shadow-sm`}>
                              <CardContent className="p-3 flex justify-between items-start text-xs">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-sm">{m.meeting_title}</p>
                                    {isExpired && (
                                      <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 text-[9px] py-0 px-1 h-4 leading-none">
                                        Timed Out
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                                </div>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 text-[10px] h-6 px-2" onClick={() => {
                                  setSelectedMeetingToCancel(m);
                                  setCancelReason("");
                                  setCancelMeetingModalOpen(true);
                                }}>Cancel</Button>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Completed Meetings */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 border-b">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Meetings</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 opacity-75">
                      {corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") < new Date(new Date().setHours(0,0,0,0))).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-1">No completed meetings.</p>
                      ) : (
                        corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") < new Date(new Date().setHours(0,0,0,0))).map(m => (
                          <Card key={m.id} className="shadow-sm">
                            <CardContent className="p-3 text-xs">
                              <p className="font-bold text-sm">{m.meeting_title}</p>
                              <p className="text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Rejected Requests */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 border-b">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rejected Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {corpMeetings.filter(m => m.status === 'REJECTED').length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-1">No rejected requests.</p>
                      ) : (
                        corpMeetings.filter(m => m.status === 'REJECTED').map(m => (
                          <Card key={m.id} className="border-l-4 border-l-red-500 shadow-sm">
                            <CardContent className="p-3 text-xs">
                              <p className="font-bold text-sm">{m.meeting_title}</p>
                              <p className="text-muted-foreground">Date: {m.meeting_date}</p>
                              {m.decision_notes && <p className="italic text-red-600 mt-1">Reason: "{m.decision_notes}"</p>}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Cancelled Meetings */}
                <Card className="shadow-sm">
                  <CardHeader className="py-3 border-b">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cancelled Meetings</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {corpMeetings.filter(m => m.status === 'CANCELLED').length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-1">No cancelled meetings.</p>
                      ) : (
                        corpMeetings.filter(m => m.status === 'CANCELLED').map(m => (
                          <Card key={m.id} className="border-l-4 border-l-gray-400 shadow-sm">
                            <CardContent className="p-3 text-xs">
                              <p className="font-bold text-sm text-muted-foreground">{m.meeting_title}</p>
                              <p className="text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                              {m.cancel_reason && <p className="italic text-muted-foreground mt-1">Reason: "{m.cancel_reason}"</p>}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Your Invoices</CardTitle>
                  <CardDescription>View and pay receipts for your workspace bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  {invoices.length > 0 && (
                    <div className="flex justify-between items-center mb-4">
                      <Input
                        placeholder="Search invoices by number, plan, or status..."
                        value={invoiceSearchQuery}
                        onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                  )}
                  {invoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No invoices or booking history found.
                    </div>
                  ) : (() => {
                    const filteredInvoices = invoices.filter(inv => {
                      const query = invoiceSearchQuery.toLowerCase().trim();
                      if (!query) return true;
                      return (
                        inv.invoice_number?.toLowerCase().includes(query) ||
                        inv.plan_name?.toLowerCase().includes(query) ||
                        inv.status?.toLowerCase().includes(query) ||
                        (inv.billing_start_date && inv.billing_start_date.includes(query))
                      );
                    });
                    
                    if (filteredInvoices.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No invoices match your search query.
                        </div>
                      );
                    }
                    
                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice Number</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Billing Cycle</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Validity</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredInvoices.map((inv) => {
                              const isPaid = inv.status === 'paid';
                              const isVoided = inv.invoice_status === 'voided';
                              return (
                                <TableRow key={inv.id}>
                                  <TableCell className="font-mono text-xs font-bold text-blue-600">
                                  {inv.invoice_number}
                                </TableCell>
                                <TableCell className="capitalize font-semibold">
                                  {inv.plan_name}
                                </TableCell>
                                <TableCell className="capitalize">
                                  {inv.billing_type === "day" ? "Daily" : inv.billing_type === "week" ? "Weekly" : "Monthly"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  ₹{Number(inv.total_amount).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {inv.billing_start_date ? `${formatLocalDate(inv.billing_start_date)} - ${formatLocalDate(inv.billing_end_date)}` : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {isVoided ? (
                                    <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                                      Voided
                                    </Badge>
                                  ) : (
                                    <div className="flex flex-col items-start space-y-1">
                                      <Badge 
                                        className={isPaid ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}
                                      >
                                        {isPaid ? "Paid" : "Unpaid"}
                                      </Badge>
                                      {!isPaid && inv.due_date && (
                                        <span className="text-[10px] text-red-600 font-semibold whitespace-nowrap mt-1">
                                          Due: {formatLocalDate(inv.due_date)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  {!isPaid && !isVoided && (
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                                      onClick={() => handlePayInvoice(inv.id)}
                                      disabled={loading}
                                    >
                                      Pay Now
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setSelectedCustInvoice(inv)}
                                  >
                                    View Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Dialog open={requestMeetingModalOpen} onOpenChange={setRequestMeetingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Meeting Room</DialogTitle>
            <DialogDescription>
              Submit details to request a meeting room booking.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Read-only slot summary */}
            <div className="p-3 bg-muted/40 rounded-lg border border-dashed text-xs space-y-1.5 mb-2">
              <p><span className="font-semibold text-muted-foreground">Selected Room:</span> <span className="font-bold text-foreground">{rooms.find(r => r.id === bookingForm.room_id)?.room_name || "Meeting Room"}</span></p>
              <p><span className="font-semibold text-muted-foreground">Selected Date:</span> <span className="font-bold text-foreground">{formatLocalDate(bookingForm.meeting_date)}</span></p>
              <p><span className="font-semibold text-muted-foreground">Time Slot:</span> <span className="font-bold text-primary text-sm">{bookingForm.start_time} - {bookingForm.end_time}</span></p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="meeting_title">Meeting Title *</Label>
              <Input 
                id="meeting_title" 
                value={bookingForm.meeting_title} 
                onChange={e => setBookingForm({...bookingForm, meeting_title: e.target.value})} 
                placeholder="e.g. Q3 Business Review" 
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purpose">Purpose *</Label>
              <Input 
                id="purpose" 
                value={bookingForm.purpose} 
                onChange={e => setBookingForm({...bookingForm, purpose: e.target.value})} 
                placeholder="e.g. Planning and strategy" 
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="participants">Participants *</Label>
              <Input 
                id="participants" 
                type="number"
                min={1}
                value={bookingForm.participants} 
                onChange={e => {
                  const val = e.target.value;
                  setBookingForm({
                    ...bookingForm,
                    participants: val === "" ? "" : (parseInt(val) || 0)
                  });
                }}
                onBlur={() => {
                  const num = Number(bookingForm.participants);
                  if (isNaN(num) || num < 1) {
                    toast({ title: "Validation Error", description: "Participants must be 1 or more", variant: "destructive" });
                  }
                }}
              />
            </div>

            {dialogAvailabilityError && (
              <p className="text-xs font-semibold text-destructive mt-1 bg-destructive/10 p-2 rounded border border-destructive/20">
                {dialogAvailabilityError}
              </p>
            )}
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setRequestMeetingModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => handleBookingSubmit()} 
                disabled={loading || !bookingForm.room_id || !bookingForm.meeting_date || !bookingForm.start_time || !bookingForm.end_time || !!dialogAvailabilityError}
              >
                {loading ? "Submitting..." : "Request Meeting"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelMeetingModalOpen} onOpenChange={setCancelMeetingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Meeting Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the meeting "{selectedMeetingToCancel?.meeting_title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel_reason">Reason for Cancellation</Label>
              <Input 
                id="cancel_reason" 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                placeholder="e.g. Rescheduled / Booking error" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelMeetingModalOpen(false)}>Close</Button>
            <Button variant="destructive" onClick={() => handleCancelSubmit()} disabled={loading}>
              {loading ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Invoice View Dialog */}
      <Dialog open={!!selectedCustInvoice} onOpenChange={(o) => { if (!o) setSelectedCustInvoice(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center text-xl font-bold pr-6">
              <span>Invoice Details</span>
              <Badge className={selectedCustInvoice?.status === 'paid' ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>
                {selectedCustInvoice?.status === 'paid' ? "🟢 Paid" : "🔴 Unpaid"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedCustInvoice && (
            <div className="p-4 bg-muted/20 rounded-xl border">
              <InvoiceRenderer invoice={selectedCustInvoice} mode="desktop" />
            </div>
          )}

          <DialogFooter className="flex sm:justify-between items-center w-full">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Print Invoice
            </Button>
            <Button onClick={() => setSelectedCustInvoice(null)} size="sm">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthGuard>
  );
}