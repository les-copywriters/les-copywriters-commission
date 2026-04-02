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
import SaleFormPage from "@/pages/SaleFormPage";
import RefundsPage from "@/pages/RefundsPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

/** Redirect to login if not authenticated */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/sales/new" element={<ProtectedRoute><SaleFormPage /></ProtectedRoute>} />
    <Route path="/refunds" element={<ProtectedRoute><RefundsPage /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
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
