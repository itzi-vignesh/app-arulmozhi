import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock, Hexagon, Shield } from "lucide-react";
import { ForgotPasswordModal } from "@/components/ui/forgot-password-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MfaSetupWizard from "@/components/MfaSetupWizard";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePostLoginRouting = async () => {
    const { roles } = await authService.getSession();

    if (roles?.is_superuser) {
      navigate("/superuser/dashboard");
      return;
    }

    if (roles?.is_admin) {
      navigate("/admin/dashboard");
      return;
    }

    if (roles?.is_company_admin) {
      navigate("/corporate/dashboard");
      return;
    }

    if (roles?.is_finance) {
      navigate("/finance/dashboard");
      return;
    }

    let user = null;
    try {
      user = await userService.getMe();
    } catch (meError: any) {
      // 403 means auth account exists but no customer profile yet — send to register
      if (meError?.response?.status === 403) {
        toast({
          title: "Profile Incomplete",
          description: "Your account exists but registration is incomplete. Please complete your profile.",
          variant: "destructive"
        });
        await authService.logout();
        navigate("/register");
        return;
      }
      throw meError; // re-throw any other unexpected errors
    }
      
    if (!user) {
      toast({
        title: "Account Not Found",
        description: "No account found. Please register first.",
        variant: "destructive"
      });
      await authService.logout();
      navigate("/register");
      return;
    }

    // Check if user is inactive
    if (user?.is_active === false) {
      toast({
        title: "Account Inactive",
        description: "Your account has been made inactive. You need to re-register to access the system.",
        variant: "destructive"
      });
      await authService.logout();
      navigate("/inactive-user");
      return;
    }

    if (!user?.is_approved) {
      toast({
        title: "Approval Pending",
        description: "Your account is pending admin approval. Please wait for approval before accessing the system.",
        variant: "destructive"
      });
      await authService.logout();
      return;
    }

    // Approved user - redirect to dashboard
    navigate("/dashboard");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("mfa_pending_token");

    try {
      const data = await authService.login(email.trim(), password);

      if (!data) {
        toast({
          title: "Login Failed",
          description: "No user data received.",
          variant: "destructive"
        });
        return;
      }

      if (data.mfa_required) {
        setMfaToken(data.mfa_token);
        setShowMfaChallenge(true);
        return;
      }

      if (data.mfa_setup_required) {
        setMfaToken(data.mfa_token);
        setShowMfaSetup(true);
        return;
      }

      // Persist tokens so apiClient interceptor can attach them
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      await handlePostLoginRouting();
      
    } catch (error: any) {
      console.error('Login error:', error);
      const description = error.response?.data?.detail || "An unexpected error occurred. Please try again.";
      toast({
        title: "Login Error",
        description,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;

    setMfaLoading(true);
    try {
      const data = await authService.loginMfa(mfaToken, mfaCode.trim());
      
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.removeItem('mfa_pending_token');
      
      setShowMfaChallenge(false);
      setMfaCode("");
      
      toast({
        title: "Verification Successful",
        description: "You have successfully verified your identity."
      });

      await handlePostLoginRouting();
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error?.response?.data?.detail || "Invalid code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Branding */}
        <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-card">
          <img src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" alt="Nerdshive" className="w-12 h-12" />
        </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to Nerdshive</h1>
          <p className="text-muted-foreground mt-2">Collaborate locally, impact globally</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:text-primary-dark transition-smooth"
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary hover:shadow-primary transition-smooth"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  onClick={() => navigate("/register")}
                  className="text-primary hover:text-primary-dark font-medium transition-smooth cursor-pointer"
                  disabled={loading}
                >
                  Register here
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Forgot Password Modal */}
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />

        {/* MFA Challenge Dialog */}
        <Dialog open={showMfaChallenge} onOpenChange={setShowMfaChallenge}>
          <DialogContent className="sm:max-w-md border shadow-card rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Shield className="w-5 h-5 text-primary" />
                <span>Multi-Factor Authentication</span>
              </DialogTitle>
              <DialogDescription>
                Enter the 6-digit verification code from your authenticator app or one of your backup recovery codes.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleMfaChallengeSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="challenge-code" className="text-xs font-semibold">Verification Code / Backup Code</Label>
                <Input
                  id="challenge-code"
                  placeholder="e.g. 123456 or XXXX-XXXX"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  className="text-center font-mono tracking-widest text-lg h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10" disabled={mfaLoading || !mfaCode.trim()}>
                {mfaLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Log In"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* MFA Setup Wizard (First time forced setup) */}
        <MfaSetupWizard
          isOpen={showMfaSetup}
          onClose={() => setShowMfaSetup(false)}
          onSuccess={handlePostLoginRouting}
          mfaToken={mfaToken}
        />
      </div>
    </div>
  );
}