import { useState, useEffect } from "react";
import { corporateService, Company } from "@/services/corporateService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Building, Mail, MapPin, Eye, FileText, Lock, ShieldAlert, ShieldCheck, Trash2, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent } from "@/components/ui/card";

interface OrganizationApprovalTabProps {
  onCountChange?: (count: number) => void;
  readOnly?: boolean;
}

export function OrganizationApprovalTab({ onCountChange, readOnly = false }: OrganizationApprovalTabProps) {
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);
  const [approvedCompanies, setApprovedCompanies] = useState<Company[]>([]);
  const [upgradeRequestedCompanies, setUpgradeRequestedCompanies] = useState<Company[]>([]);
  const [permissionRequestedCompanies, setPermissionRequestedCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<any | null>(null);
  const { toast } = useToast();

  const fetchCompanies = async () => {
    try {
      const data = await corporateService.getCompanies();
      const pending = data.filter((c: Company) => c.status === "pending");
      const approved = data.filter((c: Company) => c.status === "approved" || c.status === "suspended");
      const upgrades = data.filter((c: Company) => c.status === "approved" && c.seats_requested !== c.max_employee_capacity);
      const permissions = data.filter((c: Company) => c.seat_allocation_permission_requested === true);
      
      setPendingCompanies(pending);
      setApprovedCompanies(approved);
      setUpgradeRequestedCompanies(upgrades);
      setPermissionRequestedCompanies(permissions);
      
      if (onCountChange) {
        onCountChange(pending.length);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchCompanyEmployees = async (companyId: string) => {
    setLoadingEmployees(true);
    try {
      const res = await apiClient.get(`/companies/${companyId}/employees`);
      setCompanyEmployees(res.data);
    } catch (error) {
      console.error("Error fetching company employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleViewCompanyDetails = (company: any) => {
    setSelectedCompany(company);
    setDetailsModalOpen(true);
    setCompanyEmployees([]);
    fetchCompanyEmployees(company.id);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.approveCompany(id);
      toast({ title: "Organization Approved" });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Approval Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.rejectCompany(id);
      toast({ title: "Organization Rejected" });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Rejection Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSeats = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.approveSeatsUpgrade(id);
      toast({ title: "Seat change request approved successfully." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Approval Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSeats = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.rejectSeatsUpgrade(id);
      toast({ title: "Seat change request rejected." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Rejection Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePermission = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.approveSeatPermission(id);
      toast({ title: "Seat permission request approved." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Approval Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPermission = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.rejectSeatPermission(id);
      toast({ title: "Seat permission request rejected." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Rejection Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBiometric = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.approveBiometricRequest(id);
      toast({ title: "Biometric request approved." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Approval Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBiometric = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.rejectBiometricRequest(id);
      toast({ title: "Biometric request rejected." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Rejection Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableBiometric = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.disableBiometric(id);
      toast({ title: "Biometric attendance disabled." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Operation Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.suspendCompany(id);
      toast({ title: "Company Suspended Successfully" });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Suspension Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    setLoading(true);
    try {
      await corporateService.activateCompany(id);
      toast({ title: "Company Activated Successfully" });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Activation Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async (id: string, companyName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${companyName}"? This action will permanently remove the company, delete its administrator accounts, and unlink all associated employees.`)) {
      return;
    }
    setLoading(true);
    try {
      await corporateService.deleteCompany(id);
      toast({ title: `Company "${companyName}" deleted successfully.` });
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({ title: "Deletion Failed", description: "Failed to delete company.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (filePath: string, fileName: string) => {
    try {
      const parts = filePath.split('/');
      const bucket = parts[0];
      const path = parts.slice(1).join('/');
      
      const { apiClient } = await import('@/lib/apiClient');
      const response = await apiClient.get(`/storage/raw/${bucket}/${path}`, {
        responseType: 'blob'
      });
      
      const contentType = String(response.headers['content-type'] || '');
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      
      const isPDF = contentType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
      const isImage = contentType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
      
      if (isPDF || isImage) {
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 5000);
    } catch (error) {
      console.error("Error viewing document:", error);
      toast({
        title: "Error opening document",
        description: "You may not have permission or the file does not exist.",
        variant: "destructive"
      });
    }
  };

  const filteredApprovedCompanies = approvedCompanies.filter((company) => {
    const query = searchQuery.toLowerCase();
    return (
      company.company_name.toLowerCase().includes(query) ||
      company.company_email.toLowerCase().includes(query) ||
      (company.industry_type && company.industry_type.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-8">
      {!readOnly && (
        <>
          {/* SECTION 1: Pending Company Registration Requests */}
          <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-800">
            <Building className="w-5 h-5" />
            Pending Company Registration Requests
          </h3>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-semibold">
            {pendingCompanies.length} Pending
          </Badge>
        </div>

        {pendingCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
            <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No pending organization registration requests</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Company Email</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead className="text-center">Requested Seats</TableHead>
                  <TableHead className="text-center">Biometric Required</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCompanies.map((company) => {
                  const contactPerson = company.admins?.[0]?.full_name || "N/A";
                  const biometricLabel = (company.biometric_requested || company.biometric_required) ? "Yes (Requested)" : "No";
                  
                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-semibold">{company.company_name}</TableCell>
                      <TableCell>{company.company_email}</TableCell>
                      <TableCell>{contactPerson}</TableCell>
                      <TableCell className="text-center">{company.seats_requested || 0}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={(company.biometric_requested || company.biometric_required) ? "bg-amber-50 text-amber-700 border-amber-200" : "text-muted-foreground"}>
                          {biometricLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(company.created_at || Date.now()).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 cursor-default">
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedCompany(company)}>
                                <Eye className="w-4 h-4 mr-1" /> View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Company Application Details</DialogTitle>
                                <DialogDescription>Review the complete application before approval.</DialogDescription>
                              </DialogHeader>
                              {selectedCompany && (
                                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-base border-b pb-2">Company Information</h4>
                                    <p><strong>Name:</strong> {selectedCompany.company_name}</p>
                                    <p><strong>Website:</strong> {selectedCompany.company_website || "N/A"}</p>
                                    <p><strong>Email:</strong> {selectedCompany.company_email}</p>
                                    <p><strong>Industry:</strong> {selectedCompany.industry_type || "N/A"}</p>
                                    <p><strong>GST Number:</strong> {selectedCompany.gst_number || "N/A"}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-base border-b pb-2">Primary Contact</h4>
                                    <p><strong>Name:</strong> {selectedCompany.admins?.[0]?.full_name || "N/A"}</p>
                                    <p><strong>Email:</strong> {selectedCompany.admins?.[0]?.email || "N/A"}</p>
                                    <p><strong>Mobile:</strong> {selectedCompany.admins?.[0]?.mobile || "N/A"}</p>
                                  </div>
                                  <div className="space-y-2 col-span-2">
                                    <h4 className="font-semibold text-base border-b pb-2">Address</h4>
                                    <p>{selectedCompany.address}, {selectedCompany.city}, {selectedCompany.state} - {selectedCompany.pincode}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-base border-b pb-2">Capacity</h4>
                                    <p><strong>Maximum Seats:</strong> {selectedCompany.max_employee_capacity || 0}</p>
                                    <p><strong>Seats Requested:</strong> {selectedCompany.seats_requested || 0}</p>
                                  </div>
                                  <div className="space-y-2 col-span-2">
                                    <h4 className="font-semibold text-base border-b pb-2">Uploaded Documents</h4>
                                    {selectedCompany.documents && Array.isArray(selectedCompany.documents) && selectedCompany.documents.length > 0 ? (
                                      <ul className="list-disc pl-5 space-y-1">
                                        {selectedCompany.documents.map((doc: any, i: number) => (
                                          <li key={i}>
                                            <button
                                              onClick={() => handleViewDocument(doc.file_path, doc.name || "document")}
                                              className="text-primary hover:underline flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer align-baseline text-left font-normal"
                                            >
                                              <FileText className="w-4 h-4 text-muted-foreground" /> {doc.type}: {doc.name || "View File"}
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button onClick={() => handleApprove(company.id)} size="sm" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button onClick={() => handleReject(company.id)} variant="destructive" size="sm" disabled={loading}>
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* SECTION 1.2: Seat Allocation Permission Requests */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-800">
            <Building className="w-5 h-5" />
            Seat Allocation Permission Requests
          </h3>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-semibold">
            {permissionRequestedCompanies.length} Requests
          </Badge>
        </div>

        {permissionRequestedCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
            <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No pending seat allocation permission requests</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Company Email</TableHead>
                  <TableHead className="text-center">Current Capacity</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionRequestedCompanies.map((company) => {
                  const reqDate = new Date(company.updated_at || company.created_at || Date.now()).toLocaleDateString();

                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-semibold">{company.company_name}</TableCell>
                      <TableCell>{company.company_email}</TableCell>
                      <TableCell className="text-center font-medium">{company.max_employee_capacity}</TableCell>
                      <TableCell>{reqDate}</TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 cursor-default">
                          Permission Requested
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => handleApprovePermission(company.id)}
                            size="sm"
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="w-4 h-4 mr-1" /> Grant Permission
                          </Button>
                          <Button
                            onClick={() => handleRejectPermission(company.id)}
                            variant="destructive"
                            size="sm"
                            disabled={loading}
                          >
                            <X className="w-4 h-4 mr-1" /> Reject Request
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* SECTION 1.5: Seat Allocation Requests */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-800">
            <Building className="w-5 h-5" />
            Seat Allocation Requests
          </h3>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-semibold">
            {upgradeRequestedCompanies.length} Requests
          </Badge>
        </div>

        {upgradeRequestedCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
            <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No pending capacity upgrade requests</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-center">Current Capacity</TableHead>
                  <TableHead className="text-center">Requested Capacity</TableHead>
                  <TableHead className="text-center">Change Amount</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Invoice Status</TableHead>
                  <TableHead>Request Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upgradeRequestedCompanies.map((company) => {
                  const changeAmount = company.seats_requested - company.max_employee_capacity;
                  const isIncrease = changeAmount > 0;
                  const reqDate = new Date(company.updated_at || company.created_at || Date.now()).toLocaleDateString();

                  // Determine display values
                  const invoiceNum = isIncrease ? (company.seat_upgrade_invoice_number || "Pending Generation") : "N/A";
                  const payStatus = isIncrease ? (company.seat_upgrade_invoice_payment_status || "Unpaid") : "N/A";
                  const invStatus = isIncrease ? (company.seat_upgrade_invoice_status_str || "Active") : "N/A";
                  const requestStatus = company.seat_upgrade_invoice_status || "PENDING";

                  const isApproveAllowed = true;

                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-semibold">{company.company_name}</TableCell>
                      <TableCell className="text-center font-medium">{company.max_employee_capacity}</TableCell>
                      <TableCell className="text-center font-medium text-amber-600">{company.seats_requested}</TableCell>
                      <TableCell className={`text-center font-bold ${isIncrease ? "text-green-600" : "text-red-600"}`}>
                        {isIncrease ? `+${changeAmount}` : `${changeAmount}`}
                      </TableCell>
                      <TableCell>{reqDate}</TableCell>
                      <TableCell className="font-mono text-xs">{invoiceNum}</TableCell>
                      <TableCell>
                        {isIncrease ? (
                          payStatus === "Paid" ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">🟢 Paid</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">🟡 Unpaid</Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isIncrease ? (
                          invStatus === "Voided" ? (
                            <Badge className="bg-red-100 text-red-800 border-red-200">🔴 Voided</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 border-green-200">🟢 Active</Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="uppercase text-xs font-mono">{requestStatus}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2 items-center">
                            <Button
                              onClick={() => handleApproveSeats(company.id)}
                              size="sm"
                              disabled={loading}
                              className={
                                loading
                                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50"
                                  : "bg-green-600 hover:bg-green-700 text-white"
                              }
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                          <Button
                            onClick={() => handleRejectSeats(company.id)}
                            variant="destructive"
                            size="sm"
                            disabled={loading}
                          >
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      </>
      )}

      {/* SECTION 2: Approved Companies */}
      <div className={`space-y-4 ${!readOnly ? "pt-4 border-t" : ""}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-800">
              <Building className="w-5 h-5" />
              Approved Companies
            </h3>
            <Badge variant="secondary" className="bg-green-100 text-green-800 font-semibold">
              {approvedCompanies.length} Active
            </Badge>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {approvedCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
            <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No approved organizations found</p>
          </div>
        ) : filteredApprovedCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
            <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No companies match your search</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Company Email</TableHead>
                  <TableHead className="text-center">Approved Capacity</TableHead>
                  <TableHead className="text-center">Scaling Status</TableHead>
                  <TableHead className="text-center">Biometric Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registration Date</TableHead>
                  {!readOnly && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApprovedCompanies.map((company) => {
                  let biometricStatus = company.biometric_status || "NOT_REQUESTED";
                  let biometricVariant = "outline";
                  let biometricLabel = "Not Requested";
                  
                  if (biometricStatus === "APPROVED") {
                    biometricLabel = "Enabled";
                    biometricVariant = "success";
                  } else if (biometricStatus === "PENDING") {
                    biometricLabel = "Pending Approval";
                    biometricVariant = "warning";
                  } else if (biometricStatus === "REJECTED") {
                    biometricLabel = "Rejected";
                    biometricVariant = "destructive";
                  } else if (biometricStatus === "DISABLED") {
                    biometricLabel = "Disabled";
                    biometricVariant = "outline";
                  }

                  return (
                    <TableRow 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleViewCompanyDetails(company)}
                    >
                      <TableCell className="font-semibold">{company.company_name}</TableCell>
                      <TableCell>{company.company_email}</TableCell>
                      <TableCell className="text-center font-medium">{company.max_employee_capacity || 0}</TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Badge 
                          variant={company.allow_future_seat_requests ? "success" : "secondary" as any}
                          className={
                            company.allow_future_seat_requests
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-800 border-gray-200"
                          }
                        >
                          {company.allow_future_seat_requests ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Badge 
                          variant={biometricVariant as any} 
                          className={
                            biometricStatus === "APPROVED" 
                              ? "bg-green-100 text-green-800 border-green-200" 
                              : biometricStatus === "PENDING" 
                                ? "bg-amber-100 text-amber-800 border-amber-200" 
                                : biometricStatus === "REJECTED"
                                  ? "bg-red-100 text-red-800 border-red-200"
                                  : "text-muted-foreground"
                          }
                        >
                          {biometricLabel}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {company.status === "suspended" ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 cursor-default">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 cursor-default">
                            Approved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(company.created_at || Date.now()).toLocaleDateString()}</TableCell>
                      {!readOnly && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end space-x-2 items-center">
                            {biometricStatus === "PENDING" && (
                              <>
                                <Button
                                  onClick={() => handleApproveBiometric(company.id)}
                                  size="sm"
                                  variant="outline"
                                  className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 flex items-center gap-1"
                                  disabled={loading}
                                >
                                  <Check className="w-4 h-4" /> Approve Bio
                                </Button>
                                <Button
                                  onClick={() => handleRejectBiometric(company.id)}
                                  size="sm"
                                  variant="outline"
                                  className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200 flex items-center gap-1"
                                  disabled={loading}
                                >
                                  <X className="w-4 h-4" /> Reject Bio
                                </Button>
                              </>
                            )}
                            {biometricStatus === "APPROVED" && (
                              <Button
                                onClick={() => handleDisableBiometric(company.id)}
                                size="sm"
                                variant="outline"
                                className="bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border-amber-200 flex items-center gap-1"
                                disabled={loading}
                              >
                                <X className="w-4 h-4" /> Disable Bio
                              </Button>
                            )}
                            
                            {company.status === "suspended" ? (
                              <Button 
                                onClick={() => handleActivate(company.id)} 
                                size="sm" 
                                variant="outline"
                                className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                                disabled={loading}
                              >
                                Activate
                              </Button>
                            ) : (
                              <Button 
                                onClick={() => handleSuspend(company.id)} 
                                size="sm" 
                                variant="outline"
                                className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
                                disabled={loading}
                              >
                                Suspend
                              </Button>
                            )}
                            <Button 
                              onClick={() => handleDeleteCompany(company.id, company.company_name)} 
                              size="sm" 
                              variant="destructive"
                              className="flex items-center gap-1"
                              disabled={loading}
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Approved Company Details</DialogTitle>
              <DialogDescription>Review organization details, documents, and employees list.</DialogDescription>
            </DialogHeader>
            {selectedCompany && (
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-base border-b pb-2">Company Information</h4>
                  <p><strong>Name:</strong> {selectedCompany.company_name}</p>
                  <p><strong>Website:</strong> {selectedCompany.company_website || "N/A"}</p>
                  <p><strong>Email:</strong> {selectedCompany.company_email}</p>
                  <p><strong>Industry:</strong> {selectedCompany.industry_type || "N/A"}</p>
                  <p><strong>GST Number:</strong> {selectedCompany.gst_number || "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-base border-b pb-2">Primary Contact</h4>
                  <p><strong>Name:</strong> {selectedCompany.admins?.[0]?.full_name || "N/A"}</p>
                  <p><strong>Email:</strong> {selectedCompany.admins?.[0]?.email || "N/A"}</p>
                  <p><strong>Mobile:</strong> {selectedCompany.admins?.[0]?.mobile || "N/A"}</p>
                </div>
                <div className="space-y-2 col-span-2">
                  <h4 className="font-semibold text-base border-b pb-2">Address</h4>
                  <p>{selectedCompany.address}, {selectedCompany.city}, {selectedCompany.state} - {selectedCompany.pincode}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-base border-b pb-2">Capacity Details</h4>
                  <p><strong>Approved Capacity:</strong> {selectedCompany.max_employee_capacity || 0}</p>
                  <p><strong>Requested Upgrades:</strong> {selectedCompany.seats_requested || 0}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-base border-b pb-2">Biometric Status</h4>
                  <p><strong>Current Status:</strong> {selectedCompany.biometric_status || "NOT_REQUESTED"}</p>
                </div>
                <div className="space-y-2 col-span-2">
                  <h4 className="font-semibold text-base border-b pb-2">Uploaded Documents</h4>
                  {selectedCompany.documents && Array.isArray(selectedCompany.documents) && selectedCompany.documents.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {selectedCompany.documents.map((doc: any, i: number) => (
                        <li key={i}>
                          <button
                            onClick={() => handleViewDocument(doc.file_path, doc.name || "document")}
                            className="text-primary hover:underline flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer align-baseline text-left font-normal"
                          >
                            <FileText className="w-4 h-4 text-muted-foreground" /> {doc.type}: {doc.name || "View File"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  )}
                </div>

                {/* Employees list in company */}
                <div className="space-y-2 col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-semibold text-base flex items-center gap-2 text-primary pb-2">
                    <Users className="w-5 h-5" />
                    Employees List ({companyEmployees.length})
                  </h4>
                  {loadingEmployees ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading employees...</p>
                  ) : companyEmployees.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No employees registered in this company yet.</p>
                  ) : (
                    <div className="rounded-md border bg-card max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email ID</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Designation</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyEmployees.map((emp: any) => (
                            <TableRow 
                              key={emp.id} 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setSelectedEmployeeDetails(emp)}
                            >
                              <TableCell className="font-semibold text-primary">{emp.full_name}</TableCell>
                              <TableCell>{emp.email}</TableCell>
                              <TableCell>{emp.department || '-'}</TableCell>
                              <TableCell>{emp.designation || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={emp.is_active ? "success" as any : "secondary" as any} className={emp.is_active ? "bg-green-100 text-green-800" : ""}>
                                  {emp.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setDetailsModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedEmployeeDetails} onOpenChange={() => setSelectedEmployeeDetails(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[9999]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Employee Profile Details
              </DialogTitle>
              <DialogDescription>
                Full enrollment details for this employee.
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
      </div>
    </div>
  );
}
