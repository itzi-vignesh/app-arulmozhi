import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: "user" | "admin" | "superuser" | "company_admin" | "finance";
  requireApproval?: boolean;
}

export function AuthGuard({ children, requiredRole = "user", requireApproval = false }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasRequiredRole, setHasRequiredRole] = useState<boolean | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { session, roles } = await authService.getSession();
        if (!session || !session.user) {
          setIsAuthenticated(false);
          navigate("/login");
          return;
        }

        setIsAuthenticated(true);
        const { is_admin: isAdmin, is_superuser: isSuperuser, is_company_admin: isCompanyAdmin, is_finance: isFinance } = roles;

        // Check role requirements with strict hierarchy
        if (requiredRole === "superuser") {
          setHasRequiredRole(!!isSuperuser);
          if (!isSuperuser) {
            navigate("/dashboard");
            return;
          }
        } else if (requiredRole === "finance") {
          setHasRequiredRole(!!isFinance);
          if (!isFinance) {
            if (isSuperuser) {
              navigate("/superuser/dashboard");
            } else if (isAdmin) {
              navigate("/admin/dashboard");
            } else if (isCompanyAdmin) {
              navigate("/corporate/dashboard");
            } else {
              navigate("/dashboard");
            }
            return;
          }
        } else if (requiredRole === "company_admin") {
          setHasRequiredRole(!!isCompanyAdmin);
          if (!isCompanyAdmin) {
            if (isSuperuser) {
              navigate("/superuser/dashboard");
            } else if (isAdmin) {
              navigate("/admin/dashboard");
            } else {
              navigate("/dashboard");
            }
            return;
          }
        } else if (requiredRole === "admin") {
          // Admin role - only actual admins can access, not superusers
          const hasAdminRole = isAdmin && !isSuperuser; // Strict admin only
          
          setHasRequiredRole(hasAdminRole);
          if (!hasAdminRole) {
            if (isSuperuser) {
              navigate("/superuser/dashboard");
            } else {
              navigate("/dashboard");
            }
            return;
          }
        } else {
          // Regular user - check if they are admin/superuser and redirect appropriately
          if (isSuperuser) {
            navigate("/superuser/dashboard");
            return;
          }
          if (isAdmin) {
            navigate("/admin/dashboard");
            return;
          }
          if (isCompanyAdmin) {
            navigate("/corporate/dashboard");
            return;
          }
          if (isFinance) {
            navigate("/finance/dashboard");
            return;
          }
          setHasRequiredRole(true);
        }

        // Check approval status for regular users
        if (requireApproval && requiredRole === "user") {
          try {
            const user = await userService.getMe();
            setIsApproved(user?.is_approved || false);
            if (!user?.is_approved) {
              await authService.logout();
              navigate("/login");
              return;
            }
          } catch {
            setIsApproved(false);
          }
        } else {
          setIsApproved(true);
        }

      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate, requiredRole, requireApproval]);

  if (isAuthenticated === null || hasRequiredRole === null || (requireApproval && isApproved === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasRequiredRole || (requireApproval && !isApproved)) {
    return null;
  }

  return <>{children}</>;
}