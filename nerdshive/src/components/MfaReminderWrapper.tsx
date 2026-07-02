import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import MfaSetupWizard from "@/components/MfaSetupWizard";
import { Shield, AlertTriangle } from "lucide-react";

export default function MfaReminderWrapper() {
  const location = useLocation();
  const { toast } = useToast();
  const [showReminder, setShowReminder] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(false);

  const PUBLIC_PATHS = ["/login", "/register", "/reset-password", "/inactive-user", "/company-register"];

  useEffect(() => {
    const checkMfaReminder = async () => {
      const isPublicPath = PUBLIC_PATHS.includes(location.pathname) || location.pathname === "/";
      if (isPublicPath) return;

      // Only check if we actually have access token in localStorage
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const sessionData = await authService.getSession();
        if (!sessionData?.mfa_status) return;

        const mfa = sessionData.mfa_status;
        if (mfa.mfa_enabled) return;

        if (mfa.enrollment_status === "DEFERRED" && mfa.mfa_remind_after) {
          const remindAfterDate = new Date(mfa.mfa_remind_after);
          const now = new Date();
          
          if (now >= remindAfterDate) {
            setShowReminder(true);
          }
        } else if (mfa.enrollment_status === "NOT_STARTED" || mfa.enrollment_status === "PENDING_SETUP") {
          // If somehow login/register didn't force setup, remind immediately on landing
          setShowReminder(true);
        }
      } catch (error) {
        console.error("Error checking MFA reminder:", error);
      }
    };

    checkMfaReminder();
  }, [location.pathname]);

  const handleSkip = async () => {
    setLoading(true);
    try {
      const res = await authService.deferMfa();
      toast({
        title: "Deferred",
        description: res.msg || "MFA setup deferred.",
      });
      setShowReminder(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to defer MFA setup.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNow = () => {
    setShowReminder(false);
    setShowSetup(true);
  };

  return (
    <>
      {/* MFA Reminder Modal */}
      <Dialog open={showReminder} onOpenChange={(open) => { if (!open && !loading) handleSkip(); }}>
        <DialogContent className="sm:max-w-md border shadow-card rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Shield className="w-5 h-5 text-primary animate-pulse" />
              <span>Secure Your Account with MFA</span>
            </DialogTitle>
            <DialogDescription>
              Set up Multi-Factor Authentication (MFA) to shield your account from unauthorized access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p>MFA is highly recommended for all accounts. Reminders escalate if not set up.</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleEnableNow} className="w-full h-10 gradient-primary hover:shadow-primary">
                Enable Authentication Now (Recommended)
              </Button>
              <Button onClick={handleSkip} variant="outline" className="w-full h-10" disabled={loading}>
                {loading ? "Please wait..." : "Skip for Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Setup Wizard (Initiated from reminder) */}
      <MfaSetupWizard
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        onSuccess={() => {
          toast({
            title: "MFA Enabled",
            description: "Your account is now protected with MFA."
          });
        }}
      />
    </>
  );
}
