import { useState, useEffect } from "react";
import { apiClient } from '@/lib/apiClient';
import { businessService } from '@/services/businessService';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import { InvoiceRenderer } from '@/components/InvoiceRenderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CheckIn {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  plan: {
    id: string;
    plan_type: string;
    amount: number;
    payment_verified: boolean;
    start_date: string;
    end_date: string;
  };
  invoice?: any;
}

interface PaymentVerificationTabProps {
  onCountChange?: (count: number) => void;
}

export const PaymentVerificationTab = ({ onCountChange }: PaymentVerificationTabProps) => {
  const [pendingPayments, setPendingPayments] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingPayments();

    const pollInterval = setInterval(() => {
      fetchPendingPayments();
    }, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const fetchPendingPayments = async () => {
    try {
      // Fetch check-ins for today
      const checkins = await businessService.getCheckins({ checkin_approved: false });
      
      // Filter out rejected payments
      const unverifiedPayments = checkins.filter(
        checkin => checkin.payment_status !== 'rejected' && checkin.plan
      );

      // Fetch all invoices to link them
      const invoicesRes = await apiClient.get("/invoices/");
      const allInvoices = invoicesRes.data || [];

      // Link matching invoice to each check-in
      const paymentsWithInvoices = unverifiedPayments.map((checkin: any) => {
        const invoice = allInvoices.find((inv: any) => 
          inv.user_id === checkin.user_id &&
          inv.billing_type === checkin.plan.plan_type &&
          inv.billing_start_date === checkin.plan.start_date &&
          inv.billing_end_date === checkin.plan.end_date
        );
        return {
          ...checkin,
          invoice
        };
      });

      setPendingPayments(paymentsWithInvoices as any);
      onCountChange?.(paymentsWithInvoices.length);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch pending payment verifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCheckIn = async (checkinId: string) => {
    setVerifyingIds(prev => new Set(prev).add(checkinId));
    try {
      await businessService.approveCheckin(checkinId);
      toast({
        title: "Check-in Approved",
        description: "User has been approved for check-in.",
      });
      // Immediately update local state to remove this item
      setPendingPayments(prev => prev.filter(p => p.id !== checkinId));
      onCountChange?.(pendingPayments.length - 1);
    } catch (error) {
      console.error("Error approving check-in:", error);
      toast({
        title: "Error",
        description: "Failed to approve check-in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkinId);
        return newSet;
      });
    }
  };

  const handleUnpaidPayment = async (checkinId: string, userId: string) => {
    setVerifyingIds(prev => new Set(prev).add(checkinId));
    try {
      // Mark payment as rejected (will be auto-deleted after 2 days)
      await businessService.updateCheckin(checkinId, {
        payment_status: 'rejected',
        payment_rejection_date: new Date().toISOString()
      });

      toast({
        title: "Payment Marked Unpaid",
        description: "Check-in request marked as unpaid. User has been notified and request will be removed after 2 days.",
      });

      await fetchPendingPayments();
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast({
        title: "Error",
        description: "Failed to reject payment",
        variant: "destructive",
      });
    } finally {
      setVerifyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkinId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingPayments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No pending payment verifications</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Customer</TableHead>
            <TableHead className="text-center">Email</TableHead>
            <TableHead className="text-center">Plan Type</TableHead>
            <TableHead className="text-center">Amount</TableHead>
            <TableHead className="text-center">Invoice</TableHead>
            <TableHead className="text-center">Payment Status</TableHead>
            <TableHead className="text-center">Plan Duration</TableHead>
            <TableHead className="text-center">Request Time</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingPayments.map((checkin) => (
            <TableRow key={checkin.id}>
              <TableCell className="text-center font-medium">
                {checkin.user.full_name}
              </TableCell>
              <TableCell className="text-center">{checkin.user.email}</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{checkin.plan.plan_type}</Badge>
              </TableCell>
              <TableCell className="text-center">₹{checkin.plan.amount}</TableCell>
              <TableCell className="text-center">
                {checkin.invoice ? (
                  <Button 
                    variant="link" 
                    className="font-mono text-xs font-bold text-blue-600 p-0 h-auto"
                    onClick={() => setSelectedInvoice(checkin.invoice)}
                  >
                    {checkin.invoice.invoice_number}
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">N/A</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {checkin.plan.payment_verified ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">🟢 Paid</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">🔴 Unpaid</Badge>
                )}
              </TableCell>
              <TableCell className="text-center text-sm">
                {checkin.plan.start_date} to {checkin.plan.end_date}
              </TableCell>
              <TableCell className="text-center">
                {formatDateTime(checkin.created_at)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex gap-2 justify-center">
                  {checkin.plan.payment_verified ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                      onClick={() => handleApproveCheckIn(checkin.id)}
                      disabled={verifyingIds.has(checkin.id)}
                    >
                      {verifyingIds.has(checkin.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Approve Check-in
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleUnpaidPayment(checkin.id, checkin.user_id)}
                      disabled={verifyingIds.has(checkin.id)}
                    >
                      {verifyingIds.has(checkin.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-1" />
                      )}
                      Reject Request
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
            </DialogHeader>
            <InvoiceRenderer invoice={selectedInvoice} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
