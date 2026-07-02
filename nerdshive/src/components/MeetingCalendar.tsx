import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from "lucide-react";

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
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/30";
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/30";
    case "REJECTED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/30";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
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

interface MeetingCalendarProps {
  userRole: "admin" | "superuser" | "corporate";
  meetings: any[];
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedCalendarDate: Date | null;
  setSelectedCalendarDate: (date: Date | null) => void;
  startOfWeek?: "sun" | "mon";
  onDateClick?: (date: Date) => void;
  className?: string;
}

export function MeetingCalendar({
  userRole,
  meetings,
  currentDate,
  setCurrentDate,
  selectedCalendarDate,
  setSelectedCalendarDate,
  startOfWeek = "sun",
  onDateClick,
  className = ""
}: MeetingCalendarProps) {
  // Read-only Details Modal State (for Admins / Superusers)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsMeeting, setDetailsMeeting] = useState<any | null>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const firstDayIndex = startOfWeek === "mon" 
      ? (firstDay === 0 ? 6 : firstDay - 1)
      : firstDay;
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

  // Empty spaces for previous month's offset
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  const headers = startOfWeek === "mon"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className={`overflow-hidden flex flex-col ${className}`}>
      <CardHeader className={`bg-card border-b ${userRole === "corporate" ? "py-2.5" : "py-4"}`}>
        <div className="flex justify-between items-center">
          {userRole === "corporate" ? (
            <div className="flex items-center space-x-1.5">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">Select Date</CardTitle>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Meeting Calendar</CardTitle>
            </div>
          )}
          <div className="flex items-center space-x-1.5">
            <Button onClick={handlePrevMonth} variant="outline" size="icon" className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className={`font-bold text-center capitalize ${userRole === "corporate" ? "text-xs min-w-[100px]" : "text-sm min-w-[120px]"}`}>
              {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
            <Button onClick={handleNextMonth} variant="outline" size="icon" className="h-7 w-7">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        <div className={`grid grid-cols-7 text-center border-b font-medium text-xs text-muted-foreground bg-muted/30 ${
          userRole === "corporate" ? "py-1.5" : "py-2"
        }`}>
          {headers.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        <div 
          className="grid grid-cols-7 grid-rows-5 border-collapse divide-x divide-y bg-background flex-1 min-h-[220px]"
          onClick={() => {
            setSelectedCalendarDate(null);
            if (onDateClick) onDateClick(null as any);
          }}
        >
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-muted/10 h-full min-h-[2.75rem]"></div>;

            const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

            const isSelected = selectedCalendarDate &&
              day.getDate() === selectedCalendarDate.getDate() &&
              day.getMonth() === selectedCalendarDate.getMonth() &&
              day.getFullYear() === selectedCalendarDate.getFullYear();

            const isToday = () => {
              const today = new Date();
              return day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear();
            };

            const isBeforeToday = (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const checkDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
              return checkDay < today;
            })();

            return (
              <div
                key={dayStr}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBeforeToday) return;
                  const isAlreadySelected = selectedCalendarDate &&
                    day.getDate() === selectedCalendarDate.getDate() &&
                    day.getMonth() === selectedCalendarDate.getMonth() &&
                    day.getFullYear() === selectedCalendarDate.getFullYear();
                  
                  if (isAlreadySelected) {
                    setSelectedCalendarDate(null);
                    if (onDateClick) onDateClick(null as any);
                  } else {
                    setSelectedCalendarDate(day);
                    if (onDateClick) onDateClick(day);
                  }
                }}
                className={`flex flex-col transition group relative h-full min-h-[2.75rem] items-center justify-center p-1 ${
                  isBeforeToday
                    ? "opacity-30 cursor-not-allowed bg-muted/5 pointer-events-none select-none"
                    : "hover:bg-muted/10 cursor-pointer"
                } ${
                  isSelected ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""
                }`}
              >
                <div className={`text-center text-xs font-semibold ${
                  isSelected ? "text-primary font-bold" : isToday() ? "text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground"
                }`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Calendar Details Modal (Only relevant for Admin/Superusers) */}
      {userRole !== "corporate" && (
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
                    <Badge className={getStatusColor(detailsMeeting.status)}>{detailsMeeting.status}</Badge>
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
      )}
    </Card>
  );
}
