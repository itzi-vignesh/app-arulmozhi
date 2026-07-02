import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { storageService } from '@/services/storageService';

import { useToast } from "@/hooks/use-toast";
import { userService } from '@/services/userService';
import { businessService } from '@/services/businessService';
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  plan_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface CheckIn {
  id: string;
  plan_id: string;
  checkin_time?: string | null;
  checkout_time?: string | null;
  checkin_approved: boolean;
  status: string;
}

interface CheckInOutTabProps {
  plans: Plan[];
  checkins: CheckIn[];
  onUpdate: () => void;
}

export function CheckInOutTab({ plans, checkins, onUpdate }: CheckInOutTabProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getActivePlan = () => {
    const today = new Date().toISOString().split('T')[0];
    return plans.find(plan => 
      plan.is_active && 
      plan.start_date <= today && 
      plan.end_date >= today
    );
  };

  const getCurrentCheckIn = (planId: string) => {
    return checkins.find(checkin => 
      checkin.plan_id === planId && 
      checkin.status !== 'checked_out'
    );
  };

  const hasCheckedOutToday = (planId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return checkins.some(checkin => 
      checkin.plan_id === planId && 
      checkin.status === 'checked_out' &&
      checkin.checkout_time &&
      new Date(checkin.checkout_time).toISOString().split('T')[0] === today
    );
  };

  const isPlanEndingToday = (plan: Plan) => {
    const today = new Date().toISOString().split('T')[0];
    return plan.end_date === today;
  };

  const shouldShowRenewalWarning = (planId: string) => {
    const activePlan = getActivePlan();
    if (!activePlan) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const hasCheckedOut = hasCheckedOutToday(planId);
    const isPlanEnding = isPlanEndingToday(activePlan);
    
    return hasCheckedOut && isPlanEnding;
  };

  const handleCheckIn = async () => {
    const activePlan = getActivePlan();
    if (!activePlan) return;

    setLoading(true);
    try {
      const { session } = await authService.getSession();
      if (!session) throw new Error("Not authenticated");

      const userRecord = await userService.getMe();
      if (!userRecord) throw new Error("User not found");

      await businessService.createCheckin({
          user_id: userRecord.id,
          plan_id: activePlan.id
        });

      toast({
        title: "Check-in Requested",
        description: "Your check-in request has been sent to administrators for approval.",
        variant: "default"
      });

      onUpdate();
    } catch (error) {
      console.error('Error requesting check-in:', error);
      toast({
        title: "Check-in Failed",
        description: "Failed to request check-in. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    const activePlan = getActivePlan();
    if (!activePlan) return;

    const currentCheckIn = getCurrentCheckIn(activePlan.id);
    if (!currentCheckIn) return;

    setLoading(true);
    try {
      await businessService.updateCheckin(currentCheckIn.id, {
          checkout_time: new Date().toISOString(),
          status: 'checked_out'
        });

      toast({
        title: "Checked Out",
        description: "You have been successfully checked out.",
        variant: "default"
      });

      onUpdate();
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Check-out Failed",
        description: "Failed to check out. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const activePlan = getActivePlan();
  const currentCheckIn = activePlan ? getCurrentCheckIn(activePlan.id) : null;
  const hasCheckedOutTodayFlag = activePlan ? hasCheckedOutToday(activePlan.id) : false;
  const isPlanEndingTodayFlag = activePlan ? isPlanEndingToday(activePlan) : false;
  const showRenewalWarning = activePlan ? shouldShowRenewalWarning(activePlan.id) : false;

  if (!activePlan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check-in / Check-out</CardTitle>
          <CardDescription>No active plan found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You need an active plan to check-in. Please book a plan first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Check-in / Check-out
        </CardTitle>
        <CardDescription>
          Manage your workspace access for your active {activePlan.plan_type} plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Active Plan: {activePlan.plan_type}</p>
              <p className="text-sm text-muted-foreground">
                Valid from {activePlan.start_date} to {activePlan.end_date}
              </p>
            </div>
            <Badge variant="secondary">Active</Badge>
          </div>
        </div>

        {currentCheckIn ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                {currentCheckIn.status === 'pending' ? (
                  <>
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span>Check-in request pending approval</span>
                  </>
                ) : currentCheckIn.status === 'checked_in' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Checked in at {new Date(currentCheckIn.checkin_time!).toLocaleTimeString()}</span>
                  </>
                ) : null}
              </div>
              <Badge 
                variant={
                  currentCheckIn.status === 'pending' ? 'secondary' :
                  currentCheckIn.status === 'checked_in' ? 'default' : 'outline'
                }
              >
                {currentCheckIn.status}
              </Badge>
            </div>

            {currentCheckIn.status === 'checked_in' && (
              <Button
                onClick={handleCheckOut}
                disabled={loading}
                className="w-full"
                variant="destructive"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking out...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Check Out
                  </>
                )}
              </Button>
            )}
          </div>
        ) : hasCheckedOutTodayFlag ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted border rounded-lg">
              <p className="text-muted-foreground text-center">
                You have already checked out today. Check-in will be available tomorrow.
              </p>
            </div>
            {showRenewalWarning && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <p className="font-medium text-amber-800">
                    Plan Renewal Required
                  </p>
                </div>
                <p className="text-sm text-amber-700">
                  Your plan ends today. Please renew your plan to continue using workspace services from tomorrow.
                </p>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting check-in...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Request Check-in
              </>
            )}
          </Button>
        )}

        {checkins.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Recent Check-ins</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {checkins.slice(0, 5).map((checkin) => (
                <div key={checkin.id} className="flex justify-between text-sm p-2 bg-muted rounded">
                  <span>
                    {checkin.checkin_time ? 
                      `In: ${new Date(checkin.checkin_time).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(checkin.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` :
                      'Pending approval'
                    }
                  </span>
                  <span>
                    {checkin.checkout_time ? 
                      `Out: ${new Date(checkin.checkout_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` :
                      checkin.status === 'checked_in' ? 'Active' : ''
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}