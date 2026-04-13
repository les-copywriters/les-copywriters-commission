import { ReactNode, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import LoadingBar from "@/components/LoadingBar";

/** Layout wrapper for authenticated pages — sidebar + top loading bar */
const AppLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen((o) => !o);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Global fetch indicator */}
      <LoadingBar />

      <AppSidebar open={sidebarOpen} onToggle={toggleSidebar} onNavigate={closeSidebar} />

      {/* Page content fades in on every mount */}
      <main
        key={typeof window !== "undefined" ? window.location.pathname : undefined}
        className="flex-1 p-6 pt-16 lg:ml-72 lg:pt-8 lg:p-12 animate-in fade-in duration-700 overflow-x-hidden"
      >
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
