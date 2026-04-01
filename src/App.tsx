import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider, useRole, type UserRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
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
import Availability from "./pages/Availability";
import SessionRoom from "./pages/SessionRoom";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type RoleGuardProps = {
  children: JSX.Element;
  allowedRoles?: UserRole[];
};

type ApiFailureDetail = {
  url: string;
  method: string;
  status: number;
  statusText: string;
  correlationId?: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
};

type GlobalErrorBoundaryState = {
  fatalError: Error | null;
  apiFailure: ApiFailureDetail | null;
  routeFailure: { path: string } | null;
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

class GlobalErrorBoundary extends Component<{ children: ReactNode }, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    fatalError: null,
    apiFailure: null,
    routeFailure: null,
  };

  handleApiError = (event: Event) => {
    const detail = (event as CustomEvent<ApiFailureDetail>).detail;
    if (detail) {
      this.setState({ apiFailure: detail });
    }
  };

  handleRouteError = (event: Event) => {
    const detail = (event as CustomEvent<{ path?: string }>).detail;
    this.setState({ routeFailure: { path: detail?.path ?? "unknown" } });
  };

  handleDismissApi = () => {
    this.setState({ apiFailure: null });
  };

  handleRetryApi = async () => {
    const apiFailure = this.state.apiFailure;
    if (!apiFailure) {
      return;
    }
    try {
      const response = await fetch(apiFailure.url, {
        method: apiFailure.method,
        headers: apiFailure.headers,
        body: apiFailure.body ?? undefined,
      });
      if (response.ok) {
        this.setState({ apiFailure: null });
      }
    } catch {
      this.setState({ apiFailure });
    }
  };

  handleRetryPage = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  componentDidCatch(error: Error) {
    this.setState({ fatalError: error });
  }

  componentDidMount() {
    window.addEventListener("cronox:api-error", this.handleApiError);
    window.addEventListener("cronox:route-error", this.handleRouteError);
  }

  componentWillUnmount() {
    window.removeEventListener("cronox:api-error", this.handleApiError);
    window.removeEventListener("cronox:route-error", this.handleRouteError);
  }

  render() {
    const { fatalError, apiFailure, routeFailure } = this.state;

    if (fatalError || routeFailure) {
      const title = routeFailure ? "We couldn't find that page." : "Something went wrong.";
      const message = routeFailure
        ? `Route not found: ${routeFailure.path}`
        : fatalError?.message ?? "Unexpected error";
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted px-6">
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={this.handleRetryPage}>Retry</Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {apiFailure ? (
          <div className="bg-destructive/10 text-destructive">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">We hit a network error.</p>
                <p className="text-xs text-destructive/80">
                  {apiFailure.method} {apiFailure.url} · {apiFailure.status} {apiFailure.statusText}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={this.handleRetryApi}>
                  Retry request
                </Button>
                <Button size="sm" variant="outline" onClick={this.handleDismissApi}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {this.props.children}
      </>
    );
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GlobalErrorBoundary>
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
              <Route path="/availability" element={<RoleGuard allowedRoles={['professional']}><Availability /></RoleGuard>} />
              <Route path="/session/:id" element={<RoleGuard><SessionRoom /></RoleGuard>} />
              <Route path="/profile" element={<RoleGuard><Profile /></RoleGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RoleProvider>
    </GlobalErrorBoundary>
  </QueryClientProvider>
);

export default App;
