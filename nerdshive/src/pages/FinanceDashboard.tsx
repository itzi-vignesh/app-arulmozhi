import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { financeService } from '@/services/financeService';
import { InvoiceRenderer, renderInvoiceToHtml } from '@/components/InvoiceRenderer';
import { authService } from '@/services/authService';
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
import { 
  LogOut, 
  Users, 
  Building, 
  FileText, 
  Activity,
  Plus,
  Mail,
  ChevronRight,
  ChevronDown,
  Phone,
  CreditCard,
  Settings,
  LayoutDashboard,
  Clock,
  Undo,
  BarChart3,
  User,
  Search,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Lock,
  Download
} from "lucide-react";

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  // State definitions
  const [profile, setProfile] = useState<any>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyCompanyId, setVerifyCompanyId] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [txRef, setTxRef] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [seatBillingQueue, setSeatBillingQueue] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Expandable sidebar group states
  const [billingExpanded, setBillingExpanded] = useState(true);
  const [transactionsExpanded, setTransactionsExpanded] = useState(true);

  // Refined manual invoice / structural states
  const [modifyStructureOpen, setModifyStructureOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("https://pyrefly.com/logo.png");
  const [gstRateInput, setGstRateInput] = useState(18);
  const [invoiceTerms, setInvoiceTerms] = useState("Payment is due within 7 days of invoice generation.");
  const [invoiceFooter, setInvoiceFooter] = useState("Thank you for choosing Pyrefly! For support: finance@pyrefly.com");
  const [selectedCompId, setSelectedCompId] = useState("");
  const [manualPlanName, setManualPlanName] = useState("Custom Monthly Support Plan");
  const [manualBillingType, setManualBillingType] = useState("monthly");
  const [manualPricePerSeat, setManualPricePerSeat] = useState(250);
  const [manualSeats, setManualSeats] = useState(1);
  const [manualGstRate, setManualGstRate] = useState(18);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // Search/Filters states
  const [searchCust, setSearchCust] = useState("");
  const [searchComp, setSearchComp] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [searchPayment, setSearchPayment] = useState("");
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState("all");
  const [paymentFilterMethod, setPaymentFilterMethod] = useState("all");
  const [refundFilterStatus, setRefundFilterStatus] = useState("all");
  
  // Interactive Modals
  const [selectedCustDetail, setSelectedCustDetail] = useState<any>(null);
  const [selectedCompDetail, setSelectedCompDetail] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  
  // Seat Billing states
  const [selectedSeatComp, setSelectedSeatComp] = useState<any>(null);
  const [calculatedCharges, setCalculatedCharges] = useState<any>(null);

  // Refund generation states
  const [requestRefundOpen, setRequestRefundOpen] = useState(false);
  const [refundInvoiceId, setRefundInvoiceId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Profile Change Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Refresh helper functions
  const fetchDashboardData = async () => {
    try {
      const data = await financeService.getFinanceDashboard();
      setDashboardData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await financeService.getFinanceCustomers();
      setCustomers(data);
      return data;
    } catch (e) {
      return [];
    }
  };

  const fetchPricingPlans = async () => {
    try {
      const [custRes, corpRes] = await Promise.all([
        apiClient.get('/pricing/customer'),
        apiClient.get('/pricing/corporate')
      ]);
      const combined = [...custRes.data, ...corpRes.data];
      setPricingPlans(combined);
      return combined;
    } catch (e) {
      console.error("Failed to fetch pricing plans:", e);
      return [];
    }
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = pricingPlans.find(p => p.id === planId);
    if (plan) {
      setManualPlanName(plan.plan_name);
      setManualPricePerSeat(parseFloat(plan.price) || 0);
      
      // Auto-fill billing type
      let mappedBilling = "monthly";
      if (plan.billing_type === "day") mappedBilling = "daily";
      else if (plan.billing_type === "week") mappedBilling = "weekly";
      else if (plan.billing_type === "month" || plan.billing_type === "seat") mappedBilling = "monthly";
      else mappedBilling = plan.billing_type;
      
      setManualBillingType(mappedBilling);
    }
  };
  const handleCompanyOrCustomerChange = (id: string, customPlansList?: any[]) => {
    setSelectedCompId(id);
    
    if (!id) {
      setSelectedPlanId("");
      setManualPlanName("");
      setManualPricePerSeat(0);
      setManualBillingType("monthly");
      setManualSeats(0);
      return;
    }
    
    const company = companies.find(c => c.id === id);
    const isCompany = !!company;
    const isIndividual = customers.some(cust => (cust.company_id || cust.id) === id);
    
    if (company) {
      setManualSeats(parseInt(company.purchased_seats) || 1);
    } else {
      setManualSeats(1);
    }

    const plansSource = customPlansList || pricingPlans;
    const filtered = plansSource.filter(p => {
      if (isCompany) return p.category === "corporate";
      if (isIndividual) return p.category === "customer";
      return false;
    });

    if (filtered.length > 0) {
      const plan = filtered[0];
      setSelectedPlanId(plan.id);
      setManualPlanName(plan.plan_name);
      setManualPricePerSeat(parseFloat(plan.price) || 0);
      
      let mappedBilling = "monthly";
      if (plan.billing_type === "day") mappedBilling = "daily";
      else if (plan.billing_type === "week") mappedBilling = "weekly";
      else if (plan.billing_type === "month" || plan.billing_type === "seat") mappedBilling = "monthly";
      else mappedBilling = plan.billing_type;
      
      setManualBillingType(mappedBilling);
    } else {
      setSelectedPlanId("");
      setManualPlanName("");
      setManualPricePerSeat(0);
      setManualBillingType("monthly");
    }
  };

  const fetchCompanies = async () => {
    try {
      const data = await financeService.getFinanceCompanies();
      setCompanies(data);
      return data;
    } catch (e) {
      return [];
    }
  };

  const fetchInvoices = async (statusOverride?: string) => {
    try {
      const activeStatus = statusOverride !== undefined ? statusOverride : invoiceFilterStatus;
      const statusParam = activeStatus !== "all" ? activeStatus : undefined;
      const data = await financeService.getFinanceInvoices({ status: statusParam });
      setInvoices(data);
    } catch (e) {}
  };

  const fetchPayments = async () => {
    try {
      const data = await financeService.getFinancePayments();
      setPayments(data);
    } catch (e) {}
  };


  const fetchSeatBillingQueue = async () => {
    try {
      const data = await financeService.getSeatBillingQueue();
      setSeatBillingQueue(data);
    } catch (e) {}
  };

  const fetchRefunds = async () => {
    try {
      const data = await financeService.getFinanceRefunds();
      setRefunds(data);
    } catch (e) {}
  };

  const fetchReports = async () => {
    try {
      const data = await financeService.getFinanceReports();
      setReports(data);
    } catch (e) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await financeService.getFinanceAuditLogs();
      setAuditLogs(data);
    } catch (e) {}
  };

  const fetchProfile = async () => {
    try {
      const data = await financeService.getFinanceMe();
      setProfile(data);
    } catch (e) {}
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (val === "dashboard") fetchDashboardData();
    else if (val === "customer_billing") fetchCustomers();
    else if (val === "corporate_billing") fetchCompanies();
    else if (val === "invoices") fetchInvoices();
    else if (val === "payments") fetchPayments();
    else if (val === "seat_billing") fetchSeatBillingQueue();
    else if (val === "refunds") fetchRefunds();
    else if (val === "financial_reports") fetchReports();
    else if (val === "audit_logs") fetchAuditLogs();
    else if (val === "profile") fetchProfile();
  };

  const [templateConfig, setTemplateConfig] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'a4' | 'mobile'>('desktop');

  const fetchTemplateConfig = async () => {
    try {
      const response = await apiClient.get('/content_sections');
      const found = response.data.find((sec: any) => sec.section === 'invoice_template');
      if (found) {
        const parsed = JSON.parse(found.content);
        setTemplateConfig(parsed);
        if (parsed.branding?.logoUrl) setLogoUrl(parsed.branding.logoUrl);
        if (parsed.tax?.percentage) setGstRateInput(parsed.tax.percentage);
        if (parsed.terms) setInvoiceTerms(parsed.terms);
        if (parsed.footer?.text) setInvoiceFooter(parsed.footer.text);
      } else {
        setTemplateConfig({
          business: {
            name: "NerdShive Workspace Private Limited",
            address: "Sector 5, HSR Layout, Bangalore, Karnataka - 560102",
            phone: "+91 99999 88888",
            email: "finance@nerdshive.com",
            website: "www.nerdshive.com",
            gstin: "29AAAAA1111A1Z1",
            pan: "ABCDE1234F"
          },
          branding: {
            logoUrl: "https://pyrefly.com/logo.png",
            logoWidth: 64,
            logoHeight: 64,
            logoUploaded: false,
            uploadedLogo: "",
            primaryColor: "#d45b25",
            accentColor: "#f97316",
            headerColor: "#ffffff",
            footerColor: "#f8fafc",
            theme: "classic"
          },
          invoice: {
            prefix: "INV-",
            startingNumber: 1,
            numberPadding: 5,
            dateFormat: "DD/MM/YYYY",
            dueDateOffset: 7,
            includeFinancialYear: false
          },
          currency: {
            symbol: "₹",
            code: "INR",
            precision: 2
          },
          tax: {
            name: "GST",
            percentage: 18.0,
            included: false
          },
          fees: [],
          discounts: [],
          payment: {
            bankName: "ICICI Bank",
            accountNumber: "1234567890",
            accountHolder: "NerdShive Workspace Pvt Ltd",
            ifsc: "ICIC0001234",
            upiId: "nerdshive@upi",
            paymentInstructions: ""
          },
          terms: "Payment is due within 7 days of invoice generation.",
          footer: {
            text: "Thank you for choosing NerdShive! For support: finance@nerdshive.com",
            copyright: "© 2026 NerdShive Workspace",
            supportEmail: "support@nerdshive.com",
            supportPhone: "+91 99999 88888"
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      await apiClient.post('/content_sections', {
        section: 'invoice_template',
        content: JSON.stringify(templateConfig)
      });
      toast({ title: "Template Saved", description: "Invoice structural modifications saved successfully." });
      setModifyStructureOpen(false);
      fetchTemplateConfig();
    } catch (err: any) {
      toast({ 
        title: "Validation Failed", 
        description: err.response?.data?.detail || "Please verify your input fields.", 
        variant: "destructive" 
      });
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchProfile();
    fetchTemplateConfig();
    fetchCompanies();
    fetchCustomers();
    fetchPricingPlans();
  }, []);

  useEffect(() => {
    if (activeTab === "customer_billing" || activeTab === "corporate_billing") {
      setBillingExpanded(true);
    }
    if (activeTab === "invoices" || activeTab === "payments") {
      setTransactionsExpanded(true);
    }
  }, [activeTab]);

  // Action Handlers
  const handleViewInvoiceById = async (invoiceId: string) => {
    try {
      const response = await apiClient.get(`/invoices/${invoiceId}`);
      setSelectedInvoice(response.data);
    } catch (e) {
      toast({ title: "Fetch Failed", description: "Could not load invoice details.", variant: "destructive" });
    }
  };

  const handleViewTransaction = async (p: any) => {
    if (p.type === "corporate" && p.id) {
      handleViewInvoiceById(p.id);
    } else {
      setSelectedTransaction(p);
    }
  };

  const handleVoidInvoiceConfirm = async () => {
    if (!voidReason.trim()) {
      toast({ title: "Reason Required", description: "Please enter a reason for voiding this invoice.", variant: "destructive" });
      return;
    }
    try {
      await financeService.voidInvoice(voidTargetId, voidReason);
      toast({ title: "Invoice Voided", description: "Invoice status updated to voided successfully." });
      setVoidDialogOpen(false);
      setVoidTargetId("");
      setVoidReason("");
      fetchInvoices();
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" });
    }
  };

  const handlePrintInvoice = (inv: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(renderInvoiceToHtml(inv));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadInvoice = (inv: any) => {
    const htmlContent = renderInvoiceToHtml(inv);
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${inv.invoice_number || inv.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateInvoice = async (companyId: string) => {
    try {
      const res = await financeService.generateSeatUpgradeInvoice(companyId);
      toast({ title: "Invoice Generated", description: `Seat Upgrade Invoice ${res.invoice_number} created successfully.` });
      fetchSeatBillingQueue();
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.response?.data?.detail || e.message, variant: "destructive" });
    }
  };

  const handleCalculateCharges = async (companyId: string) => {
    try {
      const data = await financeService.calculateSeatCharges(companyId);
      setCalculatedCharges(data);
    } catch (e: any) {
      toast({ title: "Calculation Failed", description: e.response?.data?.detail || e.message, variant: "destructive" });
    }
  };

  const handleApproveSeatBilling = (companyId: string) => {
    setVerifyCompanyId(companyId);
    setPayMethod("bank_transfer");
    setTxRef("");
    setVerifyNotes("");
    setVerifyModalOpen(true);
  };

  const handleRejectSeatBilling = async (companyId: string) => {
    try {
      await financeService.rejectSeatBilling(companyId);
      toast({ title: "Upgrade Rejected", description: "Seat request has been rejected." });
      setSelectedSeatComp(null);
      setCalculatedCharges(null);
      fetchSeatBillingQueue();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCreateRefundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeService.requestRefund({
        invoice_id: refundInvoiceId,
        amount: parseFloat(refundAmount),
        reason: refundReason
      });
      toast({ title: "Refund Request Created", description: "Your refund request is submitted for approval." });
      setRequestRefundOpen(false);
      setRefundInvoiceId("");
      setRefundAmount("");
      setRefundReason("");
      fetchRefunds();
    } catch (e: any) {
      toast({ title: "Submission Failed", description: e.response?.data?.detail || e.message, variant: "destructive" });
    }
  };

  const handleApproveRefund = async (refundId: string) => {
    try {
      await financeService.approveRefund(refundId);
      toast({ title: "Refund Approved", description: "Refund request approved and associated invoice cancelled." });
      fetchRefunds();
    } catch (e: any) {
      toast({ title: "Approval Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRejectRefund = async (refundId: string) => {
    try {
      await financeService.rejectRefund(refundId);
      toast({ title: "Refund Rejected", description: "Refund status updated to rejected." });
      fetchRefunds();
    } catch (e: any) {
      toast({ title: "Rejection Failed", description: e.message, variant: "destructive" });
    }
  };



  const handleSuspendCustomer = async (userId: string) => {
    try {
      await financeService.suspendCustomerSubscription(userId);
      toast({ title: "Subscription Suspended", description: "Customer active plan has been suspended." });
      fetchCustomers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleResumeCustomer = async (userId: string) => {
    try {
      await financeService.resumeCustomerSubscription(userId);
      toast({ title: "Subscription Resumed", description: "Customer active plan has been resumed." });
      fetchCustomers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords Do Not Match", variant: "destructive" });
      return;
    }
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast({ title: "Password Updated", description: "Your login credentials have been updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.response?.data?.detail || e.message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate("/login");
  };

  const exportReportCSV = (reportName: string, headers: string[], dataList: any[]) => {
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    dataList.forEach(item => {
      let row = headers.map(h => {
        let val = item[h.toLowerCase().replace(/ /g, "_")];
        return typeof val === "string" ? `"${val}"` : val;
      });
      csvContent += row.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AuthGuard requiredRole="finance">
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex flex-col">
        {/* Header */}
        <header className="bg-card border-b shadow-card">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <img 
                  src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" 
                  alt="Nerdshive" 
                  className="h-16 w-auto object-contain" 
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Finance Dashboard</h1>
                <p className="text-xs text-muted-foreground">Manage collections, invoices, seat requests, and billing records</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => navigate("/settings")} variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Workspace Shell */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0 bg-card rounded-xl border p-4 shadow-card flex flex-col space-y-4">
            <div>
              <h2 className="text-xs font-bold text-muted-foreground uppercase px-3 py-2">Finance Modules</h2>
            </div>
            
            <nav className="flex flex-col space-y-4">
              <div className="space-y-1">
                <button
                  onClick={() => handleTabChange("dashboard")}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "dashboard"
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
              </div>

              {/* Group 2: Billing */}
              <div className="space-y-1">
                <button
                  onClick={() => setBillingExpanded(!billingExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "customer_billing" || activeTab === "corporate_billing"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Building className="w-4 h-4" />
                    <span>Billing</span>
                  </div>
                  {billingExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {billingExpanded && (
                  <div className="pl-6 pt-1 flex flex-col space-y-1 border-l-2 border-muted ml-5">
                    <button
                      onClick={() => handleTabChange("customer_billing")}
                      className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === "customer_billing"
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Customer Billing</span>
                    </button>
                    <button
                      onClick={() => handleTabChange("corporate_billing")}
                      className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === "corporate_billing"
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Corporate Billing</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Group 3: Transactions */}
              <div className="space-y-1">
                <button
                  onClick={() => setTransactionsExpanded(!transactionsExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "invoices" || activeTab === "payments"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4" />
                    <span>Transactions</span>
                  </div>
                  {transactionsExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {transactionsExpanded && (
                  <div className="pl-6 pt-1 flex flex-col space-y-1 border-l-2 border-muted ml-5">
                    <button
                      onClick={() => handleTabChange("invoices")}
                      className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === "invoices"
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Invoices</span>
                    </button>
                    <button
                      onClick={() => handleTabChange("payments")}
                      className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === "payments"
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Payments Log</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Group 4: Audit Logs */}
              <div className="space-y-1">
                <button
                  onClick={() => handleTabChange("audit_logs")}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "audit_logs"
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Audit Logs</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* Tab Pages */}
          <main className="flex-1 bg-card rounded-xl border p-6 shadow-card min-h-[500px]">
            
            {/* 1. Dashboard Overview */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold">Billing Overview</h3>
                  <p className="text-sm text-muted-foreground">Real-time collections performance and invoice trackers</p>
                </div>
                
                {/* Stats cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: "Today's Collections", value: `₹${dashboardData?.metrics?.todays_collections?.toLocaleString() || 0}`, desc: "Direct cash/UPI/Bank payments today", color: "text-green-600" },
                    { title: "Monthly Revenue", value: `₹${dashboardData?.metrics?.monthly_revenue?.toLocaleString() || 0}`, desc: "Total paid bookings this calendar month", color: "text-blue-600" },
                    { title: "Pending Payments", value: dashboardData?.metrics?.pending_payments || 0, desc: "Awaiting payment verification logs", color: "text-amber-600" },
                    { title: "Overdue Invoices", value: dashboardData?.metrics?.overdue_invoices || 0, desc: "Unpaid corporate seat balances past due", color: "text-red-600" },
                    { title: "Active Subscriptions", value: dashboardData?.metrics?.active_subscriptions || 0, desc: "Active customer plans & corporate seats", color: "text-indigo-600" },
                    { title: "Invoices Generated Today", value: dashboardData?.metrics?.invoices_generated_today || 0, desc: "Newly issued invoices today", color: "text-cyan-600" },
                    { title: "Upcoming Renewals", value: dashboardData?.metrics?.upcoming_renewals || 0, desc: "Customer renewals in the next 7 days", color: "text-purple-600" },
                    { title: "Outstanding Amount", value: `₹${dashboardData?.metrics?.outstanding_amount?.toLocaleString() || 0}`, desc: "Total sum of all unpaid bills", color: "text-rose-600" }
                  ].map((stat, idx) => (
                    <Card key={idx} className="shadow-sm">
                      <CardHeader className="py-2.5">
                        <CardDescription className="text-xs font-bold uppercase">{stat.title}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">{stat.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Sub-grids */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Invoices */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5"><FileText className="w-4 h-4" /> Recent Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(!dashboardData?.recent_invoices || dashboardData.recent_invoices.length === 0) ? (
                        <p className="text-xs text-muted-foreground">No recent invoices.</p>
                      ) : (
                        <div className="space-y-3">
                          {dashboardData.recent_invoices.map((inv: any) => (
                            <div 
                              key={inv.id} 
                              className="flex justify-between items-center text-xs border-b pb-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 p-1.5 rounded transition-colors"
                              onClick={() => handleViewInvoiceById(inv.id)}
                            >
                              <div>
                                <p className="font-bold text-blue-600 hover:underline">{inv.invoice_number}</p>
                                <p className="text-muted-foreground text-[10px]">{inv.company_name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">₹{inv.amount}</p>
                                <Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Payments */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(!dashboardData?.recent_payments || dashboardData.recent_payments.length === 0) ? (
                        <p className="text-xs text-muted-foreground">No transactions registered today.</p>
                      ) : (
                        <div className="space-y-3">
                          {dashboardData.recent_payments.map((p: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs border-b pb-2">
                              <div>
                                <p className="font-semibold">{p.entity}</p>
                                <p className="text-[10px] text-muted-foreground">{p.type} • {p.method}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">+₹{p.amount}</p>
                                <p className="text-[9px] text-muted-foreground">{new Date(p.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* 2. Customer Billing */}
            {activeTab === "customer_billing" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold">Individual Customer Billing</h3>
                    <p className="text-xs text-muted-foreground">Review plan pricing and renewal schedules for members</p>
                  </div>
                  <Input
                    placeholder="Search by name or email..."
                    value={searchCust}
                    onChange={(e) => setSearchCust(e.target.value)}
                    className="max-w-xs h-9"
                  />
                </div>

                <div className="border rounded-md overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Current Plan</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Renewal Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers
                        .filter(c => c.name.toLowerCase().includes(searchCust.toLowerCase()) || c.email.toLowerCase().includes(searchCust.toLowerCase()))
                        .map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-semibold">
                              <p>{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{c.email}</p>
                            </TableCell>
                            <TableCell className="capitalize">{c.current_plan}</TableCell>
                            <TableCell>₹{c.amount}</TableCell>
                            <TableCell>{c.renewal_date === "N/A" ? "N/A" : new Date(c.renewal_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {c.payment_status === "Unpaid" ? (
                                <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 whitespace-nowrap inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                                  Unpaid
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 whitespace-nowrap inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                                  Paid
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>


              </div>
            )}

            {/* 3. Corporate Billing */}
            {activeTab === "corporate_billing" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold">Corporate Accounts Billing</h3>
                    <p className="text-xs text-muted-foreground">Manage organization seats, monthly billing metrics, and rates</p>
                  </div>
                  <Input
                    placeholder="Search company..."
                    value={searchComp}
                    onChange={(e) => setSearchComp(e.target.value)}
                    className="max-w-xs h-9"
                  />
                </div>

                <div className="border rounded-md overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-center">Seats</TableHead>
                        <TableHead className="text-center">Staff Count</TableHead>
                        <TableHead className="text-center">Available Seats</TableHead>
                        <TableHead>Monthly Rate</TableHead>
                        <TableHead>Next Renewal</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies
                        .filter(c => c.company.toLowerCase().includes(searchComp.toLowerCase()))
                        .map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-semibold">{c.company}</TableCell>
                            <TableCell>{c.current_plan}</TableCell>
                            <TableCell className="text-center">{c.purchased_seats}</TableCell>
                            <TableCell className="text-center">{c.employees_registered}</TableCell>
                            <TableCell className="text-center">{c.available_seats}</TableCell>
                            <TableCell>₹{c.monthly_charge.toLocaleString()}</TableCell>
                            <TableCell>{c.next_renewal === "N/A" ? "N/A" : new Date(c.next_renewal).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {c.billing_status === "Paid" ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 whitespace-nowrap inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                                  Paid
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 whitespace-nowrap inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                                  Unpaid
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 4. Invoices */}
            {activeTab === "invoices" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div>
                      <h3 className="text-lg font-bold">Corporate Invoices</h3>
                      <p className="text-xs text-muted-foreground">Review, pay, or cancel issued invoices</p>
                    </div>
                    <Input
                      placeholder="Search invoice number, owner, plan..."
                      value={searchInvoice}
                      onChange={(e) => setSearchInvoice(e.target.value)}
                      className="max-w-xs h-9 ml-4"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => setModifyStructureOpen(true)} variant="outline" size="sm">
                      Modify Structure
                    </Button>
                    <Button onClick={async () => {
                      await Promise.all([
                        fetchCompanies(),
                        fetchCustomers(),
                        fetchPricingPlans()
                      ]);
                      
                      setSelectedCompId("");
                      setSelectedPlanId("");
                      setManualPlanName("");
                      setManualPricePerSeat(0);
                      setManualSeats(0);
                      setManualBillingType("monthly");
                      
                      setCreateInvoiceOpen(true);
                    }} size="sm">
                      Create Invoice
                    </Button>
                    <Select value={invoiceFilterStatus} onValueChange={(val) => { 
                      setInvoiceFilterStatus(val); 
                      fetchInvoices(val); 
                    }}>
                      <SelectTrigger className="w-36 h-9">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Invoices</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-md overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                  <Table className="w-full text-[11px] table-fixed md:table-auto">
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="px-1.5 h-8 font-bold">Invoice #</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Customer / Company</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Invoice Type</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Amount</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">GST</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Issue Date</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Due Date</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Payment Date</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Payment Status</TableHead>
                        <TableHead className="px-1.5 h-8 font-bold">Invoice Status</TableHead>
                        <TableHead className="text-right px-1.5 h-8 font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filtered = invoices.filter(inv => {
                          const query = searchInvoice.toLowerCase().trim();
                          if (!query) return true;
                          const ownerName = inv.owner?.name || inv.company_name || "";
                          return (
                            inv.invoice_number?.toLowerCase().includes(query) ||
                            ownerName.toLowerCase().includes(query) ||
                            inv.plan_name?.toLowerCase().includes(query)
                          );
                        });
                        if (filtered.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-xs">
                                No invoices found matching "{searchInvoice}"
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return filtered.map(inv => {
                          const isVoided = inv.invoice_status === "voided";
                          return (
                            <TableRow key={inv.id} className="h-8">
                              <TableCell 
                                className="font-bold cursor-pointer text-blue-600 hover:text-blue-800 hover:underline px-1.5 py-1 h-8"
                                onClick={() => setSelectedInvoice(inv)}
                              >
                                {inv.invoice_number || `INV-${inv.id.slice(0, 5).toUpperCase()}`}
                              </TableCell>
                              <TableCell className="px-1.5 py-1 h-8 font-medium truncate max-w-[120px]" title={inv.owner?.name || inv.company_name || "N/A"}>
                                {inv.owner?.name || inv.company_name || "N/A"}
                              </TableCell>
                              <TableCell className="capitalize px-1.5 py-1 h-8 truncate max-w-[100px]" title={inv.plan_name}>{inv.plan_name}</TableCell>
                              <TableCell className="font-bold px-1.5 py-1 h-8">₹{parseFloat(inv.total_amount).toFixed(2)}</TableCell>
                              <TableCell className="px-1.5 py-1 h-8">₹{parseFloat(inv.gst_amount).toFixed(2)}</TableCell>
                              <TableCell className="px-1.5 py-1 h-8">{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</TableCell>
                              <TableCell className="px-1.5 py-1 h-8">{new Date(inv.due_date).toLocaleDateString('en-IN')}</TableCell>
                              <TableCell className="px-1.5 py-1 h-8">{inv.payment_date ? new Date(inv.payment_date).toLocaleDateString('en-IN') : "-"}</TableCell>
                              <TableCell className="px-1.5 py-1 h-8">
                                {inv.status === "paid" ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-1.5 py-0.5 hover:bg-green-100 whitespace-nowrap inline-flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-green-600 shrink-0" />
                                    Paid
                                  </Badge>
                                ) : isVoided ? (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5 py-0.5 hover:bg-red-100 whitespace-nowrap inline-flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                                    Voided
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0.5 hover:bg-amber-100 whitespace-nowrap inline-flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0" />
                                    Unpaid
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="px-1.5 py-1 h-8">
                                {isVoided ? (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5 py-0 hover:bg-red-100">Voided</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-1.5 py-0 hover:bg-green-100">Active</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right px-1.5 py-1 h-8">
                                <div className="flex justify-end items-center gap-1.5">
                                  {!isVoided ? (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="text-red-500 hover:bg-red-50 border-red-200 text-[10px] h-6 px-1.5 py-0" 
                                      onClick={() => {
                                        setVoidTargetId(inv.id);
                                        setVoidReason("");
                                        setVoidDialogOpen(true);
                                      }}
                                    >
                                      Void
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic">Voided</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>


                {/* Modify Invoice Structure Dialog */}
                <Dialog open={modifyStructureOpen} onOpenChange={setModifyStructureOpen}>
                  <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Modify Invoice Template System</DialogTitle>
                      <DialogDescription>Customize layout themes, rich text sections, currency, and numbering settings for historical and future invoices.</DialogDescription>
                    </DialogHeader>
                    {templateConfig && (
                      <div className="flex flex-col lg:flex-row gap-6 py-2 text-xs">
                        {/* LEFT COLUMN: EDIT FORM */}
                        <div className="flex-1 space-y-4 max-h-[70vh] overflow-y-auto pr-3">
                          {/* Section: Business Info */}
                          <div className="border p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">Business Profile</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label>Business Name</Label>
                                <Input value={templateConfig.business?.name || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    business: { ...prev.business, name: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>GSTIN</Label>
                                <Input value={templateConfig.business?.gstin || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    business: { ...prev.business, gstin: val }
                                  }));
                                }} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label>Address</Label>
                              <Input value={templateConfig.business?.address || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    business: { ...prev.business, address: val }
                                  }));
                              }} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label>Phone</Label>
                                <Input value={templateConfig.business?.phone || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    business: { ...prev.business, phone: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>Email</Label>
                                <Input value={templateConfig.business?.email || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    business: { ...prev.business, email: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>Website</Label>
                                <Input value={templateConfig.business?.website || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    business: { ...prev.business, website: val }
                                  }));
                                }} />
                              </div>
                            </div>
                          </div>

                          {/* Section: Branding & Theme */}
                          <div className="border p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">Branding & Theme Layout</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label>Layout Theme</Label>
                                <select 
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  value={templateConfig.branding?.theme || 'classic'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTemplateConfig((prev: any) => ({
                                      ...prev,
                                      branding: { ...prev.branding, theme: val }
                                    }));
                                  }}
                                >
                                  <option value="classic">Classic</option>
                                  <option value="modern">Modern (Asymmetric Gradients)</option>
                                  <option value="minimal">Minimal (Clean Rules)</option>
                                  <option value="corporate">Corporate (Structured Columns)</option>
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label>Primary Color</Label>
                                  <div className="flex space-x-1.5">
                                    <input type="color" className="w-8 h-8 rounded border p-0 cursor-pointer" value={templateConfig.branding?.primaryColor || '#d45b25'} onChange={(e) => {
                                      const val = e.target.value;
                                      setTemplateConfig((prev: any) => ({
                                        ...prev,
                                        branding: { ...prev.branding, primaryColor: val }
                                      }));
                                    }} />
                                    <Input className="h-8 py-1 text-[10px]" value={templateConfig.branding?.primaryColor || '#d45b25'} onChange={(e) => {
                                      const val = e.target.value;
                                      setTemplateConfig((prev: any) => ({
                                        ...prev,
                                        branding: { ...prev.branding, primaryColor: val }
                                      }));
                                    }} />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label>Accent Color</Label>
                                  <div className="flex space-x-1.5">
                                    <input type="color" className="w-8 h-8 rounded border p-0 cursor-pointer" value={templateConfig.branding?.accentColor || '#f97316'} onChange={(e) => {
                                      const val = e.target.value;
                                      setTemplateConfig((prev: any) => ({
                                        ...prev,
                                        branding: { ...prev.branding, accentColor: val }
                                      }));
                                    }} />
                                    <Input className="h-8 py-1 text-[10px]" value={templateConfig.branding?.accentColor || '#f97316'} onChange={(e) => {
                                      const val = e.target.value;
                                      setTemplateConfig((prev: any) => ({
                                        ...prev,
                                        branding: { ...prev.branding, accentColor: val }
                                      }));
                                    }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2 border-t pt-2 mt-2">
                              <Label className="font-semibold">Logo Settings</Label>
                              <div className="grid grid-cols-2 gap-3 items-end">
                                <div className="space-y-1">
                                  <Label>Upload Logo File</Label>
                                  <input type="file" accept="image/*" className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setTemplateConfig((prev: any) => ({
                                        ...prev,
                                        branding: {
                                          ...prev.branding,
                                          logoUploaded: true,
                                          uploadedLogo: reader.result as string
                                        }
                                      }));
                                    };
                                    reader.readAsDataURL(file);
                                  }} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Logo URL (Fallback)</Label>
                                  <Input value={templateConfig.branding?.logoUrl || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setTemplateConfig((prev: any) => ({
                                      ...prev,
                                      branding: { ...prev.branding, logoUrl: val }
                                    }));
                                  }} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1">
                                  <Label>Logo Width (px)</Label>
                                  <Input type="number" value={templateConfig.branding?.logoWidth || 64} onChange={(e) => {
                                    const val = parseInt(e.target.value) || 64;
                                    setTemplateConfig((prev: any) => ({
                                      ...prev,
                                      branding: { ...prev.branding, logoWidth: val }
                                    }));
                                  }} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Logo Height (px)</Label>
                                  <Input type="number" value={templateConfig.branding?.logoHeight || 64} onChange={(e) => {
                                    const val = parseInt(e.target.value) || 64;
                                    setTemplateConfig((prev: any) => ({
                                      ...prev,
                                      branding: { ...prev.branding, logoHeight: val }
                                    }));
                                  }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Section: Currency & Numbering */}
                          <div className="border p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">Currency & Sequence Settings</h4>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label>Currency Symbol</Label>
                                <Input value={templateConfig.currency?.symbol || '₹'} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    currency: { ...prev.currency, symbol: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>Currency Code</Label>
                                <Input value={templateConfig.currency?.code || 'INR'} onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    currency: { ...prev.currency, code: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>Precision (Decimals)</Label>
                                <Input type="number" value={templateConfig.currency?.precision ?? 2} onChange={(e) => {
                                  const val = parseInt(e.target.value) ?? 2;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    currency: { ...prev.currency, precision: val }
                                  }));
                                }} />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 border-t pt-2 mt-2">
                              <div className="space-y-1">
                                <Label>Invoice Prefix</Label>
                                <Input value={templateConfig.invoice?.prefix || 'INV-'} onChange={(e) => {
                                  const val = e.target.value;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    invoice: { ...prev.invoice, prefix: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>Number Padding</Label>
                                <Input type="number" value={templateConfig.invoice?.numberPadding || 5} onChange={(e) => {
                                  const val = parseInt(e.target.value) || 5;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    invoice: { ...prev.invoice, numberPadding: val }
                                  }));
                                }} />
                              </div>
                              <div className="space-y-1">
                                <Label>Due Offset (Days)</Label>
                                <Input type="number" value={templateConfig.invoice?.dueDateOffset || 7} onChange={(e) => {
                                  const val = parseInt(e.target.value) || 7;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    invoice: { ...prev.invoice, dueDateOffset: val }
                                  }));
                                }} />
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                              <input type="checkbox" id="includeFY" checked={templateConfig.invoice?.includeFinancialYear || false} onChange={(e) => {
                                const val = e.target.checked;
                                setTemplateConfig((prev: any) => ({
                                  ...prev,
                                  invoice: { ...prev.invoice, includeFinancialYear: val }
                                }));
                              }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                              <Label htmlFor="includeFY" className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">Include Financial Year in Prefix (e.g. INV-2026-00100)</Label>
                            </div>
                          </div>

                          {/* Section: Taxes & default items */}
                          <div className="border p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">Taxes & default values</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label>GST Percentage (%)</Label>
                                <Input type="number" value={templateConfig.tax?.percentage || 18.0} onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    tax: { ...prev.tax, percentage: val }
                                  }));
                                }} />
                              </div>
                              <div className="flex items-center space-x-2 pt-5">
                                <input type="checkbox" id="taxIncluded" checked={templateConfig.tax?.included || false} onChange={(e) => {
                                  const val = e.target.checked;
                                  setTemplateConfig((prev: any) => ({
                                    ...prev,
                                    tax: { ...prev.tax, included: val }
                                  }));
                                }} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                                <Label htmlFor="taxIncluded" className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">Prices are Tax-Inclusive</Label>
                              </div>
                            </div>
                          </div>

                          {/* Section: Rich Text Fields */}
                          <div className="border p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900 space-y-3">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">Rich Text & Instructions (Markdown supported)</h4>
                            <div className="space-y-1">
                              <Label>Terms & Conditions</Label>
                              <Textarea value={templateConfig.terms || ''} onChange={(e) => {
                                const val = e.target.value;
                                setTemplateConfig((prev: any) => ({
                                  ...prev,
                                  terms: val
                                }));
                              }} rows={3} placeholder="Bold text via **bold** and lists via * or - item." />
                            </div>
                            <div className="space-y-1">
                              <Label>Invoice Footer Notes</Label>
                              <Textarea value={templateConfig.footer?.text || ''} onChange={(e) => {
                                const val = e.target.value;
                                setTemplateConfig((prev: any) => ({
                                  ...prev,
                                  footer: { ...prev.footer, text: val }
                                }));
                              }} rows={2} placeholder="Add supportive copyrights and remarks." />
                            </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN: LIVE PREVIEW PANEL */}
                        <div className="w-full lg:w-[480px] xl:w-[540px] border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-4 space-y-4">
                          <div className="flex justify-between items-center bg-slate-100 dark:bg-zinc-950 p-2.5 rounded-lg border">
                            <span className="font-bold text-slate-700 dark:text-slate-300">Live Preview Panel</span>
                            <div className="flex space-x-1 border rounded bg-white dark:bg-zinc-900 p-0.5 text-[10px]">
                              <Button variant={previewMode === 'desktop' ? 'default' : 'ghost'} className={`px-2 h-6 text-[10px] ${previewMode === 'desktop' ? 'bg-primary text-white' : ''}`} onClick={() => setPreviewMode('desktop')}>Desktop</Button>
                              <Button variant={previewMode === 'a4' ? 'default' : 'ghost'} className={`px-2 h-6 text-[10px] ${previewMode === 'a4' ? 'bg-primary text-white' : ''}`} onClick={() => setPreviewMode('a4')}>A4 Print</Button>
                              <Button variant={previewMode === 'mobile' ? 'default' : 'ghost'} className={`px-2 h-6 text-[10px] ${previewMode === 'mobile' ? 'bg-primary text-white' : ''}`} onClick={() => setPreviewMode('mobile')}>Mobile PDF</Button>
                            </div>
                          </div>
                          
                          <div className="border rounded-lg bg-slate-100 dark:bg-zinc-950 p-2 overflow-auto max-h-[64vh] flex justify-center items-start">
                            {previewMode === 'desktop' && (
                              <div className="w-full min-w-[320px]">
                                <InvoiceRenderer 
                                  previewTemplate={templateConfig} 
                                  invoice={{
                                    invoice_number: `${templateConfig.invoice?.prefix || 'INV-'}${String(145).padStart(templateConfig.invoice?.numberPadding || 5, '0')}`,
                                    invoice_date: new Date().toISOString(),
                                    due_date: new Date(Date.now() + (templateConfig.invoice?.dueDateOffset || 7) * 24 * 60 * 60 * 1000).toISOString(),
                                    company_name: "Acme Corporates Inc.",
                                    company_id: "acme-1234",
                                    company_gst_number: "29BBBBB2222B2Z2",
                                    plan_name: "Premium Coworking Access",
                                    billing_type: "monthly",
                                    seats: 8,
                                    price_per_seat: 300,
                                    subtotal: 2400,
                                    gst_rate: templateConfig.tax?.percentage || 18,
                                    gst_amount: 432,
                                    total_amount: 2832,
                                    status: "unpaid"
                                  }} 
                                  mode="desktop" 
                                />
                              </div>
                            )}
                            {previewMode === 'a4' && (
                              <div className="origin-top scale-[0.55] w-[210mm] h-[297mm] -mb-[120mm]">
                                <InvoiceRenderer 
                                  previewTemplate={templateConfig} 
                                  invoice={{
                                    invoice_number: `${templateConfig.invoice?.prefix || 'INV-'}${String(145).padStart(templateConfig.invoice?.numberPadding || 5, '0')}`,
                                    invoice_date: new Date().toISOString(),
                                    due_date: new Date(Date.now() + (templateConfig.invoice?.dueDateOffset || 7) * 24 * 60 * 60 * 1000).toISOString(),
                                    company_name: "Acme Corporates Inc.",
                                    company_id: "acme-1234",
                                    company_gst_number: "29BBBBB2222B2Z2",
                                    plan_name: "Premium Coworking Access",
                                    billing_type: "monthly",
                                    seats: 8,
                                    price_per_seat: 300,
                                    subtotal: 2400,
                                    gst_rate: templateConfig.tax?.percentage || 18,
                                    gst_amount: 432,
                                    total_amount: 2832,
                                    status: "unpaid"
                                  }} 
                                  mode="a4" 
                                />
                              </div>
                            )}
                            {previewMode === 'mobile' && (
                              <div className="w-full flex justify-center">
                                <InvoiceRenderer 
                                  previewTemplate={templateConfig} 
                                  invoice={{
                                    invoice_number: `${templateConfig.invoice?.prefix || 'INV-'}${String(145).padStart(templateConfig.invoice?.numberPadding || 5, '0')}`,
                                    invoice_date: new Date().toISOString(),
                                    due_date: new Date(Date.now() + (templateConfig.invoice?.dueDateOffset || 7) * 24 * 60 * 60 * 1000).toISOString(),
                                    company_name: "Acme Corporates Inc.",
                                    company_id: "acme-1234",
                                    company_gst_number: "29BBBBB2222B2Z2",
                                    plan_name: "Premium Coworking Access",
                                    billing_type: "monthly",
                                    seats: 8,
                                    price_per_seat: 300,
                                    subtotal: 2400,
                                    gst_rate: templateConfig.tax?.percentage || 18,
                                    gst_amount: 432,
                                    total_amount: 2832,
                                    status: "unpaid"
                                  }} 
                                  mode="mobile" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <DialogFooter className="border-t pt-3.5">
                      <Button variant="outline" onClick={() => setModifyStructureOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveTemplate}>Save Template</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                         {/* Create Manual Invoice Dialog */}
                {(() => {
                  const isCompany = companies.some(c => c.id === selectedCompId);
                  const isIndividual = customers.some(cust => (cust.company_id || cust.id) === selectedCompId);
                  const filteredPlans = pricingPlans.filter(p => {
                    if (isCompany) return p.category === "corporate";
                    if (isIndividual) return p.category === "customer";
                    return false;
                  });

                  return (
                    <Dialog open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Create Invoice to Corporate / Customer</DialogTitle>
                          <DialogDescription>Submit billing parameters to issue a manual corporate invoice.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-3 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>Select Company / Admin</Label>
                              <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={selectedCompId}
                                onChange={(e) => handleCompanyOrCustomerChange(e.target.value)}
                              >
                                <option value="" disabled hidden>Select Company or Customer</option>
                                <optgroup label="Companies">
                                  {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.company}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Customers">
                                  {customers.map(cust => (
                                    <option key={cust.id} value={cust.company_id || cust.id}>
                                      {cust.name} ({cust.org_name || 'Individual'})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Plan Name / Description</Label>
                              <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={selectedPlanId}
                                onChange={(e) => handlePlanChange(e.target.value)}
                                disabled={!selectedCompId}
                              >
                                <option value="" disabled hidden>Select Plan</option>
                                {filteredPlans.map(p => (
                                  <option key={p.id} value={p.id}>{p.plan_name} (₹{p.price}/{p.billing_type})</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label>Billing Type</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={manualBillingType}
                                onChange={(e) => setManualBillingType(e.target.value)}
                                disabled={true}
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Price Per Seat (₹)</Label>
                              <Input type="number" value={manualPricePerSeat} onChange={(e) => setManualPricePerSeat(parseFloat(e.target.value) || 0)} disabled={true} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Seats / Quantity</Label>
                              <Input type="number" value={manualSeats} onChange={(e) => setManualSeats(parseInt(e.target.value) || 0)} disabled={true} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t pt-3 mt-2 text-xs">
                            <div className="space-y-1.5">
                              <span className="text-muted-foreground block">Subtotal</span>
                              <span className="font-bold text-base block">₹{(manualPricePerSeat * manualSeats).toFixed(2)}</span>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-muted-foreground block">GST ({manualGstRate}%)</span>
                              <span className="font-bold text-base block">₹{((manualPricePerSeat * manualSeats) * (manualGstRate / 100)).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2 flex justify-between items-center bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-lg border">
                            <span className="font-semibold text-muted-foreground">Total Billed Amount:</span>
                            <span className="font-bold text-lg text-primary">
                              ₹{((manualPricePerSeat * manualSeats) * (1 + manualGstRate / 100)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setCreateInvoiceOpen(false)}>Cancel</Button>
                          <Button onClick={async () => {
                            if (!selectedCompId) {
                              toast({ title: "Company Required", description: "Please select a target company admin.", variant: "destructive" });
                              return;
                            }
                            try {
                              await financeService.createInvoice({
                                company_id: selectedCompId,
                                plan_name: manualPlanName,
                                billing_type: manualBillingType,
                                price_per_seat: manualPricePerSeat,
                                seats: manualSeats,
                                gst_rate: manualGstRate
                              });
                              toast({ title: "Invoice Created", description: "Corporate invoice issued successfully." });
                              setCreateInvoiceOpen(false);
                              fetchInvoices();
                            } catch (err: any) {
                              toast({ title: "Creation Failed", description: err.response?.data?.detail || err.message, variant: "destructive" });
                            }
                          }}>Generate Invoice</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  );
                })()}
              </div>
            )}

            {/* 5. Payments Log */}
            {activeTab === "payments" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div>
                      <h3 className="text-lg font-bold">Payments Log</h3>
                      <p className="text-xs text-muted-foreground">Historical list of verified customer passes and company subscriptions payments</p>
                    </div>
                    <Input
                      placeholder="Search transaction ID, entity..."
                      value={searchPayment}
                      onChange={(e) => setSearchPayment(e.target.value)}
                      className="max-w-xs h-9 ml-4"
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      if (payments.length === 0) {
                        toast({ title: "No Payments", description: "There are no payment log records to export.", variant: "destructive" });
                        return;
                      }
                      // Generate and download CSV
                      const headers = ["Transaction ID", "Account Type", "Entity", "Amount Paid", "Status", "Received On"];
                      const rows = payments.map(p => [
                        p.id,
                        p.type,
                        p.entity,
                        p.amount,
                        p.status,
                        new Date(p.received_on).toISOString()
                      ]);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [headers.join(","), ...rows.map(r => r.map(val => `"${val}"`).join(","))].join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `payments_log_${new Date().toISOString().slice(0, 10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast({ title: "Download Started", description: "Payments log exported as CSV." });
                    }}
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download Payments
                  </Button>
                </div>
                
                <div className="border rounded-md overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Account Type</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filtered = payments.filter(p => {
                          const query = searchPayment.toLowerCase().trim();
                          if (!query) return true;
                          return (
                            p.id?.toLowerCase().includes(query) ||
                            p.entity?.toLowerCase().includes(query) ||
                            p.type?.toLowerCase().includes(query)
                          );
                        });
                        if (filtered.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No payments found matching "{searchPayment}"
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return filtered.map((p, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{p.id}</TableCell>
                            <TableCell>{p.type}</TableCell>
                            <TableCell className="font-semibold">{p.entity}</TableCell>
                            <TableCell className="text-green-600 font-bold">₹{p.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800 border-green-200">{p.status}</Badge>
                            </TableCell>
                            <TableCell>{new Date(p.received_on).toLocaleString()}</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}


            {/* 7. Seat Billing Queue */}
            {activeTab === "seat_billing" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Seat Billing Queue</h3>
                  <p className="text-xs text-muted-foreground">Review corporate seat capacity modifications and generate supplementary invoices</p>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-center">Current Seats</TableHead>
                        <TableHead className="text-center">Requested Seats</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead>Verified By</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seatBillingQueue.map((s, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold">{s.company}</TableCell>
                          <TableCell className="text-center">{s.current_seats}</TableCell>
                          <TableCell className="text-center">{s.requested_seats}</TableCell>
                          <TableCell>
                            {s.generated_invoice !== "None" && s.generated_invoice !== "N/A" ? (
                              <span 
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-bold"
                                onClick={async () => {
                                  try {
                                    const allInvs = await financeService.getFinanceInvoices();
                                    const found = allInvs.find((i: any) => i.id === s.generated_invoice_id);
                                    if (found) {
                                      setSelectedInvoice(found);
                                    } else {
                                      toast({ title: "Not Found", description: "Invoice details could not be loaded.", variant: "destructive" });
                                    }
                                  } catch (err) {
                                    toast({ title: "Error", description: "Failed to fetch invoice details.", variant: "destructive" });
                                  }
                                }}
                              >
                                {s.generated_invoice}
                              </span>
                            ) : (
                              <span className="font-bold">{s.generated_invoice}</span>
                            )}
                          </TableCell>
                          <TableCell>₹{s.additional_charges.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={s.payment_status === "Paid (Verified)" ? "default" : "secondary"}>
                              {s.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-xs">{s.verified_by || "N/A"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1.5">
                              {s.billing_status === "Pending Invoice" && s.request_type === "Increase" && (
                                <Button size="sm" variant="outline" onClick={() => handleGenerateInvoice(s.company_id)}>
                                  Generate Invoice
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => handleCalculateCharges(s.company_id)}>
                                View Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Calculate Seat Upgrade Charge dialog */}
                <Dialog open={!!selectedSeatComp} onOpenChange={(o) => { if(!o) setSelectedSeatComp(null); }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Seat Billing Pricing Details</DialogTitle>
                      <DialogDescription>Seat upgrade cost estimates for {selectedSeatComp?.company}</DialogDescription>
                    </DialogHeader>
                    {calculatedCharges && (
                      <div className="space-y-4 py-4 text-sm">
                        <div className="flex justify-between border-b pb-2">
                          <span>Seat Capacity Increase:</span>
                          <span className="font-bold">+{calculatedCharges.seat_difference} Seats</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span>Seat Price Per Month:</span>
                          <span className="font-bold">₹{calculatedCharges.price_per_seat}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span>Subtotal Charge:</span>
                          <span className="font-bold">₹{calculatedCharges.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2 text-muted-foreground text-xs">
                          <span>GST Collected ({calculatedCharges.gst_rate}%):</span>
                          <span>₹{calculatedCharges.gst_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2">
                          <span>Total Invoice Amount:</span>
                          <span className="text-primary">₹{calculatedCharges.total_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button onClick={() => setSelectedSeatComp(null)}>Close</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* 8. Refund Management */}
            {activeTab === "refunds" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold">Refund Management</h3>
                    <p className="text-xs text-muted-foreground">Process customer cancellations and invoice refund overrides</p>
                  </div>
                  <Button onClick={() => setRequestRefundOpen(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Request Refund
                  </Button>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Refund Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Request Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refunds.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                          <TableCell>{r.company}</TableCell>
                          <TableCell className="font-bold text-red-500">₹{r.amount.toLocaleString()}</TableCell>
                          <TableCell>{r.reason}</TableCell>
                          <TableCell>{new Date(r.request_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending" && (
                              <div className="flex justify-end space-x-1">
                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApproveRefund(r.id)}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleRejectRefund(r.id)}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Request Refund Modal */}
                <Dialog open={requestRefundOpen} onOpenChange={setRequestRefundOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Billing Refund</DialogTitle>
                      <DialogDescription>Submit refund request details for validation</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateRefundRequest} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Invoice ID</Label>
                        <Input value={refundInvoiceId} onChange={(e) => setRefundInvoiceId(e.target.value)} placeholder="Enter full invoice ID" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Refund Amount (₹)</Label>
                        <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Refund Reason</Label>
                        <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} required />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setRequestRefundOpen(false)}>Cancel</Button>
                        <Button type="submit">Submit Request</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}



            {/* 10. Audit Logs */}
            {activeTab === "audit_logs" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Finance Action Logs</h3>
                  <p className="text-xs text-muted-foreground">Historical trail of all billing modifications, refund approvals, and seat invoice creations</p>
                </div>

                <div className="border rounded-md overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{log.user}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.module}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.entity_reference ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground">{log.entity_reference}</span>
                                <span className="text-muted-foreground text-[10px]">{log.entity_name}</span>
                              </div>
                            ) : (
                              <span className="font-semibold">{log.entity_name || log.entity || "N/A"}</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.ip_address}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Void Invoice Reason Dialog */}
            <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Void Invoice</DialogTitle>
                  <DialogDescription>
                    Please enter the reason for voiding this invoice. This action is permanent.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Void Reason</Label>
                    <Textarea 
                      value={voidReason} 
                      onChange={(e) => setVoidReason(e.target.value)} 
                      placeholder="Provide audit explanation (e.g. replaced by INV-xxxxx)" 
                      required 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleVoidInvoiceConfirm}>Confirm Void</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* View Full Invoice Dialog */}
            <Dialog open={!!selectedInvoice} onOpenChange={(o) => { if (!o) setSelectedInvoice(null); }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex justify-between items-center text-xl font-bold pr-6">
                    <span>Invoice Details</span>
                    <div className="flex gap-1.5">
                      {selectedInvoice?.status === "paid" ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 whitespace-nowrap inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                          Paid
                        </Badge>
                      ) : selectedInvoice?.invoice_status === "voided" ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200 whitespace-nowrap inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                          Voided
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 whitespace-nowrap inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                          Unpaid
                        </Badge>
                      )}
                      {selectedInvoice?.invoice_status === "voided" ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200 whitespace-nowrap inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                          Voided
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 border-green-200 whitespace-nowrap inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </DialogTitle>
                  <DialogDescription>
                    Issued on {selectedInvoice && new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>
                
                {selectedInvoice && (
                  <div className="space-y-6 py-4 overflow-y-auto max-h-[70vh]">
                    {selectedInvoice.invoice_status === "voided" && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-800 space-y-1">
                        <p className="font-bold">⚠️ Invoice Voided</p>
                        <p><strong>Reason:</strong> {selectedInvoice.void_reason}</p>
                        <p><strong>Voided At:</strong> {selectedInvoice.voided_at ? new Date(selectedInvoice.voided_at).toLocaleString() : "N/A"}</p>
                      </div>
                    )}
                    <InvoiceRenderer invoice={selectedInvoice} mode="desktop" />
                  </div>
                )}
                
                <DialogFooter className="flex sm:justify-between items-center w-full">
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(selectedInvoice)}>
                      Download HTML
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrintInvoice(selectedInvoice)}>
                      Print View
                    </Button>
                  </div>
                  <Button onClick={() => setSelectedInvoice(null)} size="sm">Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* View Transaction Details Dialog */}
            <Dialog open={!!selectedTransaction} onOpenChange={(o) => { if (!o) setSelectedTransaction(null); }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Transaction Details</DialogTitle>
                  <DialogDescription>Receipt and verification status</DialogDescription>
                </DialogHeader>
                {selectedTransaction && (
                  <div className="space-y-4 py-3 text-sm">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Entity / Account:</span>
                      <span className="font-semibold">{selectedTransaction.entity}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Transaction ID:</span>
                      <span className="font-mono text-xs">{selectedTransaction.id || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Account Type:</span>
                      <span className="capitalize font-medium">{selectedTransaction.type}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Payment Method:</span>
                      <span className="font-medium">{selectedTransaction.method}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-bold text-green-600">₹{selectedTransaction.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Timestamp:</span>
                      <span>{new Date(selectedTransaction.date).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200">🟢 Verified Paid</Badge>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={() => setSelectedTransaction(null)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
