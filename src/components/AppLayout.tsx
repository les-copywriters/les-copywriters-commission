import { ReactNode, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import LoadingBar from "@/components/LoadingBar";
import { cn, ls } from "@/lib/utils";

type AppLayoutProps = {
  children: ReactNode;
  fullscreen?: boolean;
};

const AppLayout = ({ children, fullscreen = false }: AppLayoutProps) => {
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => ls.get("sidebar.collapsed", "false") === "true"
  );

  const closeSidebar  = () => setSidebarOpen(false);
  const toggleMobile  = () => setSidebarOpen((o) => !o);
  const toggleCollapse = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      ls.set("sidebar.collapsed", String(next));
      return next;
    });
  };

  return (
    <div className={cn("flex min-h-screen", fullscreen ? "bg-[#0A0D14]" : "bg-background")}>
      <LoadingBar />
      <AppSidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onToggle={toggleMobile}
        onCollapse={toggleCollapse}
        onNavigate={closeSidebar}
      />

      <main
        key={typeof window !== "undefined" ? window.location.pathname : undefined}
        className={cn(
          "flex-1 animate-in fade-in duration-500 overflow-x-hidden transition-[margin] duration-300",
          fullscreen
            ? "pt-14 lg:pt-0 flex flex-col h-screen lg:h-screen"
            : "p-6 pt-16 lg:pt-8 lg:p-10",
          sidebarCollapsed ? "lg:ml-14" : "lg:ml-64"
        )}
      >
        <div className={cn(fullscreen ? "flex-1 flex flex-col min-h-0" : "")}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
