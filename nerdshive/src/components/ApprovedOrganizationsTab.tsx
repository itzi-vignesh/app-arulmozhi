import { useState, useEffect } from "react";
import { corporateService, Company } from "@/services/corporateService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building, Mail, Users, Calendar, Check, X } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

export function ApprovedOrganizationsTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCompanies = async () => {
    try {
      const data = await corporateService.getCompanies();
      const approved = data.filter((c: Company) => c.status === "approved");
      setCompanies(approved);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleApproveSeats = async (id: string) => {
    setActionLoading(id);
    try {
      await corporateService.approveSeatsUpgrade(id);
      toast({ title: "Seat change approved successfully." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Approval Failed", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSeats = async (id: string) => {
    setActionLoading(id);
    try {
      await corporateService.rejectSeatsUpgrade(id);
      toast({ title: "Seat change request rejected." });
      fetchCompanies();
    } catch (error) {
      toast({ title: "Rejection Failed", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCompany = async (id: string, companyName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${companyName}"? This action will permanently remove the company, delete its administrator accounts, and unlink all associated employees.`)) {
      return;
    }
    setActionLoading(id);
    try {
      await corporateService.deleteCompany(id);
      toast({ title: `Company "${companyName}" deleted successfully.` });
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({ title: "Deletion Failed", description: "Failed to delete company.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (companies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground bg-card rounded-lg border border-dashed">
        <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No active organizations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {companies.map((company) => {
        const hasSeatRequest = company.seats_requested !== company.max_employee_capacity;
        const isIncrease = company.seats_requested > company.max_employee_capacity;

        return (
          <div key={company.id} className="p-6 border rounded-lg space-y-4 bg-card shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h3 className="font-bold flex items-center gap-2 text-xl">
                  <Building className="w-5 h-5 text-primary" /> {company.company_name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mt-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {company.company_email}
                  </p>

                  <p className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Current Seats: <span className="font-semibold text-foreground">{company.max_employee_capacity}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Seats Requested: <span className="font-semibold text-foreground">{company.seats_requested}</span>
                  </p>
                  <p className="flex items-center gap-2 md:col-span-2">
                    <Calendar className="w-4 h-4" /> Registered: {formatDate(company.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 cursor-default">
                  Active
                </Badge>
                {hasSeatRequest && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 animate-pulse cursor-default">
                    {isIncrease ? "Upgrade" : "Reduction"} Requested ({company.seats_requested} seats)
                  </Badge>
                )}
                <Button
                  onClick={() => handleDeleteCompany(company.id, company.company_name)}
                  variant="destructive"
                  size="sm"
                  disabled={actionLoading !== null}
                  className="mt-2 text-xs"
                >
                  Delete Company
                </Button>
              </div>
            </div>

            {hasSeatRequest && (
              <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 p-3 rounded-lg">
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium text-amber-800">Seat Allocation Requested:</span> Requesting a change from <strong className="text-foreground">{company.max_employee_capacity}</strong> to <strong className="text-foreground">{company.seats_requested}</strong> seats ({isIncrease ? `increase of +${company.seats_requested - company.max_employee_capacity}` : `reduction of ${company.seats_requested - company.max_employee_capacity}`}).
                  </div>
                  {isIncrease && (
                    <div className="text-xs font-semibold">
                      Payment Verification:{" "}
                      {company.seat_upgrade_invoice_status === "PAYMENT_VERIFIED" ? (
                        <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">Paid & Verified</span>
                      ) : (
                        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">Awaiting Finance Verification (Unpaid)</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => handleApproveSeats(company.id)}
                    size="sm"
                    disabled={actionLoading !== null}
                    className={
                      (actionLoading !== null)
                        ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50 flex items-center gap-1"
                        : "bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                    }
                  >
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    onClick={() => handleRejectSeats(company.id)}
                    variant="destructive"
                    size="sm"
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
