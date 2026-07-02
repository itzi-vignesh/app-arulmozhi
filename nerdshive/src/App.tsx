import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MfaReminderWrapper from "./components/MfaReminderWrapper";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import SuperuserDashboard from "./pages/SuperuserDashboard";
import InactiveUser from "./pages/InactiveUser";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import CompanyRegister from "./pages/CompanyRegister";
import CorporateDashboard from "./pages/CorporateDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MfaReminderWrapper />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/superuser/dashboard" element={<SuperuserDashboard />} />
          <Route path="/finance/dashboard" element={<FinanceDashboard />} />
          <Route path="/inactive-user" element={<InactiveUser />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/company-register" element={<CompanyRegister />} />
          <Route path="/corporate/dashboard" element={<CorporateDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
