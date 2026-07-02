import os

file_path = "src/pages/CorporateDashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Imports
target_imports = 'import { Bell, LogOut, Users, Clock, CreditCard, MessageSquare, Building, Shield, Activity, Download, UploadCloud, Edit2, Settings } from "lucide-react";'
replacement_imports = 'import { Bell, LogOut, Users, Clock, CreditCard, MessageSquare, Building, Shield, Activity, Download, UploadCloud, Edit2, Settings, Lock, Plus } from "lucide-react";'
assert target_imports in code, "Imports target not found"
code = code.replace(target_imports, replacement_imports)

# 2. State hooks
target_states = """  // Queries State
  const [queries, setQueries] = useState<any[]>([]);
  const [newQueryMessage, setNewQueryMessage] = useState("");
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const { toast } = useToast();"""

replacement_states = """  // Queries State
  const [queries, setQueries] = useState<any[]>([]);
  const [newQueryMessage, setNewQueryMessage] = useState("");
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Meetings State
  const [corpMeetings, setCorpMeetings] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [bookingForm, setBookingForm] = useState({
    meeting_title: "",
    purpose: "",
    meeting_date: "",
    start_time: "",
    end_time: "",
    participants: 1,
    room_id: "",
    department: "",
    notes: ""
  });
  const [requestMeetingModalOpen, setRequestMeetingModalOpen] = useState(false);
  const [cancelMeetingModalOpen, setCancelMeetingModalOpen] = useState(false);
  const [selectedMeetingToCancel, setSelectedMeetingToCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  const { toast } = useToast();"""

assert target_states in code, "States target not found"
code = code.replace(target_states, replacement_states)

# 3. fetchDashboardData
target_fetch = """      fetchQueries();
    } catch (error) {"""

replacement_fetch = """      fetchQueries();
      fetchCorpMeetings();
    } catch (error) {"""

assert target_fetch in code, "Fetch target not found"
code = code.replace(target_fetch, replacement_fetch)

# 4. Helpers
target_helpers = """  const fetchQueries = async () => {"""

replacement_helpers = """  const fetchCorpMeetings = async () => {
    try {
      const { apiClient } = await import('@/lib/apiClient');
      const res = await apiClient.get('/meetings/');
      setCorpMeetings(res.data);
    } catch (error) {
      console.error("Error fetching corporate meetings:", error);
    }
  };

  const handleBookingSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bookingForm.meeting_title.trim() || !bookingForm.purpose.trim() || !bookingForm.meeting_date || !bookingForm.start_time || !bookingForm.end_time || !bookingForm.department.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
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

  const fetchQueries = async () => {"""

assert target_helpers in code, "Helpers target not found"
code = code.replace(target_helpers, replacement_helpers)

# 5. Tab trigger
target_trigger = '<TabsTrigger value="queries" className="hidden md:flex"><MessageSquare className="w-4 h-4 mr-2" />Queries</TabsTrigger>'
replacement_trigger = '<TabsTrigger value="queries" className="hidden md:flex"><MessageSquare className="w-4 h-4 mr-2" />Queries & Meetings</TabsTrigger>'
assert target_trigger in code, "Trigger target not found"
code = code.replace(target_trigger, replacement_trigger)

# 6. Tab Content
target_content = """            <TabsContent value="queries">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Queries</CardTitle>
                  <CardDescription>Submit and view your queries</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="query">New Query Message</Label>
                    <Textarea 
                      id="query" 
                      placeholder="Type your query here..." 
                      value={newQueryMessage}
                      onChange={e => setNewQueryMessage(e.target.value)}
                    />
                    <Button onClick={submitQuery} disabled={isSubmittingQuery}>
                      {isSubmittingQuery ? "Submitting..." : "Submit Query"}
                    </Button>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-lg">My Queries</h3>
                    {queries.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No queries submitted yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {queries.map(q => (
                          <div key={q.id} className="p-3 bg-muted/40 rounded-lg border">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-semibold text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</span>
                              <Badge variant={q.status === 'open' ? 'secondary' : 'outline'}>{q.status.toUpperCase()}</Badge>
                            </div>
                            <p className="text-sm font-medium">{q.query_text}</p>
                            {q.response && (
                              <div className="mt-2 pl-3 border-l-2 border-primary/45 text-sm text-muted-foreground bg-muted/20 p-2 rounded">
                                <span className="font-semibold block text-xs mb-1 text-primary">Response:</span>
                                {q.response}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>"""

replacement_content = """            <TabsContent value="queries">
              <Tabs defaultValue="queries_sub" className="space-y-6">
                <TabsList className="grid grid-cols-2 w-full lg:w-[400px]">
                  <TabsTrigger value="queries_sub">Queries</TabsTrigger>
                  <TabsTrigger value="meetings_sub">Meetings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="queries_sub" className="space-y-6">
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle>Queries</CardTitle>
                      <CardDescription>Submit and view your queries</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="query">New Query Message</Label>
                        <Textarea 
                          id="query" 
                          placeholder="Type your query here..." 
                          value={newQueryMessage}
                          onChange={e => setNewQueryMessage(e.target.value)}
                        />
                        <Button onClick={submitQuery} disabled={isSubmittingQuery}>
                          {isSubmittingQuery ? "Submitting..." : "Submit Query"}
                        </Button>
                      </div>

                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold text-lg">My Queries</h3>
                        {queries.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No queries submitted yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {queries.map(q => (
                              <div key={q.id} className="p-3 bg-muted/40 rounded-lg border">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-xs font-semibold text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</span>
                                  <Badge variant={q.status === 'open' ? 'secondary' : 'outline'}>{q.status.toUpperCase()}</Badge>
                                </div>
                                <p className="text-sm font-medium">{q.query_text}</p>
                                {q.response && (
                                  <div className="mt-2 pl-3 border-l-2 border-primary/45 text-sm text-muted-foreground bg-muted/20 p-2 rounded">
                                    <span className="font-semibold block text-xs mb-1 text-primary">Response:</span>
                                    {q.response}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="meetings_sub" className="space-y-6">
                  <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
                    <div>
                      <h2 className="text-lg font-bold">Workspace Meetings</h2>
                      <p className="text-sm text-muted-foreground">Request meeting rooms and manage your scheduled sessions</p>
                    </div>
                    <Button onClick={() => {
                      setBookingForm({
                        meeting_title: "",
                        purpose: "",
                        meeting_date: "",
                        start_time: "",
                        end_time: "",
                        participants: 1,
                        room_id: "",
                        department: "",
                        notes: ""
                      });
                      setRequestMeetingModalOpen(true);
                    }} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Request Meeting
                    </Button>
                  </div>

                  <div className="space-y-8">
                    {/* Upcoming Meetings */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Upcoming Meetings</h3>
                      {corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") >= new Date(new Date().setHours(0,0,0,0))).length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">No upcoming approved meetings.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") >= new Date(new Date().setHours(0,0,0,0))).map(m => (
                            <Card key={m.id} className="border-l-4 border-l-green-500">
                              <CardContent className="p-4 flex justify-between items-start">
                                <div className="space-y-1">
                                  <p className="font-bold text-base">{m.meeting_title}</p>
                                  <p className="text-xs text-muted-foreground">Room: <span className="font-semibold text-primary">{m.room?.room_name || 'Not Assigned'}</span></p>
                                  <p className="text-xs text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                                  {m.decision_notes && <p className="text-xs italic mt-2 text-muted-foreground">Note: "{m.decision_notes}"</p>}
                                </div>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 text-xs h-7" onClick={() => {
                                  setSelectedMeetingToCancel(m);
                                  setCancelReason("");
                                  setCancelMeetingModalOpen(true);
                                }}>Cancel</Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pending Requests */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Pending Requests</h3>
                      {corpMeetings.filter(m => m.status === 'PENDING').length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">No pending requests.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {corpMeetings.filter(m => m.status === 'PENDING').map(m => (
                            <Card key={m.id} className="border-l-4 border-l-amber-500">
                              <CardContent className="p-4 flex justify-between items-start">
                                <div className="space-y-1">
                                  <p className="font-bold text-base">{m.meeting_title}</p>
                                  <p className="text-xs text-muted-foreground">Room: {m.room?.room_name || 'Auto-assigning'}</p>
                                  <p className="text-xs text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                                </div>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 text-xs h-7" onClick={() => {
                                  setSelectedMeetingToCancel(m);
                                  setCancelReason("");
                                  setCancelMeetingModalOpen(true);
                                }}>Cancel</Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Completed Meetings */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Completed Meetings</h3>
                      {corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") < new Date(new Date().setHours(0,0,0,0))).length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">No completed meetings.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
                          {corpMeetings.filter(m => m.status === 'APPROVED' && new Date(m.meeting_date + "T00:00:00") < new Date(new Date().setHours(0,0,0,0))).map(m => (
                            <Card key={m.id}>
                              <CardContent className="p-4">
                                <p className="font-bold text-base">{m.meeting_title}</p>
                                <p className="text-xs text-muted-foreground">Room: {m.room?.room_name}</p>
                                <p className="text-xs text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Rejected Requests */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Rejected Requests</h3>
                      {corpMeetings.filter(m => m.status === 'REJECTED').length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">No rejected requests.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {corpMeetings.filter(m => m.status === 'REJECTED').map(m => (
                            <Card key={m.id} className="border-l-4 border-l-red-500">
                              <CardContent className="p-4">
                                <p className="font-bold text-base">{m.meeting_title}</p>
                                <p className="text-xs text-muted-foreground">Date: {m.meeting_date} | Room: {m.room?.room_name || 'Requested'}</p>
                                {m.decision_notes && <p className="text-xs italic text-red-600 mt-2">Reason: "{m.decision_notes}"</p>}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cancelled Meetings */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Cancelled Meetings</h3>
                      {corpMeetings.filter(m => m.status === 'CANCELLED').length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">No cancelled meetings.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {corpMeetings.filter(m => m.status === 'CANCELLED').map(m => (
                            <Card key={m.id} className="border-l-4 border-l-gray-400">
                              <CardContent className="p-4">
                                <p className="font-bold text-base text-muted-foreground">{m.meeting_title}</p>
                                <p className="text-xs text-muted-foreground">Date: {m.meeting_date} | Time: {m.start_time.substring(0,5)} - {m.end_time.substring(0,5)}</p>
                                {m.cancel_reason && <p className="text-xs italic text-muted-foreground mt-2">Reason: "{m.cancel_reason}"</p>}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>"""

assert target_content in code, "Tab Content target not found"
code = code.replace(target_content, replacement_content)

# 7. Approved Capacity Display
target_capacity = """                            <div><span className="text-muted-foreground text-sm">Seats Requested:</span> <p className="font-medium">{companyInfo.seats_requested || 0}</p></div>
                            <div><span className="text-muted-foreground text-sm">Employees Added:</span> <p className="font-medium">{companyInfo.employees_added || 0}</p></div>
                            <div><span className="text-muted-foreground text-sm block mb-1">Seats Remaining:</span> <p className={`font-bold ${getSeatRemainingColor()}`}>{Math.max(0, (companyInfo.seats_requested || 0) - (companyInfo.employees_added || 0))}</p></div>
                            <div>
                              <span className="text-muted-foreground text-sm block mb-1">Approval Status:</span>
                              <Badge variant={companyInfo.status === 'approved' ? 'default' : companyInfo.status === 'rejected' ? 'destructive' : 'secondary'}>
                                 {companyInfo.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div><span className="text-muted-foreground text-sm block mb-1">Approved By:</span> <p className="font-medium">{companyInfo.approved_by || 'Pending'}</p></div>"""

replacement_capacity = """                            <div><span className="text-muted-foreground text-sm">Approved Capacity:</span> <p className="font-medium">{companyInfo.max_employee_capacity || 0}</p></div>
                            <div><span className="text-muted-foreground text-sm">Employees Added:</span> <p className="font-medium">{companyInfo.employees_added || 0}</p></div>
                            <div><span className="text-muted-foreground text-sm block mb-1">Seats Remaining:</span> <p className={`font-bold ${getSeatRemainingColor()}`}>{Math.max(0, (companyInfo.max_employee_capacity || 0) - (companyInfo.employees_added || 0))}</p></div>
                            <div>
                              <span className="text-muted-foreground text-sm block mb-1">Approval Status:</span>
                              <Badge variant={companyInfo.status === 'approved' ? 'default' : companyInfo.status === 'rejected' ? 'destructive' : 'secondary'}>
                                 {companyInfo.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div><span className="text-muted-foreground text-sm block mb-1">Approved By:</span> <p className="font-medium">{companyInfo.approved_by_name || companyInfo.approved_by_email || (companyInfo.approved_by ? 'Approved' : 'Pending')}</p></div>"""

assert target_capacity in code, "Capacity target not found"
code = code.replace(target_capacity, replacement_capacity)

# 8. Capacity upgrade modal fields and disabled editData fields
target_editdata = """              <div className="space-y-2">
                <Label>Maximum Seats Required</Label>
                <Input type="number" value={editData.max_employee_capacity} onChange={e => setEditData({...editData, max_employee_capacity: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Seats Requested</Label>
                <Input type="number" value={editData.seats_requested} onChange={e => setEditData({...editData, seats_requested: parseInt(e.target.value) || 0})} />
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
              </div>"""

replacement_editdata = """              <div className="space-y-2">
                <Label>Maximum Seats Required</Label>
                <Input type="number" value={editData.max_employee_capacity} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Seats Requested</Label>
                <Input type="number" value={editData.seats_requested} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Biometric Required</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center space-x-2 cursor-not-allowed opacity-70">
                    <input
                      type="radio"
                      name="biometric_required"
                      checked={editData.biometric_required === true}
                      disabled
                      className="w-4 h-4 text-primary cursor-not-allowed"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-not-allowed opacity-70">
                    <input
                      type="radio"
                      name="biometric_required"
                      checked={editData.biometric_required === false}
                      disabled
                      className="w-4 h-4 text-primary cursor-not-allowed"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>"""

assert target_editdata in code, "EditData target not found"
code = code.replace(target_editdata, replacement_editdata)

# 9. Seat upgrade request dialog
target_upgrade = """        <Dialog open={requestSeatsModalOpen} onOpenChange={setRequestSeatsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request More Seats</DialogTitle>
              <DialogDescription>
                Request an upgrade to your organization's seat capacity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Seats Capacity</Label>
                <Input value={companyInfo?.seats_requested || 0} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>New Total Seats Requested</Label>
                <Input 
                  type="number" 
                  value={requestedSeatsInput || ""} 
                  onChange={e => setRequestedSeatsInput(parseInt(e.target.value) || 0)} 
                  placeholder="e.g. 60"
                  min={(companyInfo?.seats_requested || 0) + 1}
                />
              </div>
            </div>"""

replacement_upgrade = """        <Dialog open={requestSeatsModalOpen} onOpenChange={setRequestSeatsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request More Seats</DialogTitle>
              <DialogDescription>
                Request an upgrade to your organization's seat capacity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Seats Capacity</Label>
                <Input value={companyInfo?.max_employee_capacity || 0} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>New Total Seats Requested</Label>
                <Input 
                  type="number" 
                  value={requestedSeatsInput || ""} 
                  onChange={e => setRequestedSeatsInput(parseInt(e.target.value) || 0)} 
                  placeholder="e.g. 60"
                  min={(companyInfo?.max_employee_capacity || 0) + 1}
                />
              </div>
            </div>"""

assert target_upgrade in code, "Upgrade target not found"
code = code.replace(target_upgrade, replacement_upgrade)

# 10. Bottom dialogs (Request Meeting & Cancel Meeting Modals)
target_bottom = """        </Dialog>
      </div>
    </AuthGuard>
  );
}"""

replacement_bottom = """        </Dialog>

        <Dialog open={requestMeetingModalOpen} onOpenChange={(open) => {
          setRequestMeetingModalOpen(open);
          if (!open) {
            setAvailableRooms([]); // Reset available rooms on close
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Meeting Room</DialogTitle>
              <DialogDescription>
                {availableRooms.length > 0 
                  ? "Multiple rooms are available. Please select one to proceed."
                  : "Submit details to request a meeting room booking."
                }
              </DialogDescription>
            </DialogHeader>
            
            {availableRooms.length > 0 ? (
              // Step 2: Room Selection
              <div className="space-y-4 py-4">
                <Label className="text-sm font-semibold">Available Rooms</Label>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {availableRooms.map((room) => (
                    <div 
                      key={room.id}
                      onClick={() => setBookingForm({ ...bookingForm, room_id: room.id })}
                      className={`p-3 border rounded-lg cursor-pointer transition flex items-center justify-between ${
                        bookingForm.room_id === room.id 
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/40 border-muted"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm text-foreground">{room.room_name}</p>
                        <p className="text-xs text-muted-foreground">{room.location || "No Location Specified"}</p>
                      </div>
                      <span className="text-xs font-semibold bg-muted px-2 py-1 rounded text-muted-foreground">
                        Cap: {room.capacity}
                      </span>
                    </div>
                  ))}
                </div>
                <DialogFooter className="flex justify-between items-center gap-2 pt-4">
                  <Button variant="outline" onClick={() => setAvailableRooms([])} disabled={loading}>
                    Back
                  </Button>
                  <Button onClick={() => handleBookingSubmit()} disabled={loading || !bookingForm.room_id}>
                    {loading ? "Submitting..." : "Confirm & Book"}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              // Step 1: Meeting Details Form
              <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="meeting_date">Meeting Date *</Label>
                    <Input 
                      id="meeting_date" 
                      type="date"
                      value={bookingForm.meeting_date} 
                      onChange={e => setBookingForm({...bookingForm, meeting_date: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="participants">Participants *</Label>
                    <Input 
                      id="participants" 
                      type="number"
                      min={1}
                      value={bookingForm.participants || ""} 
                      onChange={e => setBookingForm({...bookingForm, participants: parseInt(e.target.value) || 1})} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="start_time">Start Time *</Label>
                    <Input 
                      id="start_time" 
                      type="time"
                      value={bookingForm.start_time} 
                      onChange={e => setBookingForm({...bookingForm, start_time: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end_time">End Time *</Label>
                    <Input 
                      id="end_time" 
                      type="time"
                      value={bookingForm.end_time} 
                      onChange={e => setBookingForm({...bookingForm, end_time: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="department">Department *</Label>
                  <Input 
                    id="department" 
                    value={bookingForm.department} 
                    onChange={e => setBookingForm({...bookingForm, department: e.target.value})} 
                    placeholder="e.g. Engineering" 
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input 
                    id="notes" 
                    value={bookingForm.notes} 
                    onChange={e => setBookingForm({...bookingForm, notes: e.target.value})} 
                    placeholder="e.g. Projector required" 
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setRequestMeetingModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleBookingSubmit()} disabled={loading}>
                    {loading ? "Checking Rooms..." : "Request Meeting"}
                  </Button>
                </DialogFooter>
              </div>
            )}
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
      </div>
    </AuthGuard>
  );
}"""

assert target_bottom in code, "Bottom target not found"
code = code.replace(target_bottom, replacement_bottom)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("CorporateDashboard.tsx successfully rebuilt and updated!")
