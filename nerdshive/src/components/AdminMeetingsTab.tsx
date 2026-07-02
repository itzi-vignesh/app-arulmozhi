import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Filter, Search, Check, X, ShieldAlert, Clock, Building, ArrowUpDown, ChevronLeft, ChevronRight, MessageSquare, Info } from "lucide-react";
import { MeetingCalendar } from "./MeetingCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/apiClient";

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

const isMeetingExpired = (meeting: any) => {
  if (!meeting || !meeting.meeting_date || !meeting.end_time) return false;
  const [year, month, day] = meeting.meeting_date.split("-").map(Number);
  const [hours, minutes] = meeting.end_time.split(":").map(Number);
  const now = new Date();
  const meetingEnd = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return meetingEnd < now;
};

const formatDateToInput = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function AdminMeetingsTab() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Search & Filter State
  const [searchCompany, setSearchCompany] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date());
  const [sortBy, setSortBy] = useState("date");

  // Approval/Rejection Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "CANCEL">("APPROVE");
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsMeeting, setDetailsMeeting] = useState<any | null>(null);

  // Calendar Year/Month State
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const params: any = {
        sort_by: sortBy
      };
      if (searchCompany.trim()) params.search_company = searchCompany;
      if (searchTitle.trim()) params.search_title = searchTitle;
      if (filterRoom !== "all") params.room_id = filterRoom;
      if (filterStatus !== "all") params.status = filterStatus;
      if (selectedCalendarDate) params.date = formatDateToInput(selectedCalendarDate);

      const res = await apiClient.get("/meetings/", { params });
      setMeetings(res.data);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      toast({ title: "Failed to load meetings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await apiClient.get("/meetings/rooms");
      setRooms(res.data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchRooms();
  }, [searchCompany, searchTitle, filterRoom, filterStatus, selectedCalendarDate, sortBy]);

  const handleOpenActionModal = (meeting: any, type: "APPROVE" | "REJECT" | "CANCEL") => {
    setSelectedMeeting(meeting);
    setActionType(type);
    setDecisionNotes("");
    setActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedMeeting) return;
    try {
      let endpoint = `/meetings/${selectedMeeting.id}/${actionType === "APPROVE" ? "approve" : "reject"}`;
      let payload: any = null;
      let config: any = {
        params: { decision_notes: decisionNotes }
      };

      if (actionType === "CANCEL") {
        endpoint = `/meetings/${selectedMeeting.id}/cancel`;
        payload = { cancel_reason: decisionNotes || "Timed out request closed by administrator." };
        config = {};
      }

      await apiClient.put(endpoint, payload, config);

      toast({
        title: `Meeting ${actionType === "APPROVE" ? "Approved" : actionType === "CANCEL" ? "Closed/Cancelled" : "Rejected"} Successfully`,
        description: `Company admins have been notified.`
      });
      setActionModalOpen(false);
      fetchMeetings();
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "Operation failed";
      toast({ title: "Operation failed", description: errMsg, variant: "destructive" });
    }
  };

  // Helper for Calendar Days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayIndex };
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const { daysInMonth, firstDayIndex } = getDaysInMonth(currentDate);
  const calendarDays = [];
  // Empty spaces for previous month's end
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  const formatTimeStr = (timeStr: string) => {
    if (!timeStr) return "";
    try {
      const parts = timeStr.split(":");
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
      return timeStr;
    } catch (e) {
      return timeStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-200";
      case "PENDING":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-200";
      case "CANCELLED":
      case "TIMED OUT":
      case "TIMED_OUT":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-500";
      case "PENDING":
        return "bg-amber-500";
      case "REJECTED":
        return "bg-red-500";
      case "CANCELLED":
        return "bg-gray-500";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Calendar */}
        <div className="flex flex-col h-full">
          <MeetingCalendar
            userRole="admin"
            meetings={meetings}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            selectedCalendarDate={selectedCalendarDate}
            setSelectedCalendarDate={setSelectedCalendarDate}
            startOfWeek="sun"
            className="h-full"
          />
        </div>

        {/* Right Column: Filters and Stacked Lists */}
        <div className="flex flex-col h-[500px] lg:h-[calc(100vh-280px)] lg:min-h-[500px] lg:max-h-[700px] space-y-6">
          {/* Search Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Company Name or Meeting Title..."
                    value={searchCompany}
                    onChange={(e) => {
                      setSearchCompany(e.target.value);
                      setSearchTitle(e.target.value);
                    }}
                    className="pl-9"
                  />
                </div>
                {selectedCalendarDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCalendarDate(null)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0 border border-dashed h-9 px-3"
                  >
                    Clear Date ({formatLocalDate(formatDateToInput(selectedCalendarDate))})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Lists Section */}
          <Tabs defaultValue="pending" className="space-y-4 flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-4 w-full shrink-0">
              <TabsTrigger value="pending">
                Pending
                {meetings.filter((m) => m.status === "PENDING").length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[9px]">
                    {meetings.filter((m) => m.status === "PENDING").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="flex-1 overflow-y-auto pr-2 min-h-0">
              <div className="space-y-4">
                {meetings.filter((m) => m.status === "PENDING").length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
                    <p className="font-semibold text-lg">No pending requests</p>
                  </div>
                ) : (
                  meetings
                    .filter((m) => m.status === "PENDING")
                    .map((meeting) => (
                      <Card key={meeting.id} className="hover:shadow-sm transition">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2">
                                <Building className="w-5 h-5 text-primary" />
                                <h3 className="font-bold text-lg">{meeting.company?.company_name || "Unknown Company"}</h3>
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({meeting.company?.company_email})
                                </span>
                              </div>

                              <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-sm">
                                <p className="font-semibold text-foreground text-base mb-1">
                                  {meeting.meeting_title}
                                </p>
                                <p className="text-muted-foreground">{meeting.purpose}</p>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                                <div>
                                  <span className="block font-medium">Date:</span>
                                  <p className="font-bold text-foreground mt-0.5">
                                    {formatLocalDate(meeting.meeting_date)}
                                  </p>
                                </div>
                                <div>
                                  <span className="block font-medium">Time:</span>
                                  <p className="font-bold text-foreground mt-0.5">
                                    {formatTimeStr(meeting.start_time)} - {formatTimeStr(meeting.end_time)}
                                  </p>
                                </div>
                                <div>
                                  <span className="block font-medium">Room:</span>
                                  <p className="font-bold text-foreground mt-0.5">
                                    {meeting.room?.room_name || "Not Assigned"}
                                  </p>
                                </div>
                                <div>
                                  <span className="block font-medium">Participants:</span>
                                  <p className="font-bold text-foreground mt-0.5">{meeting.participants} seats</p>
                                </div>
                              </div>

                              {isMeetingExpired(meeting) ? (
                                <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-900/40 rounded-lg text-gray-800 dark:text-gray-300 text-xs font-bold">
                                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                                  <span>⚪ This request has timed out</span>
                                </div>
                              ) : meeting.conflict_info ? (
                                <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-red-800 dark:text-red-300 text-xs">
                                  <div className="flex items-center gap-2 font-bold text-sm">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                    <span>🔴 Room Occupied</span>
                                  </div>
                                  <div className="pl-4 space-y-1">
                                    <p><span className="font-semibold">Conflicting Meeting:</span> {meeting.conflict_info.meeting_title}</p>
                                    <p><span className="font-semibold">Company:</span> {meeting.conflict_info.company_name}</p>
                                    <p><span className="font-semibold">Time:</span> {formatTimeStr(meeting.conflict_info.start_time)} - {formatTimeStr(meeting.conflict_info.end_time)}</p>
                                    <p><span className="font-semibold">Room:</span> {meeting.room?.room_name || "N/A"}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-lg text-green-800 dark:text-green-300 text-xs font-bold">
                                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                  <span>🟢 Room Available</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 ml-4 self-center shrink-0">
                              {meeting.approved_role ? (
                                <div className="text-right text-xs font-semibold text-muted-foreground space-y-1">
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    Already Approved
                                  </Badge>
                                  <p>By {meeting.approved_role}</p>
                                </div>
                              ) : isMeetingExpired(meeting) ? (
                                <div className="flex flex-col gap-2 items-end">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 uppercase font-bold text-xs">
                                    Timed Out
                                  </Badge>
                                  <Button
                                    onClick={() => handleOpenActionModal(meeting, "CANCEL")}
                                    variant="destructive"
                                    size="sm"
                                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    <X className="w-4 h-4" /> Close
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Button
                                    onClick={() => handleOpenActionModal(meeting, "APPROVE")}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                                  >
                                    <Check className="w-4 h-4" /> Approve
                                  </Button>
                                  <Button
                                    onClick={() => handleOpenActionModal(meeting, "REJECT")}
                                    variant="destructive"
                                    size="sm"
                                    className="flex items-center gap-1"
                                  >
                                    <X className="w-4 h-4" /> Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="approved" className="flex-1 overflow-y-auto pr-2 min-h-0">
              <div className="space-y-4">
                {meetings.filter((m) => m.status === "APPROVED").length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
                    <p className="font-medium text-lg">No approved meetings</p>
                  </div>
                ) : (
                  meetings
                    .filter((m) => m.status === "APPROVED")
                    .map((meeting) => (
                      <Card
                        key={meeting.id}
                        onClick={() => {
                          setDetailsMeeting(meeting);
                          setDetailsModalOpen(true);
                        }}
                        className="hover:shadow-sm transition cursor-pointer hover:bg-muted/10"
                      >
                        <CardContent className="p-4 flex justify-between items-center">
                          <div>
                            <h4 className="font-bold">{meeting.meeting_title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {meeting.company?.company_name} | {meeting.room?.room_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">
                              {formatLocalDate(meeting.meeting_date)} | {formatTimeStr(meeting.start_time)} - {formatTimeStr(meeting.end_time)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-green-100 text-green-800">APPROVED</Badge>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              By {meeting.approved_role || "ADMIN"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="rejected" className="flex-1 overflow-y-auto pr-2 min-h-0">
              <div className="space-y-4">
                {meetings.filter((m) => m.status === "REJECTED").length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
                    <p className="font-medium text-lg">No rejected meetings</p>
                  </div>
                ) : (
                  meetings
                    .filter((m) => m.status === "REJECTED")
                    .map((meeting) => (
                      <Card
                        key={meeting.id}
                        onClick={() => {
                          setDetailsMeeting(meeting);
                          setDetailsModalOpen(true);
                        }}
                        className="hover:shadow-sm transition cursor-pointer hover:bg-muted/10"
                      >
                        <CardContent className="p-4 flex justify-between items-center">
                          <div>
                            <h4 className="font-bold">{meeting.meeting_title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {meeting.company?.company_name} | {meeting.room?.room_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">
                              {formatLocalDate(meeting.meeting_date)} | {formatTimeStr(meeting.start_time)} - {formatTimeStr(meeting.end_time)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="destructive">REJECTED</Badge>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              By {meeting.rejected_role || "ADMIN"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="cancelled" className="flex-1 overflow-y-auto pr-2 min-h-0">
              <div className="space-y-4">
                {meetings.filter((m) => m.status === "CANCELLED").length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
                    <p className="font-medium text-lg">No cancelled meetings</p>
                  </div>
                ) : (
                  meetings
                    .filter((m) => m.status === "CANCELLED")
                    .map((meeting) => (
                      <Card
                        key={meeting.id}
                        onClick={() => {
                          setDetailsMeeting(meeting);
                          setDetailsModalOpen(true);
                        }}
                        className="hover:shadow-sm transition cursor-pointer hover:bg-muted/10"
                      >
                        <CardContent className="p-4 flex justify-between items-center">
                          <div>
                            <h4 className="font-bold">{meeting.meeting_title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {meeting.company?.company_name} | {meeting.room?.room_name || "Not Assigned"}
                            </p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">
                              {formatLocalDate(meeting.meeting_date)} | {formatTimeStr(meeting.start_time)} - {formatTimeStr(meeting.end_time)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="bg-gray-100 text-gray-800">CANCELLED</Badge>
                            {meeting.cancel_reason && (
                              <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">
                                Reason: {meeting.cancel_reason}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </TabsContent>


          </Tabs>
        </div>
      </div>

      {/* Decision Notes Dialog (Approve / Reject) */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === "APPROVE" 
                ? "Approve Meeting Request" 
                : actionType === "CANCEL"
                  ? "Close/Cancel Timed Out Request" 
                  : "Reject Meeting Request"
              }
            </DialogTitle>
            <DialogDescription>
              Please review the details and conflict status before confirming.
            </DialogDescription>
          </DialogHeader>
          
          {selectedMeeting && (
            <div className="space-y-4 py-4 text-sm">
              <div className="bg-muted/40 p-4 rounded-lg border space-y-2">
                <div className="grid grid-cols-3 gap-y-2">
                  <span className="font-semibold text-muted-foreground">Company:</span>
                  <span className="col-span-2 font-medium">{selectedMeeting.company?.company_name || "Unknown Company"}</span>

                  <span className="font-semibold text-muted-foreground">Email:</span>
                  <span className="col-span-2">{selectedMeeting.company?.company_email || "N/A"}</span>

                  <span className="font-semibold text-muted-foreground">Title:</span>
                  <span className="col-span-2 font-bold">{selectedMeeting.meeting_title}</span>

                  <span className="font-semibold text-muted-foreground">Purpose:</span>
                  <span className="col-span-2">{selectedMeeting.purpose}</span>

                  <span className="font-semibold text-muted-foreground">Date:</span>
                  <span className="col-span-2">
                    {formatLocalDate(selectedMeeting.meeting_date)}
                  </span>

                  <span className="font-semibold text-muted-foreground">Time:</span>
                  <span className="col-span-2 font-semibold">
                    {formatTimeStr(selectedMeeting.start_time)} - {formatTimeStr(selectedMeeting.end_time)}
                  </span>

                  <span className="font-semibold text-muted-foreground">Room:</span>
                  <span className="col-span-2 font-bold text-primary">{selectedMeeting.room?.room_name || "Not Assigned"}</span>

                  <span className="font-semibold text-muted-foreground">Participants:</span>
                  <span className="col-span-2">{selectedMeeting.participants} seats</span>

                  {selectedMeeting.department && (
                    <>
                      <span className="font-semibold text-muted-foreground">Department:</span>
                      <span className="col-span-2">{selectedMeeting.department}</span>
                    </>
                  )}

                  {selectedMeeting.notes && (
                    <>
                      <span className="font-semibold text-muted-foreground">Notes:</span>
                      <span className="col-span-2 italic">"{selectedMeeting.notes}"</span>
                    </>
                  )}

                  <span className="font-semibold text-muted-foreground">Current Status:</span>
                  <span className="col-span-2">
                    <Badge className={getStatusColor(selectedMeeting.status)}>{selectedMeeting.status}</Badge>
                  </span>
                </div>
              </div>

              {/* Conflict Status Display inside Approve dialog */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold uppercase">Room Status</Label>
                {selectedMeeting.conflict_info ? (
                  <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-red-800 dark:text-red-300 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>🔴 Room Occupied</span>
                    </div>
                    <div className="pl-4 space-y-1">
                      <p><span className="font-semibold">Conflicting Meeting:</span> {selectedMeeting.conflict_info.meeting_title}</p>
                      <p><span className="font-semibold">Company:</span> {selectedMeeting.conflict_info.company_name}</p>
                      <p><span className="font-semibold">Time:</span> {formatTimeStr(selectedMeeting.conflict_info.start_time)} - {formatTimeStr(selectedMeeting.conflict_info.end_time)}</p>
                      <p><span className="font-semibold">Room:</span> {selectedMeeting.room?.room_name || "N/A"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-lg text-green-800 dark:text-green-300 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>🟢 Room Available</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="notes" className="font-semibold">Decision Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder={actionType === "APPROVE" ? "e.g. Approved. Please coordinate with reception." : actionType === "CANCEL" ? "e.g. Timed out request closed by administrator." : "e.g. Room booked by another corporate meeting."}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setActionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmAction}
              className={actionType === "APPROVE" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              Confirm {actionType === "APPROVE" 
                ? "Approval" 
                : actionType === "CANCEL"
                  ? "Close" 
                  : "Rejection"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendar Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Meeting Details
            </DialogTitle>
            <DialogDescription>
              Full details of the scheduled session.
            </DialogDescription>
          </DialogHeader>
          {detailsMeeting && (
            <div className="space-y-4 pt-4 text-sm">
              <div className="grid grid-cols-3 gap-y-2">
                <span className="font-semibold text-muted-foreground">Title:</span>
                <span className="col-span-2 font-bold">{detailsMeeting.meeting_title}</span>

                <span className="font-semibold text-muted-foreground">Company:</span>
                <span className="col-span-2">{detailsMeeting.company?.company_name || "Unknown Company"}</span>

                <span className="font-semibold text-muted-foreground">Purpose:</span>
                <span className="col-span-2">{detailsMeeting.purpose}</span>

                <span className="font-semibold text-muted-foreground">Room:</span>
                <span className="col-span-2 font-semibold text-primary">{detailsMeeting.room?.room_name || "Not Assigned"}</span>

                <span className="font-semibold text-muted-foreground">Date:</span>
                <span className="col-span-2">{formatLocalDate(detailsMeeting.meeting_date)}</span>

                <span className="font-semibold text-muted-foreground">Time:</span>
                <span className="col-span-2 font-bold text-foreground">
                  {formatTimeStr(detailsMeeting.start_time)} - {formatTimeStr(detailsMeeting.end_time)}
                </span>

                <span className="font-semibold text-muted-foreground">Participants:</span>
                <span className="col-span-2">{detailsMeeting.participants} expected</span>

                {detailsMeeting.department && (
                  <>
                    <span className="font-semibold text-muted-foreground">Department:</span>
                    <span className="col-span-2">{detailsMeeting.department}</span>
                  </>
                )}

                {detailsMeeting.notes && (
                  <>
                    <span className="font-semibold text-muted-foreground">Notes:</span>
                    <span className="col-span-2 italic">"{detailsMeeting.notes}"</span>
                  </>
                )}

                <span className="font-semibold text-muted-foreground">Status:</span>
                <span className="col-span-2">
                  {(() => {
                    const isExpired = isMeetingExpired(detailsMeeting);
                    const displayStatus = (detailsMeeting.status === "PENDING" && isExpired) ? "TIMED OUT" : detailsMeeting.status;
                    return (
                      <Badge className={getStatusColor(displayStatus)}>{displayStatus}</Badge>
                    );
                  })()}
                </span>

                {detailsMeeting.decision_notes && (
                  <>
                    <span className="font-semibold text-muted-foreground">Decision Notes:</span>
                    <span className="col-span-2 italic text-muted-foreground">"{detailsMeeting.decision_notes}"</span>
                  </>
                )}
                
                {detailsMeeting.cancel_reason && (
                  <>
                    <span className="font-semibold text-red-800">Cancel Reason:</span>
                    <span className="col-span-2 italic text-red-700">"{detailsMeeting.cancel_reason}"</span>
                  </>
                )}
              </div>

              {/* Conflict Status Display inside Details dialog */}
              <div className="space-y-1 mt-4 border-t pt-4">
                <Label className="text-xs text-muted-foreground font-semibold uppercase">Room Status / Availability</Label>
                {detailsMeeting.conflict_info ? (
                  <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-red-800 dark:text-red-300 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span>🔴 Room Occupied (Conflict Detected)</span>
                    </div>
                    <div className="pl-4 space-y-1">
                      <p><span className="font-semibold">Conflicting Meeting:</span> {detailsMeeting.conflict_info.meeting_title}</p>
                      <p><span className="font-semibold">Company:</span> {detailsMeeting.conflict_info.company_name}</p>
                      <p><span className="font-semibold">Time:</span> {formatTimeStr(detailsMeeting.conflict_info.start_time)} - {formatTimeStr(detailsMeeting.conflict_info.end_time)}</p>
                      <p><span className="font-semibold">Room:</span> {detailsMeeting.room?.room_name || "N/A"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-lg text-green-800 dark:text-green-300 text-xs font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>🟢 Room Available</span>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" onClick={() => setDetailsModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
