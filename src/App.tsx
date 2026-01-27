import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider, useRole, type UserRole } from "@/contexts/RoleContext";
import Index from "./pages/Index";
import AuthEntry from "./pages/AuthEntry";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import MarketplaceTokenDetails from "./pages/MarketplaceTokenDetails";
import MySessions from "./pages/MySessions";
import CreateSession from "./pages/CreateSession";
import Earnings from "./pages/Earnings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type RoleGuardProps = {
  children: JSX.Element;
  allowedRoles?: UserRole[];
};

const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { isAuthenticated, role } = useRole();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RoleProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthEntry />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/tokens/:id" element={<MarketplaceTokenDetails />} />
            <Route path="/my-sessions" element={<RoleGuard><MySessions /></RoleGuard>} />
            <Route path="/create-session" element={<RoleGuard allowedRoles={['professional']}><CreateSession /></RoleGuard>} />
            <Route path="/earnings" element={<RoleGuard allowedRoles={['professional']}><Earnings /></RoleGuard>} />
            <Route path="/profile" element={<RoleGuard><Profile /></RoleGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </RoleProvider>
  </QueryClientProvider>
);

export default App;
