import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, UserX, ArrowRight } from "lucide-react";

export default function InactiveUser() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Branding */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-card">
            <img src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" alt="Nerdshive" className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Nerdshive</h1>
          <p className="text-muted-foreground mt-2">Collaborate locally, impact globally</p>
        </div>

        <Card className="shadow-card border-orange-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <UserX className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-orange-700">Account Inactive</CardTitle>
            <CardDescription className="text-center">
              Your account has been made inactive by an administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-medium text-orange-800">What does this mean?</h3>
                  <p className="text-sm text-orange-700">
                    Your account has been temporarily deactivated by our administration team. 
                    This means you cannot access your workspace until you complete the re-registration process.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-foreground">To regain access:</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                  <span>Complete the re-registration process starting from Step 2 (personal details)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                  <span>Upload new ID proof and take a fresh photo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                  <span>Wait for admin approval</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">4</span>
                  <span>Once approved, you can login and access your workspace</span>
                </li>
              </ol>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => navigate("/register")}
                className="w-full gradient-primary hover:shadow-primary transition-smooth"
              >
                Start Re-registration Process
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate("/login")}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                If you believe this is an error, please contact support at{" "}
                <a href="mailto:support@nerdshive.com" className="text-primary hover:underline">
                  support@nerdshive.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
