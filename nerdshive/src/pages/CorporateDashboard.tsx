import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { corporateService, DashboardStats } from "@/services/corporateService";
import { authService } from "@/services/authService";
import { AuthGuard } from "@/components/ui/auth-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, LogOut, Users, Clock, CreditCard, MessageSquare, Building, Shield, Activity, Download, UploadCloud, Edit2, Settings, Plus, Check, Loader2, Calendar, FileText, Eye, Hexagon, AlertCircle, Search, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { invoiceService, Invoice } from "@/services/invoiceService";
import { InvoiceRenderer, renderInvoiceToHtml } from "@/components/InvoiceRenderer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import { NotificationBell } from "@/components/ui/notification-bell";
import { MeetingCalendar } from "@/components/MeetingCalendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export default function CorporateDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceSelectedDept, setAttendanceSelectedDept] = useState("all");
  const [attendanceDate, setAttendanceDate] = useState(getTodayLocalDateStr());
  const [attendanceCurrentPage, setAttendanceCurrentPage] = useState(1);
  const attendanceItemsPerPage = 10;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [subscriptionLockModalOpen, setSubscriptionLockModalOpen] = useState(false);
  const [lockedTabAttempt, setLockedTabAttempt] = useState<string | null>(null);
  const [hasMeetingAccess, setHasMeetingAccess] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isPaymentOverdue, setIsPaymentOverdue] = useState(false);
  const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [requestSeatsModalOpen, setRequestSeatsModalOpen] = useState(false);
  const [requestedSeatsInput, setRequestedSeatsInput] = useState(0);
  const [seatLogModalOpen, setSeatLogModalOpen] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<any | null>(null);

  const [enrollEditingEmployeeId, setEnrollEditingEmployeeId] = useState<string | null>(null);
  const [enrollFormValues, setEnrollFormValues] = useState({
    employee_id: "",
    full_name: "",
    gender: "",
    date_of_birth: "",
    mobile: "",
    email: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    duration: "",
    department: "",
    designation: "",
    company: "",
    joining_date: "",
    govt_id_type: "Aadhaar",
    govt_id_number: "",
    requires_parking: false,
    vehicle_type: "",
    vehicle_brand_model: "",
    vehicle_color: "",
    vehicle_registration: ""
  });
  const [enrollFormErrors, setEnrollFormErrors] = useState<Record<string, string>>({});
  const [enrollFormTouched, setEnrollFormTouched] = useState<Record<string, boolean>>({});
  
  // Queries State
  const [queries, setQueries] = useState<any[]>([]);
  const [newQueryMessage, setNewQueryMessage] = useState("");
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Meetings State
  const [corpMeetings, setCorpMeetings] = useState<any[]>([]);
  const [corporatePlans, setCorporatePlans] = useState<any[]>([]);
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
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");

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

  // Seat allocation states
  const [seatsActionType, setSeatsActionType] = useState<"increase" | "reduce">("increase");
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatDateToInput = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  const fetchRooms = async () => {
    try {
      const { apiClient } = await import('@/lib/apiClient');
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
      const { apiClient } = await import('@/lib/apiClient');
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
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.get(`/meetings/availability?date=${date}&room=${roomId}`);
      setAvailabilityData(res.data);
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setFetchingAvailability(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchCorporatePlans();
    fetchRooms();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMeetingAccess();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hasMeetingAccess && activeTab === "meetings") {
      setActiveTab("queries");
      toast({
        title: "Access Revoked",
        description: "Meeting Room Access is no longer available because it has been removed from your current workspace plan.",
        variant: "destructive"
      });
    }
  }, [hasMeetingAccess, activeTab]);

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
        const { apiClient } = await import('@/lib/apiClient');
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

  const requestSeatPermission = async () => {
    setLoading(true);
    try {
      await corporateService.requestSeatPermission();
      toast({ title: "Seat permission request submitted successfully." });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Request Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openRequestIncreaseSeatsModal = () => {
    setSeatsActionType("increase");
    setRequestedSeatsInput(0);
    setRequestSeatsModalOpen(true);
  };

  const openRequestReduceSeatsModal = () => {
    setSeatsActionType("reduce");
    setRequestedSeatsInput(0);
    setRequestSeatsModalOpen(true);
  };

  const fetchMeetingAccess = async () => {
    try {
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.get('/meetings/check-access');
      setHasMeetingAccess(res.data.has_access);
    } catch (error) {
      console.error('Error checking meeting access:', error);
    }
  };

  const fetchInvoices = async (companyId: string) => {
    try {
      const data = await invoiceService.getCompanyInvoices(companyId);
      setInvoices(data);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    try {
      await invoiceService.payInvoice(invoiceId);
      toast({
        title: "Payment Successful",
        description: "Your invoice has been marked as paid.",
      });
      if (companyInfo && companyInfo.id) {
        fetchInvoices(companyInfo.id);
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.response?.data?.detail || "Could not complete payment.",
        variant: "destructive",
      });
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const handleDownloadInvoice = () => {
    if (!selectedInvoiceForModal) return;
    const htmlContent = renderInvoiceToHtml(selectedInvoiceForModal);
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Invoice_${selectedInvoiceForModal.invoice_number}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSelectedDateString = () => {
    if (!attendanceDate) return "—";
    const parts = attendanceDate.split("-").map(Number);
    if (parts.length !== 3) return attendanceDate;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  };

  const formatWorkingHours = (hoursVal: any) => {
    if (hoursVal === undefined || hoursVal === null) return "—";
    const numHours = parseFloat(hoursVal);
    if (isNaN(numHours)) return "—";
    
    const h = Math.floor(numHours);
    const m = Math.round((numHours - h) * 60);
    
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const getDayInTimeBadgeColor = (hoursVal: any) => {
    const numHours = parseFloat(hoursVal);
    if (isNaN(numHours)) return "bg-muted text-muted-foreground border-transparent";
    
    if (numHours >= 8.0) {
      return "bg-green-100 text-green-800 hover:bg-green-100 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50";
    } else if (numHours >= 6.0) {
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/50";
    } else {
      return "bg-red-100 text-red-800 hover:bg-red-100 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50";
    }
  };

  const getPunches = (record: any) => {
    if (record.punch_log && Array.isArray(record.punch_log)) {
      return record.punch_log.map((punch: any) => {
        if (typeof punch === 'string') {
          const parts = punch.split(' - ');
          if (parts.length === 2) {
            return { time: parts[0], type: parts[1] };
          }
          return { time: punch, type: 'unknown' };
        } else if (punch && typeof punch === 'object') {
          const time = punch.time || punch.punch_time || punch.timestamp;
          const type = punch.type || punch.punch_type || (punch.is_in ? 'check_in' : 'check_out');
          return { time, type };
        }
        return null;
      }).filter(Boolean);
    }

    const checkinTime = record.first_in || record.checkin_time;
    const checkoutTime = record.last_out || record.checkout_time;
    const punches = [];

    if (checkinTime) {
      punches.push({
        time: checkinTime,
        type: 'check_in'
      });
    }
    if (checkoutTime) {
      punches.push({
        time: checkoutTime,
        type: 'check_out'
      });
    }
    return punches;
  };

  const formatPunchTime = (timeStr: any) => {
    if (!timeStr) return "—";
    try {
      if (typeof timeStr === 'string' && timeStr.includes(':') && !timeStr.includes('-') && !timeStr.includes('T')) {
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (!isNaN(h) && !isNaN(m)) {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 || 12;
            return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
          }
        }
      }
      const dateObj = new Date(timeStr);
      if (isNaN(dateObj.getTime())) {
        return String(timeStr);
      }
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return String(timeStr);
    }
  };

  const getCredits = (record: any) => {
    if (!record.credits) return [];
    if (Array.isArray(record.credits)) return record.credits;
    if (typeof record.credits === 'string') {
      try {
        const parsed = JSON.parse(record.credits);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
      return record.credits.split(',').map((c: string) => c.trim()).filter(Boolean);
    }
    return [];
  };

  const getBiometricStatus = (record: any) => {
    const rawStatus = record.status || "";
    const statusLower = rawStatus.toLowerCase();
    
    if (statusLower.includes("checked_in") || statusLower.includes("checked in") || statusLower.includes("check_in")) {
      return "Checked In";
    }
    if (statusLower.includes("checked_out") || statusLower.includes("checked out") || statusLower.includes("check_out")) {
      return "Checked Out";
    }
    if (statusLower.includes("absent")) {
      return "Absent";
    }
    if (statusLower.includes("present")) {
      return "Present";
    }
    
    return rawStatus.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Absent";
  };

  const getBiometricStatusBadgeStyle = (statusStr: string) => {
    switch (statusStr) {
      case "Checked In":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/40 hover:bg-green-50";
      case "Checked Out":
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-800/40 hover:bg-slate-50";
      case "Present":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40 hover:bg-emerald-50";
      case "Absent":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40 hover:bg-red-50";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-800/40 hover:bg-gray-50";
    }
  };

  const fetchAttendanceData = async (dateStr: string, force: boolean = false) => {
    setAttendanceLoading(true);
    try {
      const data = await corporateService.getAttendance(dateStr, force);
      setAttendance(data || []);
      if (data && (data as any).warning) {
        toast({
          title: "Attendance Sync Warning",
          description: (data as any).warning,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      toast({
        title: "Error",
        description: "Failed to synchronize biometric attendance records.",
        variant: "destructive"
      });
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "attendance") {
      fetchAttendanceData(attendanceDate, false);
    }
  }, [attendanceDate, activeTab]);

  const fetchDashboardData = async () => {
    setAttendanceLoading(true);
    try {
      fetchMeetingAccess();
      try {
        const { roles } = await authService.getSession();
        if (roles?.is_payment_overdue) {
          setIsPaymentOverdue(true);
          setActiveTab("invoices");
        } else {
          setIsPaymentOverdue(false);
        }
      } catch (e) {
        console.error("Error checking overdue payment in dashboard:", e);
      }
      const [statsResult, empsResult, attResult, infoResult] = await Promise.allSettled([
        corporateService.getDashboardStats(),
        corporateService.getEmployees(),
        corporateService.getAttendance(attendanceDate, false),
        corporateService.getCompanyInfo()
      ]);

      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (empsResult.status === 'fulfilled') setEmployees(empsResult.value);
      if (attResult.status === 'fulfilled') {
        const data = attResult.value;
        setAttendance(data || []);
        if (data && (data as any).warning) {
          toast({
            title: "Attendance Sync Warning",
            description: (data as any).warning,
            variant: "destructive"
          });
        }
      }
      if (infoResult.status === 'fulfilled') {
        const company = infoResult.value;
        setCompanyInfo(company);
        if (company && company.id) {
          fetchInvoices(company.id);
        }
      }
      
      fetchQueries();
      fetchCorpMeetings();
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchCorporatePlans = async () => {
    try {
      const { businessService } = await import('@/services/businessService');
      const data = await businessService.getCorporatePlans();
      setCorporatePlans(data || []);
    } catch (error) {
      console.error("Error fetching corporate plans:", error);
    }
  };

  const fetchCorpMeetings = async () => {
    try {
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.get('/meetings/');
      setCorpMeetings(res.data);
    } catch (error) {
      console.error("Error fetching corporate meetings:", error);
    }
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
    
    const numParticipants = Number(bookingForm.participants);
    if (isNaN(numParticipants) || numParticipants < 1) {
      toast({ title: "Validation Error", description: "Participants must be 1 or more", variant: "destructive" });
      return;
    }

    const availabilityErr = checkDialogOverlap(
      bookingForm.meeting_date,
      bookingForm.start_time,
      bookingForm.end_time,
      dialogAvailability
    );
    if (availabilityErr) {
      toast({ title: "Validation Error", description: availabilityErr, variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      const { apiClient } = await import('@/lib/apiClient');
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
      if (detail && detail.error_code === "MULTIPLE_ROOMS_AVAILABLE") {
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
      const { apiClient } = await import('@/lib/apiClient');
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

  const fetchQueries = async () => {
    try {
      const response = await corporateService.getDashboardStats(); // just a placeholder to use apiClient
      // Actually use apiClient directly for queries since it's not in corporateService
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.get('/queries/my');
      setQueries(res.data);
      
      const notifRes = await apiClient.get('/notifications');
      setNotifications(notifRes.data);
    } catch (error) {
      console.error("Error fetching queries:", error);
    }
  };

  const submitQuery = async () => {
    if (!newQueryMessage.trim()) return;
    setIsSubmittingQuery(true);
    try {
      const { apiClient } = await import('@/lib/apiClient');
      await apiClient.post('/queries', { message: newQueryMessage });
      setNewQueryMessage("");
      toast({ title: "Query Submitted Successfully" });
      fetchQueries();
    } catch (error) {
      toast({ title: "Failed to submit query", variant: "destructive" });
    } finally {
      setIsSubmittingQuery(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      navigate("/login");
    }
  };

  const handleToggleStatus = async (id: string, targetStatus: boolean) => {
    setLoading(true);
    try {
      await corporateService.toggleEmployeeStatus(id, targetStatus);
      toast({ title: "Status Updated" });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Update Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm("Are you sure you want to permanently delete this employee? This action cannot be undone.")) {
      return;
    }
    setLoading(true);
    try {
      await corporateService.deleteEmployee(employeeId);
      toast({ title: "Employee deleted successfully." });
      fetchDashboardData();
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "Delete Failed";
      toast({ title: "Delete Failed", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const requestBiometricAccess = async () => {
    if (!companyInfo?.id) return;
    setLoading(true);
    try {
      const { apiClient } = await import('@/lib/apiClient');
      await apiClient.post(`/companies/${companyInfo.id}/biometric-request`);
      toast({ title: "Biometric request submitted successfully." });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Failed to submit biometric request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getSeatRemainingColor = () => {
    if (!stats) return "text-foreground";
    const { max_employee_capacity, total_employees } = stats;
    const remaining = Math.max(0, max_employee_capacity - total_employees);
    if (remaining === 0) return "text-red-500";
    const percentage = remaining / max_employee_capacity;
    if (percentage <= 0.2) return "text-orange-500";
    return "text-green-500";
  };

  const openEditModal = () => {
    setEditData({
      company_name: companyInfo?.company_name || '',
      company_website: companyInfo?.company_website || '',
      company_email: companyInfo?.company_email || '',
      industry_type: companyInfo?.industry_type || '',
      admin_full_name: companyInfo?.admin_full_name || '',
      admin_mobile: companyInfo?.admin_mobile || '',
      address: companyInfo?.address || '',
      city: companyInfo?.city || '',
      state: companyInfo?.state || '',
      pincode: companyInfo?.pincode || '',
      gst_number: companyInfo?.gst_number || '',
      max_employee_capacity: companyInfo?.max_employee_capacity || 0,
      seats_requested: companyInfo?.seats_requested || 0,
      biometric_required: companyInfo?.biometric_required || false,
      company_logo_url: companyInfo?.company_logo_url || '',
    });
    setEditInfoModalOpen(true);
  };

  const saveCompanyInfo = async () => {
    if (!editData.company_name || !editData.admin_full_name || !editData.company_email) {
      toast({ title: "Required fields are missing.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await corporateService.updateCompanyInfo(editData);
      toast({ title: "Company information updated successfully." });
      setEditInfoModalOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      let errorMsg = "Update Failed";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errorMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      toast({ title: errorMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const uniqueFilename = `logo_${Date.now()}_${file.name.replace(/\s/g, "_")}`;

    try {
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.post(`/storage/company-documents/${uniqueFilename}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const uploadedPath = res.data.path; // e.g. "company-documents/logo_..."
      setEditData(prev => ({
        ...prev,
        company_logo_url: uploadedPath
      }));
      toast({ title: "Logo uploaded successfully." });
    } catch (err) {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    }
  };

  const validateField = (name: string, value: any, currentValues = enrollFormValues) => {
    switch (name) {
      case 'employee_id': {
        const valStr = value ? String(value).trim() : "";
        if (!valStr) return "Employee ID is required";
        return "";
      }
      case 'full_name': {
        const valStr = value ? String(value) : "";
        if (!valStr.trim()) return "Name is required";
        return "";
      }
      case 'gender':
        if (!value) return "Gender is required";
        return "";
      case 'date_of_birth':
        if (!value) return "Date of Birth is required";
        return "";
      case 'mobile': {
        const valStr = value ? String(value) : "";
        if (!valStr.trim()) {
          return "Mobile number is required";
        }
        return "";
      }
      case 'email': {
        const valStr = value ? String(value).trim() : "";
        if (!valStr) return "Email address is required";
        return "";
      }
      case 'emergency_contact_name': {
        return "";
      }
      case 'emergency_contact_number': {
        return "";
      }
      case 'department':
        if (!value || !value.trim()) return "Department is required";
        return "";
      case 'designation':
        if (!value || !value.trim()) return "Designation is required";
        return "";
      case 'company':
        if (!value) return "Company is required";
        return "";
      case 'joining_date':
        if (!value) return "Joining Date is required";
        return "";
      case 'duration':
        if (!value) return "Duration is required";
        return "";
      case 'govt_id_type':
        if (!value) return "ID Proof Type is required";
        return "";
      case 'govt_id_number': {
        const valStr = value ? String(value).trim() : "";
        if (!valStr) return "ID Proof Number is required";
        return "";
      }
      case 'vehicle_type':
        if (currentValues.requires_parking && !value) return "Vehicle Type is required";
        return "";
      case 'vehicle_brand_model':
        if (currentValues.requires_parking && (!value || !value.trim())) return "Vehicle Brand & Model is required";
        return "";
      case 'vehicle_color': {
        const valStr = value ? String(value) : "";
        if (currentValues.requires_parking && !valStr.trim()) {
          return "Vehicle Color is required";
        }
        return "";
      }
      case 'vehicle_registration': {
        const valStr = value ? String(value).trim() : "";
        if (currentValues.requires_parking) {
          if (!valStr) return "Vehicle registration number is required";
        }
        return "";
      }
      default:
        return "";
    }
  };

  const getFieldBorderClass = (name: string) => {
    if (!enrollFormTouched[name]) return "border-input";
    return enrollFormErrors[name] ? "border-red-500 focus-visible:ring-red-500" : "border-green-500 focus-visible:ring-green-500";
  };

  const isFormValid = () => {
    const requiredFields = [
      'employee_id',
      'full_name',
      'gender',
      'date_of_birth',
      'mobile',
      'email',
      'department',
      'designation',
      'company',
      'joining_date',
      'duration',
      'govt_id_type',
      'govt_id_number'
    ];
    
    if (enrollFormValues.requires_parking) {
      requiredFields.push('vehicle_type', 'vehicle_brand_model', 'vehicle_color', 'vehicle_registration');
    }

    for (const field of requiredFields) {
      const val = (enrollFormValues as any)[field];
      if (val === undefined || val === null || val === "" || (typeof val === 'string' && !val.trim())) {
        return false;
      }
      if (validateField(field, val, enrollFormValues) !== "") {
        return false;
      }
    }
    return true;
  };

  const openAddEmployeeModal = () => {
    const capacity = stats?.max_employee_capacity || 0;
    const currentCount = stats?.total_employees || employees.length || 0;
    if (currentCount >= capacity) {
      toast({
        title: "Seats are filled",
        description: "Enrollment exceeds available company seats. Please request a seat capacity increase.",
        variant: "destructive"
      });
      return;
    }
    setEnrollEditingEmployeeId(null);
    setEnrollFormValues({
      employee_id: "",
      full_name: "",
      gender: "",
      date_of_birth: "",
      mobile: "",
      email: "",
      emergency_contact_name: "",
      emergency_contact_number: "",
      department: "",
      designation: "",
      company: companyInfo?.company_name || "NerdShive",
      joining_date: "",
      duration: "",
      govt_id_type: "Aadhaar",
      govt_id_number: "",
      requires_parking: false,
      vehicle_type: "",
      vehicle_brand_model: "",
      vehicle_color: "",
      vehicle_registration: ""
    });
    setEnrollFormErrors({});
    setEnrollFormTouched({});
    setEnrollModalOpen(true);
  };

  const openEditEmployeeModal = (emp: any) => {
    setEnrollEditingEmployeeId(emp.id);
    setEnrollFormValues({
      employee_id: emp.employee_id || "",
      full_name: emp.full_name || "",
      gender: emp.gender || "",
      date_of_birth: emp.date_of_birth || "",
      mobile: emp.mobile || "",
      email: emp.email || "",
      emergency_contact_name: emp.emergency_contact_name || "",
      emergency_contact_number: emp.emergency_contact_number || "",
      department: emp.department || "",
      designation: emp.designation || "",
      company: emp.org_name || companyInfo?.company_name || "NerdShive",
      joining_date: emp.joining_date || "",
      duration: emp.duration || "",
      govt_id_type: emp.govt_id_type || "Aadhaar",
      govt_id_number: emp.govt_id_number || "",
      requires_parking: !!emp.requires_parking,
      vehicle_type: emp.vehicle_type || "",
      vehicle_brand_model: emp.vehicle_brand_model || "",
      vehicle_color: emp.vehicle_color || "",
      vehicle_registration: emp.vehicle_registration || ""
    });
    setEnrollFormErrors({});
    
    const touched: Record<string, boolean> = {};
    const fields = [
      'employee_id', 'full_name', 'gender', 'date_of_birth', 'mobile', 'email',
      'emergency_contact_name', 'emergency_contact_number', 'department', 'designation',
      'company', 'joining_date', 'duration', 'govt_id_type', 'govt_id_number'
    ];
    if (emp.requires_parking) {
      fields.push('vehicle_type', 'vehicle_brand_model', 'vehicle_color', 'vehicle_registration');
    }
    fields.forEach(f => {
      touched[f] = true;
    });
    setEnrollFormTouched(touched);
    setEnrollModalOpen(true);
  };

  const handleEnrollFieldChange = (name: string, value: any) => {
    let cleanValue = value;
    let isInvalidChar = false;

    if (name === "mobile" || name === "emergency_contact_number") {
      if (typeof value === "string") {
        if (/[^\d]/.test(value)) {
          isInvalidChar = true;
          cleanValue = value.replace(/[^\d]/g, "");
        }
      }
    }

    const updatedValues = {
      ...enrollFormValues,
      [name]: cleanValue
    };

    if (name === "requires_parking" && !cleanValue) {
      updatedValues.vehicle_type = "";
      updatedValues.vehicle_brand_model = "";
      updatedValues.vehicle_color = "";
      updatedValues.vehicle_registration = "";
    }

    setEnrollFormValues(updatedValues);

    // If they typed an invalid character in a numeric field, show "Only numbers are allowed." immediately
    if (isInvalidChar) {
      setEnrollFormErrors(prev => ({
        ...prev,
        [name]: "Only numbers are allowed."
      }));
      setEnrollFormTouched(prev => ({
        ...prev,
        [name]: true
      }));
    } else {
      // Clear the "Only numbers are allowed." error once they type valid digits
      if (enrollFormErrors[name] === "Only numbers are allowed.") {
        setEnrollFormErrors(prev => ({
          ...prev,
          [name]: ""
        }));
      }
    }
  };

  const handleEnrollFieldBlur = (name: string) => {
    const value = (enrollFormValues as any)[name];
    setEnrollFormTouched(prev => ({
      ...prev,
      [name]: true
    }));

    const error = validateField(name, value, enrollFormValues);
    setEnrollFormErrors(prev => ({
      ...prev,
      [name]: error
    }));

    if (name === "date_of_birth" && enrollFormValues.joining_date) {
      const jdErr = validateField("joining_date", enrollFormValues.joining_date, enrollFormValues);
      setEnrollFormErrors(prev => ({ ...prev, joining_date: jdErr }));
    }
    if (name === "govt_id_type" && enrollFormValues.govt_id_number) {
      const gidErr = validateField("govt_id_number", enrollFormValues.govt_id_number, enrollFormValues);
      setEnrollFormErrors(prev => ({ ...prev, govt_id_number: gidErr }));
    }
    if (name === "requires_parking") {
      const fields = ["vehicle_type", "vehicle_brand_model", "vehicle_color", "vehicle_registration"];
      const newErrors = { ...enrollFormErrors };
      fields.forEach(f => {
        newErrors[f] = enrollFormValues.requires_parking ? validateField(f, (enrollFormValues as any)[f], enrollFormValues) : "";
      });
      setEnrollFormErrors(newErrors);
    }
  };

  const handleEnrollFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate ALL fields and touch them on submit!
    const fields = [
      'employee_id', 'full_name', 'gender', 'date_of_birth', 'mobile', 'email',
      'department', 'designation', 'company', 'joining_date', 'duration', 'govt_id_type', 'govt_id_number'
    ];
    if (enrollFormValues.requires_parking) {
      fields.push('vehicle_type', 'vehicle_brand_model', 'vehicle_color', 'vehicle_registration');
    }

    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    let hasError = false;

    fields.forEach(f => {
      touched[f] = true;
      const err = validateField(f, (enrollFormValues as any)[f], enrollFormValues);
      errors[f] = err;
      if (err) {
        hasError = true;
      }
    });

    setEnrollFormTouched(touched);
    setEnrollFormErrors(errors);

    if (hasError) {
      toast({
        title: "Validation Error",
        description: "Please check the highlighted fields for errors.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (enrollEditingEmployeeId) {
        await corporateService.updateEmployee(enrollEditingEmployeeId, enrollFormValues);
        toast({ title: "Employee enrolled successfully." });
      } else {
        await corporateService.addEmployee(enrollFormValues);
        toast({ title: "Employee enrolled successfully." });
      }
      setEnrollModalOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      let errMsg = "Enrollment Failed";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
        const fieldErrors: Record<string, string> = {};
        responseErrors.forEach((e: any) => {
          if (e.field) {
            fieldErrors[e.field] = e.message;
          }
        });
        setEnrollFormErrors(fieldErrors);
      } else if (error.response?.data?.detail) {
        errMsg = error.response.data.detail;
      }
      toast({ title: "Submission Failed", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openRequestSeatsModal = () => {
    setRequestedSeatsInput(0);
    setRequestSeatsModalOpen(true);
  };

  const submitSeatsRequest = async () => {
    const currentCapacity = companyInfo?.max_employee_capacity || 0;

    let targetSeats = 0;
    if (seatsActionType === "increase") {
      targetSeats = currentCapacity + requestedSeatsInput;
    } else {
      targetSeats = currentCapacity - requestedSeatsInput;
    }

    setLoading(true);
    try {
      await corporateService.updateCompanyInfo({
        ...companyInfo,
        seats_requested: targetSeats
      });
      toast({ title: "Seat allocation change request submitted successfully." });
      setRequestSeatsModalOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      let errMsg = "Request Failed";
      const responseErrors = error.response?.data?.errors;
      if (responseErrors && Array.isArray(responseErrors)) {
        errMsg = responseErrors.map((e: any) => `${e.field ? e.field + ": " : ""}${e.message}`).join(", ");
      } else if (error.response?.data?.detail) {
        errMsg = error.response.data.detail;
      }
      toast({ title: "Request Failed", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };  const handleSelectPlan = async (planId: string) => {
    setLoading(true);
    try {
      await corporateService.updateCompanyInfo({
        ...companyInfo,
        selected_plan_id: planId
      });
      toast({ title: "Plan selected successfully." });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Plan Selection Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isInactive = companyInfo?.subscription_status === "PAYMENT_PENDING" || companyInfo?.subscription_status === "SUSPENDED";

  const getNextBillingDate = () => {
    if (!companyInfo || !companyInfo.selected_plan_id) return "-";
    const start = new Date(companyInfo.plan_selected_at || companyInfo.created_at);
    const today = new Date();
    
    const plan = corporatePlans.find(p => p.id === companyInfo.selected_plan_id);
    if (!plan) return "-";
    
    const bType = plan.billing_type.toLowerCase();
    let days = 30;
    if (bType === "day") days = 1;
    else if (bType === "week") days = 7;
    
    let curr = new Date(start);
    while (curr <= today) {
      curr.setDate(curr.getDate() + days);
    }
    return curr.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getSeatLogs = () => {
    return notifications
      .filter((n: any) => 
        n.title === "Seat Request Submitted" || 
        n.title.includes("Seats Allocation Approved") || 
        n.title.includes("Seats Allocation Rejected")
      )
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return `Today ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const seatLogs = getSeatLogs();
  const latestLog = seatLogs[0];

  // Dynamic filter lists
  const departmentsList = Array.from(new Set(
    attendance.map(a => a.department).filter(Boolean)
  )) as string[];

  // Filter attendance logs
  const filteredAttendance = attendance.filter(record => {
    const name = record.employee_name || record.name || "";
    const code = record.employee_code || record.employee_id || "";
    const dept = record.department || "";
    
    const matchesSearch = name.toLowerCase().includes(attendanceSearchQuery.toLowerCase()) ||
                          code.toLowerCase().includes(attendanceSearchQuery.toLowerCase());
    const matchesDept = attendanceSelectedDept === "all" || dept.toLowerCase() === attendanceSelectedDept.toLowerCase();
    
    return matchesSearch && matchesDept;
  });

  // Paginated attendance logs
  const totalPages = Math.ceil(filteredAttendance.length / attendanceItemsPerPage);
  const paginatedAttendance = filteredAttendance.slice(
    (attendanceCurrentPage - 1) * attendanceItemsPerPage,
    attendanceCurrentPage * attendanceItemsPerPage
  );

  const renderInput = (
    name: string,
    label: string,
    placeholder: string,
    type = "text",
    disabled = false
  ) => {
    const value = (enrollFormValues as any)[name];
    const error = enrollFormErrors[name];
    const borderClass = getFieldBorderClass(name);
    
    return (
      <div className="space-y-1">
        <Label htmlFor={name} className="text-xs font-semibold">{label}</Label>
        <Input
          id={name}
          type={type}
          value={value}
          onChange={(e) => handleEnrollFieldChange(name, e.target.value)}
          onBlur={() => handleEnrollFieldBlur(name)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${borderClass} placeholder:text-muted-foreground/60`}
        />
        {enrollFormTouched[name] && error && (
          <p className="text-[11px] text-red-500 font-medium">{error}</p>
        )}
      </div>
    );
  };

  const renderSelect = (
    name: string,
    label: string,
    options: { value: string; label: string }[],
    disabled = false,
    showPlaceholder = true
  ) => {
    const value = (enrollFormValues as any)[name];
    const error = enrollFormErrors[name];
    const borderClass = getFieldBorderClass(name);
    const isPlaceholderSelected = value === "";
    
    return (
      <div className="space-y-1">
        <Label htmlFor={name} className="text-xs font-semibold">{label}</Label>
        <select
          id={name}
          value={value}
          onChange={(e) => handleEnrollFieldChange(name, e.target.value)}
          onBlur={() => handleEnrollFieldBlur(name)}
          disabled={disabled}
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${isPlaceholderSelected ? 'text-muted-foreground/60' : 'text-foreground'} ${borderClass}`}
        >
          {showPlaceholder && <option value="" disabled hidden>Select {label}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="text-foreground">{opt.label}</option>
          ))}
        </select>
        {enrollFormTouched[name] && error && (
          <p className="text-[11px] text-red-500 font-medium">{error}</p>
        )}
      </div>
    );
  };

  const renderParkingRadio = () => {
    const value = enrollFormValues.requires_parking;
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Parking Required</Label>
        <div className="flex items-center space-x-6 h-10">
          <label className="flex items-center space-x-2 text-sm cursor-pointer select-none">
            <input
              type="radio"
              name="requires_parking"
              checked={value === true}
              onChange={() => handleEnrollFieldChange("requires_parking", true)}
              className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
            />
            <span className="font-medium text-foreground">Yes</span>
          </label>
          <label className="flex items-center space-x-2 text-sm cursor-pointer select-none">
            <input
              type="radio"
              name="requires_parking"
              checked={value === false}
              onChange={() => handleEnrollFieldChange("requires_parking", false)}
              className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
            />
            <span className="font-medium text-foreground">No</span>
          </label>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard requiredRole="company_admin" requireApproval={true}>
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
        {/* Header */}
        <header className="bg-card shadow-card border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                {/* Nerdshive Logo */}
                <div className="flex items-center">
                  <img 
                    src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" 
                    alt="Nerdshive" 
                    className="h-16 w-auto object-contain" 
                  />
                </div>
                
                {/* Separator */}
                <div className="h-6 w-px bg-border" />

                {/* Company Logo */}
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shadow-card overflow-hidden border">
                  {companyInfo?.company_logo_url ? (
                    <img 
                      src={`/api/v1/storage/raw/${companyInfo.company_logo_url}`} 
                      alt="Company Logo" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Building className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {companyInfo?.company_name || "Corporate Dashboard"}
                  </h1>
                  <p className="text-sm text-muted-foreground">Manage your organization's workspace</p>
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
                <Button onClick={handleLogout} variant="outline" size="sm" className="text-muted-foreground hover:text-foreground">
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
                  Your organization has one or more unpaid invoices past their due dates. Seat modifications, employee enrollments, and workspace services have been temporarily suspended. Please make payment immediately to restore active services.
                </p>
              </div>
            </div>
          )}

          <Tabs 
            value={activeTab} 
            onValueChange={(val) => {
              if (isPaymentOverdue && val !== "invoices") return;
              const isPremiumTab = ["employees", "attendance", "meetings"].includes(val);
              if (isPremiumTab && isInactive) {
                setLockedTabAttempt(val);
                setSubscriptionLockModalOpen(true);
              } else {
                setActiveTab(val);
              }
            }} 
            className="space-y-6"
          >
            <TabsList className={`grid w-full grid-cols-3 h-auto p-1 bg-muted/50 gap-1 ${
              hasMeetingAccess ? "md:grid-cols-8" : "md:grid-cols-7"
            }`}>
              <TabsTrigger value="overview" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background"><Activity className="w-4 h-4 mr-2 hidden md:block" />Overview</TabsTrigger>
              <TabsTrigger value="employees" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background">
                <Users className="w-4 h-4 mr-2 hidden md:block" />
                Employees {isInactive && "🔒"}
              </TabsTrigger>
              <TabsTrigger value="attendance" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background">
                <Clock className="w-4 h-4 mr-2 hidden md:block" />
                Attendance {isInactive && "🔒"}
              </TabsTrigger>
              <TabsTrigger value="plans" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background"><CreditCard className="w-4 h-4 mr-2" />Plans</TabsTrigger>
              <TabsTrigger value="invoices" className="py-2.5 px-3 data-[state=active]:bg-background"><FileText className="w-4 h-4 mr-2" />Invoices</TabsTrigger>
              <TabsTrigger value="queries" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background"><MessageSquare className="w-4 h-4 mr-2" />Queries</TabsTrigger>
              {hasMeetingAccess && (
                <TabsTrigger value="meetings" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background">
                  <Calendar className="w-4 h-4 mr-2" />
                  Meetings {isInactive && "🔒"}
                </TabsTrigger>
              )}
              <TabsTrigger value="company-info" disabled={isPaymentOverdue} className="py-2.5 px-3 data-[state=active]:bg-background"><Building className="w-4 h-4 mr-2" />Company Info</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.total_employees || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.active_employees || 0} active
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Checked In Today</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.checked_in_today || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Employees currently in workspace
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Seats Available</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.seats_available || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Out of {stats?.max_employee_capacity || 0} current seats
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employees">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Seat Usage Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center divide-x">
                    <div>
                      <p className="text-sm text-muted-foreground">Seat Capacity</p>
                      <p className="text-2xl font-bold">{stats?.max_employee_capacity || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Employees Added</p>
                      <p className="text-2xl font-bold">{stats?.total_employees || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Seats Remaining</p>
                      <p className={`text-2xl font-bold ${getSeatRemainingColor()}`}>
                        {stats ? Math.max(0, stats.max_employee_capacity - stats.total_employees) : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Employee Directory</CardTitle>
                    <CardDescription>Manage your organization's employees and their access</CardDescription>
                  </div>
                  <div>
                    <Button onClick={openAddEmployeeModal} className="flex items-center gap-1.5 font-semibold">
                      <Plus className="w-4 h-4" />
                      Add Employee
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">S.No</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Mobile Number</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp, index) => (
                        <TableRow 
                          key={emp.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-semibold">{emp.employee_id || '-'}</TableCell>
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell>{emp.department || '-'}</TableCell>
                          <TableCell>{emp.designation || '-'}</TableCell>
                          <TableCell>{emp.mobile || '-'}</TableCell>
                          <TableCell className="lowercase">{emp.email}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1 bg-muted/40 p-0.5 rounded-lg border w-fit">
                              <Button
                                size="sm"
                                variant={emp.is_active ? "default" : "ghost"}
                                className={`h-7 px-2.5 text-xs transition-all duration-150 ${emp.is_active ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                onClick={() => !emp.is_active && handleToggleStatus(emp.id, true)}
                                disabled={loading}
                              >
                                Active
                              </Button>
                              <Button
                                size="sm"
                                variant={!emp.is_active ? "default" : "ghost"}
                                className={`h-7 px-2.5 text-xs transition-all duration-150 ${!emp.is_active ? "bg-destructive text-destructive-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                onClick={() => emp.is_active && handleToggleStatus(emp.id, false)}
                                disabled={loading}
                              >
                                Inactive
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 px-2.5 text-xs"
                                onClick={() => setSelectedEmployeeDetails(emp)}
                              >
                                View
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 px-2.5 text-xs border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                                onClick={() => openEditEmployeeModal(emp)}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="h-8 px-2.5 text-xs"
                                onClick={() => handleDeleteEmployee(emp.id)}
                                disabled={loading}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>



            <TabsContent value="attendance">
              <Card className="shadow-sm border-muted">
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl font-bold">
                        Attendance Detail — {getSelectedDateString()}
                      </CardTitle>
                      {companyInfo?.biometric_status === "APPROVED" || companyInfo?.biometric_required ? (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-full font-medium hover:bg-blue-100">
                          {filteredAttendance.length} {filteredAttendance.length === 1 ? 'Employee' : 'Employees'}
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      Recent check-in activity for your employees
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {companyInfo?.biometric_status === "APPROVED" || companyInfo?.biometric_required ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-1 text-xs">
                        Biometric Access Approved
                      </Badge>
                    ) : companyInfo?.biometric_status === "PENDING" || companyInfo?.biometric_requested ? (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-3 py-1 text-xs">
                        Biometric Request Pending
                      </Badge>
                    ) : companyInfo?.biometric_status === "REJECTED" ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-500 hover:bg-red-600 text-white font-medium px-3 py-1 text-xs">
                          Request Rejected
                        </Badge>
                        <Button onClick={requestBiometricAccess} disabled={loading} size="sm">
                          Request Biometric Access
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={requestBiometricAccess} disabled={loading} size="sm">
                        Request Biometric Access
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {companyInfo?.biometric_status === "APPROVED" || companyInfo?.biometric_required ? (
                    <>
                      {/* Search and Filters */}
                      <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by employee name or code..."
                            value={attendanceSearchQuery}
                            onChange={(e) => {
                              setAttendanceSearchQuery(e.target.value);
                              setAttendanceCurrentPage(1);
                            }}
                            className="pl-9"
                          />
                        </div>
                        <div className="w-full sm:w-[200px]">
                          <Select
                            value={attendanceSelectedDept}
                            onValueChange={(val) => {
                              setAttendanceSelectedDept(val);
                              setAttendanceCurrentPage(1);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Departments</SelectItem>
                              {departmentsList.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={attendanceDate}
                            onChange={(e) => {
                              setAttendanceDate(e.target.value);
                              setAttendanceCurrentPage(1);
                            }}
                            className="w-full sm:w-[160px]"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fetchAttendanceData(attendanceDate, true)}
                            disabled={attendanceLoading}
                            title="Force Refresh Biometric Data"
                          >
                            <RefreshCw className={`h-4 w-4 ${attendanceLoading ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </div>

                      {attendanceLoading ? (
                        /* Skeleton Loader State */
                        <div className="space-y-4">
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                  <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {[...Array(5)].map((_, i) => (
                                  <TableRow key={i}>
                                    <TableCell>
                                      <Skeleton className="h-4 w-28 mb-1" />
                                      <Skeleton className="h-3 w-16" />
                                    </TableCell>
                                    <TableCell>
                                      <Skeleton className="h-4 w-24 mb-1" />
                                      <Skeleton className="h-3 w-20" />
                                    </TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : filteredAttendance.length === 0 ? (
                        /* Empty State */
                        <div className="text-center py-16 bg-muted/10 rounded-lg border border-dashed flex flex-col items-center justify-center space-y-4">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <Users className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">No attendance records available</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                              No logs match your search filters, or no employees have checked in yet today.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Desktop & Tablet Table */}
                          <div className="hidden md:block border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Employee</TableHead>
                                  <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Team</TableHead>
                                  <TableHead className="py-3 font-semibold text-xs text-muted-foreground">First Check-In</TableHead>
                                  <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Last Check-Out</TableHead>
                                  <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Day In-Time</TableHead>
                                  <TableHead className="py-3 font-semibold text-xs text-muted-foreground">All Punches</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paginatedAttendance.map(record => {
                                  const punches = getPunches(record);
                                  const creditsList = getCredits(record);
                                  const firstInStr = record.first_in || record.checkin_time;
                                  const lastOutStr = record.last_out || record.checkout_time;
                                  const workingHoursStr = record.total_hours !== undefined ? record.total_hours : record.working_hours;
                                  const empName = record.name || record.employee_name || '—';
                                  const empCode = record.employee_code || record.employee_id || '—';
                                  
                                  return (
                                    <TableRow key={record.id} className="hover:bg-muted/20 transition-colors">
                                      {/* Employee Column */}
                                      <TableCell className="py-3">
                                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                          {empName}
                                          <Badge className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getBiometricStatusBadgeStyle(getBiometricStatus(record))}`}>
                                            {getBiometricStatus(record)}
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{empCode}</div>
                                      </TableCell>
                                      
                                      {/* Team Column */}
                                      <TableCell className="py-3">
                                        <div className="text-sm text-foreground">{record.department || '—'}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                          {record.designation || (record.department && record.department.trim().toUpperCase().endsWith('INT') ? 'Intern' : '—')}
                                        </div>
                                      </TableCell>
                                      
                                      {/* First Check-In */}
                                      <TableCell className="py-3 font-medium text-sm text-green-600 dark:text-green-400">
                                        {firstInStr ? formatPunchTime(firstInStr) : '—'}
                                      </TableCell>
                                      
                                      {/* Last Check-Out */}
                                      <TableCell className="py-3 font-medium text-sm text-red-600 dark:text-red-400">
                                        {lastOutStr ? formatPunchTime(lastOutStr) : '—'}
                                      </TableCell>
                                      
                                      {/* Day In-Time */}
                                      <TableCell className="py-3">
                                        {workingHoursStr !== null && workingHoursStr !== undefined ? (
                                          <Badge className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getDayInTimeBadgeColor(workingHoursStr)}`}>
                                            {formatWorkingHours(workingHoursStr)}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                      </TableCell>
                                      
                                      {/* All Punches & Credits */}
                                      <TableCell className="py-3 max-w-[300px]">
                                        <div className="flex flex-wrap gap-1.5">
                                          {punches.map((punch, idx) => {
                                            const isCheckIn = punch.type === 'check_in';
                                            const isCheckOut = punch.type === 'check_out';
                                            const bgClass = isCheckIn 
                                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/40' 
                                              : isCheckOut 
                                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40' 
                                                : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/40';
                                            const dotClass = isCheckIn ? 'bg-green-500' : isCheckOut ? 'bg-red-500' : 'bg-gray-400';
                                            
                                            return (
                                              <span 
                                                key={idx} 
                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${bgClass}`}
                                              >
                                                <span className={`w-1 h-1 rounded-full ${dotClass}`} />
                                                {formatPunchTime(punch.time)} • {isCheckIn ? 'Check In' : isCheckOut ? 'Check Out' : 'Punch'}
                                              </span>
                                            );
                                          })}
                                          
                                          {creditsList.map((credit, idx) => {
                                            const label = typeof credit === 'string' ? credit : credit.label || credit.name || 'Permission';
                                            return (
                                              <span 
                                                key={`credit-${idx}`} 
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800/40"
                                              >
                                                <span className="w-1 h-1 rounded-full bg-purple-500" />
                                                {label}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="block md:hidden space-y-4">
                            {paginatedAttendance.map(record => {
                              const punches = getPunches(record);
                              const creditsList = getCredits(record);
                              const firstInStr = record.first_in || record.checkin_time;
                              const lastOutStr = record.last_out || record.checkout_time;
                              const workingHoursStr = record.total_hours !== undefined ? record.total_hours : record.working_hours;
                              const empName = record.name || record.employee_name || '—';
                              const empCode = record.employee_code || record.employee_id || '—';
                              
                              return (
                                <div key={record.id} className="bg-card border rounded-lg p-4 shadow-sm space-y-3">
                                  {/* Card Header (Employee details & working hours) */}
                                  <div className="flex justify-between items-start gap-2 border-b pb-2.5">
                                    <div>
                                      <div className="font-bold text-sm text-foreground flex items-center gap-2">
                                        {empName}
                                        <Badge className={`px-2 py-0.5 text-[9px] font-semibold rounded-full border ${getBiometricStatusBadgeStyle(getBiometricStatus(record))}`}>
                                          {getBiometricStatus(record)}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">Code: {empCode}</div>
                                    </div>
                                    {workingHoursStr !== null && workingHoursStr !== undefined ? (
                                      <Badge className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getDayInTimeBadgeColor(workingHoursStr)}`}>
                                        {formatWorkingHours(workingHoursStr)}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </div>

                                  {/* Team & Role */}
                                  <div className="flex flex-col gap-0.5">
                                    <div className="text-xs font-semibold text-muted-foreground">Team</div>
                                    <div className="text-sm text-foreground">
                                      {record.department || '—'} 
                                      {record.designation && <span className="text-muted-foreground text-xs font-normal"> • {record.designation}</span>}
                                    </div>
                                  </div>

                                  {/* Check Ins / Outs */}
                                  <div className="grid grid-cols-2 gap-4 bg-muted/20 p-2.5 rounded-md border border-muted">
                                    <div>
                                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">First Check-In</div>
                                      <div className="text-xs font-bold text-green-600 dark:text-green-400">
                                        {firstInStr ? formatPunchTime(firstInStr) : '—'}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Last Check-Out</div>
                                      <div className="text-xs font-bold text-red-600 dark:text-red-400">
                                        {lastOutStr ? formatPunchTime(lastOutStr) : '—'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* All Punches and Credits Timeline */}
                                  <div className="space-y-1.5 pt-1">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Punch Timeline & Approvals</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {punches.map((punch, idx) => {
                                        const isCheckIn = punch.type === 'check_in';
                                        const isCheckOut = punch.type === 'check_out';
                                        const bgClass = isCheckIn 
                                          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/40' 
                                          : isCheckOut 
                                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40' 
                                            : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/40';
                                        const dotClass = isCheckIn ? 'bg-green-500' : isCheckOut ? 'bg-red-500' : 'bg-gray-400';
                                        
                                        return (
                                          <span 
                                            key={idx} 
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${bgClass}`}
                                          >
                                            <span className={`w-1 h-1 rounded-full ${dotClass}`} />
                                            {formatPunchTime(punch.time)} • {isCheckIn ? 'Check In' : isCheckOut ? 'Check Out' : 'Punch'}
                                          </span>
                                        );
                                      })}
                                      
                                      {creditsList.map((credit, idx) => {
                                        const label = typeof credit === 'string' ? credit : credit.label || credit.name || 'Permission';
                                        return (
                                          <span 
                                            key={`credit-${idx}`} 
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800/40"
                                          >
                                            <span className="w-1 h-1 rounded-full bg-purple-500" />
                                            {label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination Controls */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-muted pt-4 mt-6">
                              <div className="text-xs text-muted-foreground">
                                Showing Page {attendanceCurrentPage} of {totalPages} ({filteredAttendance.length} total records)
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setAttendanceCurrentPage(prev => Math.max(1, prev - 1))}
                                  disabled={attendanceCurrentPage === 1}
                                  className="h-8 text-xs"
                                >
                                  Previous
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setAttendanceCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                  disabled={attendanceCurrentPage === totalPages}
                                  className="h-8 text-xs"
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    /* Biometric Required Block */
                    <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Shield className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground">Biometric Access Required</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {companyInfo?.biometric_status === "PENDING" || companyInfo?.biometric_requested ? (
                          "Biometric access request is pending administrator approval. Check-in logs will be available once approved."
                        ) : companyInfo?.biometric_status === "REJECTED" ? (
                          "Your request for biometric access was rejected. Please contact support or request access again."
                        ) : companyInfo?.biometric_status === "DISABLED" ? (
                          "Biometric attendance has been disabled for your organization. Please request access to enable check-ins."
                        ) : (
                          "Biometric attendance is not enabled. Please request access to track employee check-ins."
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="plans" className="space-y-6">




                {corporatePlans.length > 0 && (
                  <div className="space-y-4">
                    {companyInfo?.selected_plan_id && (
                      <Card className="shadow-card border border-primary/20 bg-primary/5 mb-6">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-lg font-bold">Current Subscription Overview</CardTitle>
                            <CardDescription>Quick summary of your active workspace subscription</CardDescription>
                          </div>
                           {companyInfo?.allow_future_seat_requests ? (
                             <div className="flex gap-2">
                               <Button 
                                 onClick={openRequestIncreaseSeatsModal} 
                                 disabled={!!companyInfo?.active_seat_request}
                                 size="sm" 
                                 className="flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                               >
                                 <Plus className="w-3.5 h-3.5" /> Increase Seats
                               </Button>
                               <Button 
                                 onClick={openRequestReduceSeatsModal} 
                                 disabled={!!companyInfo?.active_seat_request}
                                 size="sm" 
                                 variant="outline" 
                                 className="flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                               >
                                 <Plus className="w-3.5 h-3.5 rotate-45" /> Reduce Seats
                               </Button>
                             </div>
                           ) : (
                            companyInfo?.seat_allocation_permission_requested ? (
                              <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold">
                                Seat Permission Requested
                              </Badge>
                            ) : (
                              <Button onClick={requestSeatPermission} disabled={loading} size="sm" className="flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150">
                                Request Seat Allocation Access
                              </Button>
                            )
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground block text-xs">Current Plan</span>
                              <span className="font-semibold text-base">{corporatePlans.find(p => p.id === companyInfo.selected_plan_id)?.plan_name || "Custom Plan"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Billing Cycle</span>
                              <span className="font-semibold text-base capitalize">
                                {(() => {
                                  const cycle = corporatePlans.find(p => p.id === companyInfo.selected_plan_id)?.billing_type;
                                  return cycle === "seat" ? "month" : (cycle || "Monthly");
                                })()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Subscription Status</span>
                              <span className="font-semibold text-base flex items-center gap-1.5 mt-0.5">
                                {companyInfo.subscription_status === "ACTIVE" && <><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>Active</>}
                                {companyInfo.subscription_status === "PAYMENT_PENDING" && <><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>Payment Pending</>}
                                {companyInfo.subscription_status === "SUSPENDED" && <><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block"></span>Suspended</>}
                              </span>
                            </div>
                            <div>
                              {companyInfo?.active_seat_request && (() => {
                                const change = companyInfo.active_seat_request.requested_seats - companyInfo.active_seat_request.current_seats;
                                const changeText = change > 0 ? `+${change}` : `${change}`;
                                return (
                                  <div>
                                    <span className="text-muted-foreground block text-xs">Seats Requested</span>
                                    <Badge variant="secondary" className="mt-1.5 bg-amber-100 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold border-amber-200">
                                      {changeText}
                                    </Badge>
                                  </div>
                                );
                              })()}
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Remaining Seat Capacity</span>
                              <span className="font-semibold text-base text-green-600 dark:text-green-400">{Math.max(0, (companyInfo.max_employee_capacity || 0) - (stats?.total_employees || 0))} seats</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Meeting Room Access</span>
                              <span className="font-semibold text-base flex items-center gap-1">
                                {hasMeetingAccess ? (
                                  <span className="text-green-600 dark:text-green-400">Enabled</span>
                                ) : (
                                  <span className="text-muted-foreground">Disabled</span>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Renewal Date</span>
                              <span className="font-semibold text-base">{getNextBillingDate()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Seats (Allocated / Max)</span>
                              <span className="font-semibold text-base">{(stats?.total_employees || 0)} / {companyInfo.max_employee_capacity || 0}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}


                    <h3 className="text-lg font-bold text-foreground">Available Corporate Workspace Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                      {corporatePlans.map((plan) => (
                        <Card key={plan.id} className={`shadow-card border flex flex-col transition-all duration-200 ${
                          companyInfo?.selected_plan_id === plan.id 
                            ? "border-green-500 ring-1 ring-green-500 bg-green-500/5" 
                            : "hover:border-muted-foreground/30"
                        }`}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-xl font-bold">{plan.plan_name}</CardTitle>
                                <CardDescription>Premium corporate workspace package</CardDescription>
                              </div>
                              {companyInfo?.selected_plan_id === plan.id && (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Active
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 flex flex-col space-y-4">
                            <div className="text-3xl font-bold text-primary">
                              ₹{Number(plan.price).toLocaleString()}
                              <span className="text-sm font-normal text-muted-foreground"> / {plan.billing_type === "seat" ? "month" : plan.billing_type}</span>
                            </div>
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Features Included:</p>
                              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                                {Array.isArray(plan.features_json) 
                                  ? plan.features_json.map((f: string, i: number) => <li key={i}>{f}</li>)
                                  : typeof plan.features_json === "string"
                                    ? JSON.parse(plan.features_json).map((f: string, i: number) => <li key={i}>{f}</li>)
                                    : null
                                }
                              </ul>
                            </div>
                          </CardContent>
                          <CardFooter className="pt-4 border-t">
                            {companyInfo?.selected_plan_id === plan.id ? (
                              <Button disabled className="w-full bg-green-500/10 text-green-600 border border-green-500/20 font-semibold flex items-center justify-center gap-2 cursor-default disabled:opacity-100">
                                <Check className="w-4 h-4 text-green-600" /> Current Plan
                              </Button>
                            ) : (
                              <Button onClick={() => handleSelectPlan(plan.id)} disabled={loading} className="w-full hover:scale-[1.01] active:scale-[0.99] transition-all duration-150">
                                Select Plan
                              </Button>
                            )}
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
            </TabsContent>
            
            <TabsContent value="queries" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Company Queries</CardTitle>
                      <CardDescription>Submit queries to the Nerdshive administration team</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="flex flex-col space-y-2">
                          <Label>New Query</Label>
                          <div className="flex space-x-2">
                            <Input 
                              value={newQueryMessage} 
                              onChange={(e) => setNewQueryMessage(e.target.value)} 
                              placeholder="Type your question or issue here..." 
                              className="flex-1"
                            />
                            <Button onClick={submitQuery} disabled={isSubmittingQuery}>
                              {isSubmittingQuery ? "Submitting..." : "Submit Query"}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h3 className="font-semibold text-lg border-b pb-2 mb-4">Query History</h3>
                            {queries.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No queries found.</p>
                              </div>
                            ) : (
                              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                                {queries.map((q: any) => (
                                  <Card key={q.id} className="bg-muted/30">
                                    <CardContent className="p-4">
                                      <div className="flex justify-between items-start mb-2">
                                        <p className="font-medium">{q.message}</p>
                                        <Badge variant={q.status === 'resolved' ? 'default' : 'secondary'}>
                                          {q.status}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mb-3">Submitted on {new Date(q.created_at).toLocaleString()}</p>
                                      
                                      {q.response && (
                                        <div className="bg-card p-3 rounded border">
                                          <p className="text-sm font-semibold mb-1">Response:</p>
                                          <p className="text-sm">{q.response}</p>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <h3 className="font-semibold text-lg border-b pb-2 mb-4">Notifications</h3>
                            {notifications.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No new notifications.</p>
                              </div>
                            ) : (
                              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                                {notifications.map((n: any) => (
                                  <Card key={n.id} className={n.is_read ? "bg-muted/30" : "bg-card border-primary/50"}>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between items-start mb-1">
                                        <p className="font-semibold text-sm">{n.title}</p>
                                        {!n.is_read && <Badge variant="default" className="text-[10px] h-4">New</Badge>}
                                      </div>
                                      <p className="text-sm mb-2">{n.message}</p>
                                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
            </TabsContent>

            <TabsContent value="meetings" className="space-y-6">
                  <div className="bg-card p-4 rounded-xl border">
                    <h2 className="text-lg font-bold">Workspace Meetings</h2>
                    <p className="text-sm text-muted-foreground">Select a date on the calendar, click any green hourly available slot on the schedule, and request a booking.</p>
                  </div>

                  {/* Workspace Meeting Availability Calendar (Left) and Details/Lists (Right) */}                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
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
            
            <TabsContent value="company-info">
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                   <div>
                     <CardTitle>Company Information</CardTitle>
                     <CardDescription>View and manage your organization profile</CardDescription>
                   </div>
                   <Button variant="outline" onClick={openEditModal}><Edit2 className="w-4 h-4 mr-2" /> Edit Company Info</Button>
                 </CardHeader>
                 <CardContent className="space-y-6">
                   {companyInfo ? (
                     <>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                         <h3 className="font-semibold text-lg border-b pb-2 mb-4">Company Details</h3>
                         <div className="space-y-3">
                           <div><span className="text-muted-foreground text-sm">Company Name:</span> <p className="font-medium">{companyInfo.company_name}</p></div>
                           <div><span className="text-muted-foreground text-sm">Website:</span> <p className="font-medium">{companyInfo.company_website || '-'}</p></div>
                           <div><span className="text-muted-foreground text-sm">Company Email:</span> <p className="font-medium">{companyInfo.company_email}</p></div>
                           <div><span className="text-muted-foreground text-sm">Industry:</span> <p className="font-medium">{companyInfo.industry_type || '-'}</p></div>
                           <div><span className="text-muted-foreground text-sm">GST Number:</span> <p className="font-medium">{companyInfo.gst_number || '-'}</p></div>
                         </div>
                       </div>
                       
                       <div>
                         <h3 className="font-semibold text-lg border-b pb-2 mb-4">Primary Contact</h3>
                         <div className="space-y-3">
                           <div><span className="text-muted-foreground text-sm">Name:</span> <p className="font-medium">{companyInfo.admin_full_name}</p></div>
                           <div><span className="text-muted-foreground text-sm">Email:</span> <p className="font-medium">{companyInfo.company_email}</p></div>
                           <div><span className="text-muted-foreground text-sm">Mobile:</span> <p className="font-medium">{companyInfo.admin_mobile}</p></div>
                         </div>
                       </div>
                       
                       <div>
                         <h3 className="font-semibold text-lg border-b pb-2 mb-4">Address</h3>
                         <div className="space-y-3">
                           <div><span className="text-muted-foreground text-sm">Address:</span> <p className="font-medium">{companyInfo.address || '-'}</p></div>
                           <div><span className="text-muted-foreground text-sm">City:</span> <p className="font-medium">{companyInfo.city || '-'}</p></div>
                           <div><span className="text-muted-foreground text-sm">State:</span> <p className="font-medium">{companyInfo.state || '-'}</p></div>
                           <div><span className="text-muted-foreground text-sm">Pincode:</span> <p className="font-medium">{companyInfo.pincode || '-'}</p></div>
                         </div>
                       </div>
                       
                       <div>
                         <h3 className="font-semibold text-lg border-b pb-2 mb-4">Capacity & Status</h3>
                         <div className="space-y-3">
                           <div><span className="text-muted-foreground text-sm">Current Seats:</span> <p className="font-medium">{companyInfo.max_employee_capacity || 0}</p></div>
                           <div><span className="text-muted-foreground text-sm">Employees Registered:</span> <p className="font-medium">{companyInfo.employees_added || 0}</p></div>
                           <div><span className="text-muted-foreground text-sm block mb-1">Seats Available:</span> <p className={`font-bold ${getSeatRemainingColor()}`}>{Math.max(0, (companyInfo.max_employee_capacity || 0) - (companyInfo.employees_added || 0))}</p></div>
                           {companyInfo.seats_requested !== companyInfo.max_employee_capacity && (
                             <div>
                               <span className="text-muted-foreground text-sm text-amber-600 block mb-1">Pending Seat Request:</span> 
                               <p className="font-semibold text-amber-600">{companyInfo.seats_requested || 0}</p>
                             </div>
                           )}
                           <div>
                             <span className="text-muted-foreground text-sm block mb-1">Approval Status:</span>
                             <Badge variant={companyInfo.status === 'approved' ? 'default' : companyInfo.status === 'rejected' ? 'destructive' : 'secondary'}>
                                {companyInfo.status.toUpperCase()}
                             </Badge>
                           </div>
                           <div><span className="text-muted-foreground text-sm block mb-1">Approved By:</span> <p className="font-medium">{companyInfo.approved_by_name || companyInfo.approved_by_email || 'Pending'}</p></div>
                           <div><span className="text-muted-foreground text-sm block mb-1">Approved Date:</span> <p className="font-medium">{companyInfo.status === 'approved' ? new Date(companyInfo.updated_at).toLocaleDateString() : 'Pending'}</p></div>
                         </div>
                       </div>
                     </div>
                     </>
                   ) : (
                     <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
                       <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                       <h3 className="text-lg font-medium">No company information found.</h3>
                       <p className="text-sm text-muted-foreground mt-2">
                         Your organization profile details are currently unavailable.
                       </p>
                     </div>
                   )}
                 </CardContent>
               </Card>
             </TabsContent>
            
            <TabsContent value="invoices" className="space-y-6">

              {/* Section 2 - Invoices List & History */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Your Invoices</CardTitle>
                  <CardDescription>View and pay receipts for your organization workspace bookings</CardDescription>
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
                                      <Badge className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100 flex items-center gap-1.5 w-fit text-xs">
                                        Voided
                                      </Badge>
                                    ) : (
                                      <div className="flex flex-col items-start space-y-1">
                                        <Badge 
                                          className={isPaid ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"}
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
                                        disabled={payingInvoiceId === inv.id}
                                      >
                                        {payingInvoiceId === inv.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          "Pay Now"
                                        )}
                                      </Button>
                                    )}
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                        setSelectedInvoiceForModal(inv);
                                        setInvoiceModalOpen(true);
                                      }}
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

        <Dialog open={editInfoModalOpen} onOpenChange={setEditInfoModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Company Information</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={editData.company_name} onChange={e => setEditData({...editData, company_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={editData.company_website} onChange={e => setEditData({...editData, company_website: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Company Email *</Label>
                <Input type="email" value={editData.company_email} onChange={e => setEditData({...editData, company_email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={editData.industry_type} onChange={e => setEditData({...editData, industry_type: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Contact Person (Admin) *</Label>
                <Input value={editData.admin_full_name} onChange={e => setEditData({...editData, admin_full_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Mobile *</Label>
                <Input value={editData.admin_mobile} onChange={e => setEditData({...editData, admin_mobile: e.target.value})} maxLength={15} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={editData.state} onChange={e => setEditData({...editData, state: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={editData.pincode} onChange={e => setEditData({...editData, pincode: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={editData.gst_number} onChange={e => setEditData({...editData, gst_number: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Current Seats Capacity</Label>
                <Input type="number" value={editData.max_employee_capacity} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Seats Requested</Label>
                <Input type="number" value={editData.seats_requested} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Biometric Required</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="biometric_required"
                      checked={editData.biometric_required === true}
                      onChange={() => setEditData({...editData, biometric_required: true})}
                      className="w-4 h-4 text-primary"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="biometric_required"
                      checked={editData.biometric_required === false}
                      onChange={() => setEditData({...editData, biometric_required: false})}
                      className="w-4 h-4 text-primary"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>
              
              <div className="space-y-2 md:col-span-2 border-t pt-4 mt-2">
                <Label className="text-sm font-semibold">Company Logo</Label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                  {editData.company_logo_url ? (
                    <div className="relative group">
                      <img 
                        src={`/api/v1/storage/raw/${editData.company_logo_url}`} 
                        alt="Logo Preview" 
                        className="w-16 h-16 object-cover rounded-full border bg-muted" 
                      />
                      <button
                        type="button"
                        onClick={() => setEditData({...editData, company_logo_url: ""})}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition shadow"
                      >
                        <span className="text-[10px] px-1 font-bold">✕</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold">
                      No Logo
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Input 
                      type="file" 
                      accept="image/*"
                      className="max-w-xs cursor-pointer text-xs"
                      onChange={handleLogoUpload}
                    />
                    <p className="text-[10px] text-muted-foreground">Supported formats: JPG, PNG, GIF</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditInfoModalOpen(false)}>Cancel</Button>
              <Button onClick={saveCompanyInfo} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={enrollModalOpen} onOpenChange={setEnrollModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {enrollEditingEmployeeId ? "Edit Employee Profile" : "Enroll New Employee"}
              </DialogTitle>
              <DialogDescription>
                Fill out the following information to enroll the employee into the organization's workspace.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEnrollFormSubmit} className="space-y-6 py-4">
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">S.No (Auto Generated)</Label>
                    <Input
                      value={enrollEditingEmployeeId ? (employees.findIndex(e => e.id === enrollEditingEmployeeId) + 1) : (employees.length + 1)}
                      disabled
                      className="bg-muted text-muted-foreground border-input"
                    />
                  </div>
                  {renderInput("employee_id", "Employee ID", "EMP001", "text", false)}
                  {renderInput("full_name", "Employee Name", "John Doe", "text", false)}
                  {renderSelect("gender", "Gender", [
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                    { value: "Other", label: "Other" }
                  ])}
                  {renderInput("date_of_birth", "Date of Birth", "", "date")}
                </div>
              </div>

              {/* Section 2: Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderInput("mobile", "Mobile Number", "9876543210", "tel")}
                  {renderInput("email", "Email Address", "john.doe@example.com", "email")}
                  {renderInput("emergency_contact_name", "Emergency Contact Person (Optional)", "Jane Doe")}
                  {renderInput("emergency_contact_number", "Emergency Contact Number (Optional)", "9876543211", "tel")}
                </div>
              </div>

              {/* Section 3: Company Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Company</Label>
                    <select
                      disabled
                      className="flex h-10 w-full rounded-md border bg-muted text-muted-foreground px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed border-input"
                      value={companyInfo?.id || ""}
                    >
                      <option value={companyInfo?.id || ""}>{companyInfo?.company_name || "NerdShive"}</option>
                    </select>
                  </div>
                  {renderInput("department", "Department", "e.g. Engineering")}
                  {renderInput("designation", "Designation", "e.g. Software Engineer")}
                  {renderInput("joining_date", "Joining Date", "", "date")}
                  {renderSelect("duration", "Duration", [
                    { value: "permanent", label: "Permanent" },
                    { value: "temporary", label: "Temporary" }
                  ])}
                </div>
              </div>

              {/* Section 4: Identity Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Identity Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderSelect("govt_id_type", "ID Proof Type", [
                    { value: "Aadhaar", label: "Aadhaar" },
                    { value: "Passport", label: "Passport" },
                    { value: "PAN", label: "PAN" },
                    { value: "Driving License", label: "Driving License" },
                    { value: "Voter ID", label: "Voter ID" }
                  ])}
                  {renderInput("govt_id_number", "ID Proof Number", enrollFormValues.govt_id_type === "Aadhaar" ? "123456789012" : enrollFormValues.govt_id_type === "PAN" ? "ABCDE1234F" : "ID Number")}
                </div>
              </div>

              {/* Section 5: Parking Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Parking Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderParkingRadio()}
                  {renderSelect("vehicle_type", "Vehicle Type", [
                    { value: "car", label: "Car" },
                    { value: "bike", label: "Bike" }
                  ], !enrollFormValues.requires_parking)}
                  {renderInput("vehicle_brand_model", "Vehicle Brand & Model", "Honda City", "text", !enrollFormValues.requires_parking)}
                  {renderInput("vehicle_color", "Vehicle Color", "White", "text", !enrollFormValues.requires_parking)}
                  {renderInput("vehicle_registration", "Vehicle Registration Number", "TN01AB1234", "text", !enrollFormValues.requires_parking)}
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setEnrollModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Employee"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={requestSeatsModalOpen} onOpenChange={setRequestSeatsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {seatsActionType === "increase" ? "Increase Seats Capacity" : "Reduce Seats Capacity"}
              </DialogTitle>
              <DialogDescription>
                {seatsActionType === "increase" 
                  ? "Request an increase to your organization's seat allocation." 
                  : "Request a reduction in your organization's seat allocation."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Seats Capacity</Label>
                <Input value={companyInfo?.max_employee_capacity || 0} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>
                  {seatsActionType === "increase" ? "Additional Seats Required" : "Seats to Remove"}
                </Label>
                <Input 
                  type="number" 
                  value={requestedSeatsInput || ""} 
                  onChange={e => setRequestedSeatsInput(parseInt(e.target.value) || 0)} 
                  placeholder={seatsActionType === "increase" ? "e.g. 5" : "e.g. 5"}
                  min={1}
                />
              </div>
              
              {/* Warnings/Validation */}
              {seatsActionType === "reduce" && requestedSeatsInput > 0 && ((companyInfo?.max_employee_capacity || 0) - requestedSeatsInput) < (stats?.total_employees || 0) && (
                <p className="text-xs font-semibold text-destructive mt-1 bg-destructive/10 p-2 rounded border border-destructive/20">
                  Seat allocation cannot be reduced below the current number of registered employees ({stats?.total_employees || 0}).
                </p>
              )}
              {seatsActionType === "reduce" && requestedSeatsInput >= (companyInfo?.max_employee_capacity || 0) && (
                <p className="text-xs font-semibold text-destructive mt-1 bg-destructive/10 p-2 rounded border border-destructive/20">
                  Seats to remove must be less than current seats capacity.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestSeatsModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={submitSeatsRequest} 
                disabled={
                  loading || 
                  requestedSeatsInput <= 0 ||
                  (seatsActionType === "reduce" && ((companyInfo?.max_employee_capacity || 0) - requestedSeatsInput) < (stats?.total_employees || 0)) ||
                  (seatsActionType === "reduce" && requestedSeatsInput >= (companyInfo?.max_employee_capacity || 0))
                }
              >
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={seatLogModalOpen} onOpenChange={setSeatLogModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Seat Activity History</DialogTitle>
              <DialogDescription>
                Full history of seat allocation changes for your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              {seatLogs.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">No seat activity history found.</p>
              ) : (
                <div className="space-y-3">
                  {seatLogs.map((log: any) => (
                    <Card key={log.id} className="bg-muted/30">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">
                              {log.title === "Seat Request Submitted" ? log.message : log.title}
                            </p>
                            {log.title !== "Seat Request Submitted" && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Request has been processed.
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            log.title.includes("Approved") ? "default" :
                            log.title.includes("Rejected") ? "destructive" : "secondary"
                          }>
                            {log.title.includes("Approved") ? "Approved" :
                             log.title.includes("Rejected") ? "Rejected" : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSeatLogModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedEmployeeDetails} onOpenChange={() => setSelectedEmployeeDetails(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Employee Profile Details
              </DialogTitle>
              <DialogDescription>
                Full enrollment details uploaded via CSV.
              </DialogDescription>
            </DialogHeader>
            {selectedEmployeeDetails && (
              <div className="space-y-6 py-4">
                {/* General Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">General Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Full Name</span>
                      <span className="font-semibold">{selectedEmployeeDetails.full_name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Email ID</span>
                      <span className="font-semibold">{selectedEmployeeDetails.email}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Mobile Number</span>
                      <span className="font-semibold">{selectedEmployeeDetails.mobile}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Gender</span>
                      <span className="font-semibold capitalize">{selectedEmployeeDetails.gender || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Date of Birth</span>
                      <span className="font-semibold">{selectedEmployeeDetails.date_of_birth ? new Date(selectedEmployeeDetails.date_of_birth).toLocaleDateString('en-IN') : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Emergency Contact</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Contact Person</span>
                      <span className="font-semibold">{selectedEmployeeDetails.emergency_contact_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Contact Number</span>
                      <span className="font-semibold">{selectedEmployeeDetails.emergency_contact_number || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Employment Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Employment Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Company Name</span>
                      <span className="font-semibold">{selectedEmployeeDetails.org_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Department / Team</span>
                      <span className="font-semibold">{selectedEmployeeDetails.department || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Designation / Role</span>
                      <span className="font-semibold">{selectedEmployeeDetails.designation || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Employee ID</span>
                      <span className="font-semibold">{selectedEmployeeDetails.employee_id || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Joining Date</span>
                      <span className="font-semibold">{selectedEmployeeDetails.joining_date ? new Date(selectedEmployeeDetails.joining_date).toLocaleDateString('en-IN') : '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Duration Type</span>
                      <span className="font-semibold capitalize">{selectedEmployeeDetails.duration || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Gov ID */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Government ID Proof</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">ID Proof Type</span>
                      <span className="font-semibold">{selectedEmployeeDetails.govt_id_type || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">ID Proof Number</span>
                      <span className="font-semibold">{selectedEmployeeDetails.govt_id_number || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Parking & Vehicle */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Parking & Vehicle Details</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Requires Parking</span>
                      <span className="font-semibold">{selectedEmployeeDetails.requires_parking ? "Yes" : "No"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Vehicle Type</span>
                      <span className="font-semibold capitalize">{selectedEmployeeDetails.vehicle_type || '-'}</span>
                    </div>
                    {selectedEmployeeDetails.requires_parking && (
                      <>
                        <div>
                          <span className="text-xs text-muted-foreground block">Vehicle Brand & Model</span>
                          <span className="font-semibold">{selectedEmployeeDetails.vehicle_brand_model || '-'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Vehicle Color</span>
                          <span className="font-semibold">{selectedEmployeeDetails.vehicle_color || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-muted-foreground block">Vehicle Registration Number</span>
                          <span className="font-semibold">{selectedEmployeeDetails.vehicle_registration || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setSelectedEmployeeDetails(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

        {/* Subscription Lock Modal */}
        <Dialog open={subscriptionLockModalOpen} onOpenChange={setSubscriptionLockModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center text-amber-600">
                <Shield className="w-5 h-5 mr-2" />
                Subscription Required
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm text-foreground">
                {companyInfo?.subscription_status === "SUSPENDED" ? (
                  "Your workspace subscription is currently suspended. Please contact support or complete outstanding payments."
                ) : (
                  "Your workspace subscription is currently inactive because payment is pending. Please complete your payment from the Invoices page."
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setSubscriptionLockModalOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                setSubscriptionLockModalOpen(false);
                setActiveTab("invoices");
              }}>
                Go to Invoices
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Professional Invoice Viewer Modal */}
        <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" id="printable-invoice-dialog">
            {selectedInvoiceForModal && (
              <div className="space-y-6 p-1">
                <InvoiceRenderer invoice={selectedInvoiceForModal} mode="desktop" />
                
                {/* Actions */}
                <div className="flex justify-end gap-2 pt-6 border-t mt-6">
                  <Button variant="outline" onClick={handleDownloadInvoice}>
                    <Download className="w-4 h-4 mr-2" /> Download HTML
                  </Button>
                  <Button variant="outline" onClick={() => {
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                      printWindow.document.write(renderInvoiceToHtml(selectedInvoiceForModal));
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => {
                        printWindow.print();
                      }, 250);
                    }
                  }}>
                    Print View
                  </Button>
                  <Button variant="ghost" onClick={() => setInvoiceModalOpen(false)}>Close</Button>
                  {selectedInvoiceForModal.status === 'unpaid' && (
                    <Button onClick={() => {
                      setInvoiceModalOpen(false);
                      handlePayInvoice(selectedInvoiceForModal.id);
                    }} disabled={payingInvoiceId === selectedInvoiceForModal.id}>
                      {payingInvoiceId === selectedInvoiceForModal.id ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Paying...</>
                      ) : (
                        <><CreditCard className="w-4 h-4 mr-2" />Pay Now</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
