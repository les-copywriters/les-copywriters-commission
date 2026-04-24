import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/i18n";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import RefundsPage from "@/pages/RefundsPage";
import AdminPage from "@/pages/AdminPage";
import TeamPage from "@/pages/TeamPage";
import CloserDetailPage from "@/pages/CloserDetailPage";
import SetterDetailPage from "@/pages/SetterDetailPage";
import TeamManagePage from "@/pages/TeamManagePage";
import SettingsPage from "@/pages/SettingsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import CallsPage from "@/pages/CallsPage";
import SalesAssistantPage from "@/pages/SalesAssistantPage";
import CoachingPage from "@/pages/CoachingPage";
import SetterDashboardPage from "@/pages/SetterDashboardPage";
import SetterCallDetailPage from "@/pages/SetterCallDetailPage";
import NotFound from "@/pages/NotFound";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

const LoadingScreen = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6">
    <div className="relative flex h-24 w-24 items-center justify-center">
      {/* Outer Pulse */}
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-1000" />

      {/* Spinning Ring */}
      <div className="absolute inset-[-4px] rounded-full border-2 border-primary/20" />
      <div className="absolute inset-[-4px] rounded-full border-2 border-transparent border-t-primary animate-spin" />

      {/* Core Logo Container */}
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-2xl shadow-primary/20 overflow-hidden border border-border/50">
        <img src="/Les Copywriters Logo.jpg" alt="Logo" className="h-full w-full object-cover" />
      </div>
    </div>

    <div className="relative z-10 text-center space-y-1">
      <p className="text-xl font-black text-foreground tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">
        Les CopyWriters
      </p>
      <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">
        Initializing Workspace
      </p>
    </div>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const CloserOrAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "closer" && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/refunds" element={<AdminRoute><RefundsPage /></AdminRoute>} />
    <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
    <Route path="/team" element={<AdminRoute><TeamPage /></AdminRoute>} />
    <Route path="/team/manage" element={<AdminRoute><TeamManagePage /></AdminRoute>} />
    <Route path="/team/closer/:name" element={<AdminRoute><CloserDetailPage /></AdminRoute>} />
    <Route path="/team/setter/:name" element={<AdminRoute><SetterDetailPage /></AdminRoute>} />
    <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
    <Route path="/setter-dashboard" element={<ProtectedRoute><SetterDashboardPage /></ProtectedRoute>} />
    <Route path="/setter-dashboard/calls/:callId" element={<ProtectedRoute><SetterCallDetailPage /></ProtectedRoute>} />
    <Route path="/calls" element={<CloserOrAdminRoute><CallsPage /></CloserOrAdminRoute>} />
    <Route path="/assistant" element={<CloserOrAdminRoute><SalesAssistantPage /></CloserOrAdminRoute>} />
    <Route path="/coaching" element={<AdminRoute><CoachingPage /></AdminRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LanguageProvider>
        <AuthProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <ScrollToTop />
              <AppRoutes />
            </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
