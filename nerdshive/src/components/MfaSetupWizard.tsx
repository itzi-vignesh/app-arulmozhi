import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { Shield, Loader2, Check, Copy, Download, AlertCircle } from "lucide-react";

interface MfaSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (authData?: any) => void;
  mfaToken?: string; // Optional, if setting up during first-login flow
}

export default function MfaSetupWizard({ isOpen, onClose, onSuccess, mfaToken }: MfaSetupWizardProps) {
  const [step, setStep] = useState<"setup" | "backup_codes">("setup");
  const [loading, setLoading] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Fetch MFA setup details
      const initMfaSetup = async () => {
        setLoading(true);
        try {
          // If mfaToken is present, we must store it temporarily in localStorage 
          // so the apiClient request interceptor includes it.
          if (mfaToken) {
            localStorage.setItem("mfa_pending_token", mfaToken);
          }
          
          const data = await authService.setupMfa();
          setSecret(data.secret);
          
          const url = await QRCode.toDataURL(data.provisioning_uri, {
            width: 240,
            margin: 1,
            color: {
              dark: "#0F172A",
              light: "#FFFFFF"
            }
          });
          setQrCodeDataUrl(url);
        } catch (error: any) {
          console.error("MFA setup error:", error);
          toast({
            title: "MFA Setup Failed",
            description: error?.response?.data?.detail || "Failed to initialize MFA setup. Please try again.",
            variant: "destructive"
          });
          onClose();
        } finally {
          setLoading(false);
        }
      };

      initMfaSetup();
    } else {
      // Reset state on close
      setStep("setup");
      setQrCodeDataUrl("");
      setSecret("");
      setVerificationCode("");
      setBackupCodes([]);
    }
  }, [isOpen]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setLoading(true);
    try {
      if (mfaToken) {
        localStorage.setItem("mfa_pending_token", mfaToken);
      }
      
      const response = await authService.verifyMfa(verificationCode.trim());
      
      setBackupCodes(response.backup_codes || []);
      setStep("backup_codes");
      
      // If we got access token back (meaning it was a pending token flow), we save it
      if (response.access_token) {
        localStorage.setItem("access_token", response.access_token);
        localStorage.setItem("refresh_token", response.refresh_token);
        localStorage.removeItem("mfa_pending_token");
      }
      
      toast({
        title: "MFA Verified",
        description: "Your authenticator app has been verified successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error?.response?.data?.detail || "Invalid verification code. Please check your authenticator app and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast({
      title: "Copied",
      description: "Backup codes copied to clipboard."
    });
  };

  const handleDownloadCodes = () => {
    const element = document.createElement("a");
    const file = new Blob([backupCodes.join("\r\n")], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "nerdshive_mfa_backup_codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({
      title: "Downloaded",
      description: "MFA backup codes downloaded successfully."
    });
  };

  const handleComplete = () => {
    // Clear pending token since setup is finished
    localStorage.removeItem("mfa_pending_token");
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && step === "backup_codes") handleComplete(); else if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md border shadow-card rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Shield className="w-5 h-5 text-primary" />
            <span>{step === "setup" ? "Enable MFA" : "Save Backup Codes"}</span>
          </DialogTitle>
          <DialogDescription>
            {step === "setup" 
              ? "Protect your account with Time-Based One-Time Password (TOTP) Multi-Factor Authentication."
              : "Keep these backup recovery codes in a safe place. They will not be shown again."}
          </DialogDescription>
        </DialogHeader>

        {loading && !qrCodeDataUrl ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Setting up authenticator connection...</span>
          </div>
        ) : step === "setup" ? (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Scan QR Code" className="border rounded-md bg-white p-2 shadow-sm" />
              ) : (
                <div className="w-40 h-40 bg-muted flex items-center justify-center rounded-md">QR Code Error</div>
              )}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-bold">Manual Entry Secret Key</span>
                <code className="text-xs font-mono font-bold select-all bg-muted px-2 py-1 rounded block mt-1">{secret}</code>
              </div>
            </div>

            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 px-1">
              <li>Scan the QR code above using your Authenticator app (e.g. Google Authenticator, Microsoft Authenticator, Authy).</li>
              <li>Or enter the secret key manually if scanning is not supported.</li>
              <li>Enter the 6-digit verification code generated by your app below.</li>
            </ol>

            <form onSubmit={handleVerify} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="Enter 6-digit code (e.g. 123456)"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="text-center font-mono tracking-widest text-lg h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10" disabled={loading || verificationCode.length < 6}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Complete Setup"
                )}
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Important Security Warning</p>
                <p className="mt-0.5">These backup codes are shown only once. If you lose your authenticator device, you will need one of these codes to log into your account.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border font-mono text-center text-sm font-semibold select-all">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="bg-background border rounded px-2 py-1.5 shadow-sm text-slate-800 dark:text-slate-200">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={handleCopyCodes}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy All
              </Button>
              <Button variant="outline" className="flex-1 text-xs" onClick={handleDownloadCodes}>
                <Download className="w-4 h-4 mr-1.5" /> Download
              </Button>
            </div>

            <Button className="w-full mt-2 h-10" onClick={handleComplete}>
              <Check className="w-4 h-4 mr-1.5" /> I Have Saved the Codes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
