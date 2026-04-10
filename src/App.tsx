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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only retry once — retrying 3 times on a broken Supabase query wastes time
      // and makes the UI feel unresponsive
      retry: 1,
      // Keep freshness tighter for collaborative admin workflows.
      staleTime: 1000 * 60,
      // Keep unused data in cache for 10 minutes
      gcTime: 1000 * 60 * 10,
      // Refetch on focus/reconnect to reduce stale admin views across users.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Never retry mutations — a failed insert/update should be explicit,
      // not silently retried (risk of duplicate rows)
      retry: false,
    },
  },
});

const LoadingScreen = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-5 animate-fade-in">
    {/* Spinning ring around the logo */}
    <div className="relative flex h-16 w-16 items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-md">
        <span className="text-lg font-black text-white">LC</span>
      </div>
    </div>
    <p className="text-sm text-muted-foreground animate-pulse tracking-wide">
      Les Copywriters
    </p>
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
