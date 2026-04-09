import { ReactNode, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import LoadingBar from "@/components/LoadingBar";

/** Layout wrapper for authenticated pages — sidebar + top loading bar */
const AppLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Global fetch indicator */}
      <LoadingBar />

      <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} />

      {/* Page content fades in on every mount */}
      <main
        key={typeof window !== "undefined" ? window.location.pathname : undefined}
        className="flex-1 p-6 pt-16 lg:ml-64 lg:pt-6 lg:p-8 animate-page-enter"
      >
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
