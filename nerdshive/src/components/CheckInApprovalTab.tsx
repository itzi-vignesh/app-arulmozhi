import { useState, useEffect } from "react";
import { apiClient } from '@/lib/apiClient';
import { businessService } from '@/services/businessService';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Loader2, UserCheck } from "lucide-react";

interface CheckIn {
  id: string;
  user_id: string;
  plan_id: string;
  checkin_time: string | null;
  checkout_time: string | null;
  checkin_approved: boolean;
  status: string;
  created_at: string;
  payment_status: string;
  payment_rejection_date: string | null;
  user?: {
    full_name: string;
    email: string;
  };
  plan?: {
    plan_type: string;
    start_date: string;
    end_date: string;
    payment_verified: boolean;
  };
}

interface CheckInApprovalTabProps {
  onCountChange?: (count: number) => void;
  onSwitchToPaymentVerification?: () => void;
}

export function CheckInApprovalTab({ onCountChange, onSwitchToPaymentVerification }: CheckInApprovalTabProps = {}) {
  const [pendingCheckIns, setPendingCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingCheckIns();

    const pollInterval = setInterval(() => {
      fetchPendingCheckIns();
    }, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const fetchPendingCheckIns = async () => {
    try {
      // Mark old check-ins as expired
      await businessService.markExpiredCheckins();
      
      // Delete expired check-ins older than 2 days
      await businessService.deleteOldExpiredCheckins();

      // Fetch only today's pending check-ins
      const checkins = await businessService.getCheckins({ checkin_approved: false });
      
      // Filter out rejected locally since status query handles general status
      const filtered = checkins.filter(c => c.payment_status !== 'rejected');

      setPendingCheckIns(filtered as any);
      onCountChange?.(filtered.length);
    } catch (error) {
      console.error('Error fetching pending check-ins:', error);
      toast({
        title: "Error",
        description: "Failed to load pending check-ins.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCheckIn = async (checkinId: string) => {
    setApprovingIds(prev => new Set(prev.add(checkinId)));
    
    try {
      await businessService.approveCheckin(checkinId);

      toast({
        title: "Check-in Approved",
        description: "User has been approved for check-in.",
      });

      fetchPendingCheckIns();
    } catch (error) {
      console.error('Error approving check-in:', error);
      toast({
        title: "Error",
        description: "Failed to approve check-in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApprovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkinId);
        return newSet;
      });
    }
  };

  const handleRejectCheckIn = async (checkinId: string) => {
    setApprovingIds(prev => new Set(prev.add(checkinId)));
    
    try {
      await businessService.deleteCheckin(checkinId);

      toast({
        title: "Check-in Rejected",
        description: "Check-in request has been rejected and removed.",
      });

      fetchPendingCheckIns();
    } catch (error) {
      console.error('Error rejecting check-in:', error);
      toast({
        title: "Error",
        description: "Failed to reject check-in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApprovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkinId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (pendingCheckIns.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserCheck className="w-8 h-8 mx-auto mb-2" />
        <p>No pending check-in approvals</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Plan Details</TableHead>
              <TableHead>Request Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingCheckIns.map((checkin) => (
              <TableRow key={checkin.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{checkin.user?.full_name}</div>
                    <div className="text-sm text-muted-foreground">{checkin.user?.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium capitalize">{checkin.plan?.plan_type} Plan</div>
                    <div className="text-sm text-muted-foreground">
                      {checkin.plan?.start_date} to {checkin.plan?.end_date}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {new Date(checkin.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    <div className="text-muted-foreground">
                      {new Date(checkin.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending Approval
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveCheckIn(checkin.id)}
                      disabled={approvingIds.has(checkin.id)}
                    >
                      {approvingIds.has(checkin.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectCheckIn(checkin.id)}
                      disabled={approvingIds.has(checkin.id)}
                    >
                      {approvingIds.has(checkin.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <X className="w-4 h-4 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}