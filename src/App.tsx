import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only retry once — retrying 3 times on a broken Supabase query wastes time
      // and makes the UI feel unresponsive
      retry: 1,
      // Data is considered fresh for 2 minutes — avoids hammering Supabase
      // on every navigation while keeping data reasonably up to date
      staleTime: 1000 * 60 * 2,
      // Keep unused data in cache for 10 minutes
      gcTime: 1000 * 60 * 10,
      // Don't refetch when the window regains focus — prevents surprise reloads
      // while an admin is mid-edit
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Never retry mutations — a failed insert/update should be explicit,
      // not silently retried (risk of duplicate rows)
      retry: false,
    },
  },
});

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <span className="text-muted-foreground text-sm">Chargement...</span>
  </div>
);

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
    <Route path="/team/closer/:name" element={<ProtectedRoute><CloserDetailPage /></ProtectedRoute>} />
    <Route path="/team/setter/:name" element={<ProtectedRoute><SetterDetailPage /></ProtectedRoute>} />
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
              <AppRoutes />
            </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
