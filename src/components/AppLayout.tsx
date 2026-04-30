import { ReactNode, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import LoadingBar from "@/components/LoadingBar";
import { cn } from "@/lib/utils";

type AppLayoutProps = {
  children: ReactNode;
  /** Removes all padding and max-width — content fills the full available area */
  fullscreen?: boolean;
};

const AppLayout = ({ children, fullscreen = false }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen((o) => !o);

  return (
    <div className={cn("flex min-h-screen", fullscreen ? "bg-[#0A0D14]" : "bg-background")}>
      <LoadingBar />
      <AppSidebar open={sidebarOpen} onToggle={toggleSidebar} onNavigate={closeSidebar} />

      <main
        key={typeof window !== "undefined" ? window.location.pathname : undefined}
        className={cn(
          "flex-1 lg:ml-64 animate-in fade-in duration-500 overflow-x-hidden",
          fullscreen
            ? "pt-14 lg:pt-0 flex flex-col h-screen lg:h-screen" // mobile: space for hamburger; desktop: true full height
            : "p-6 pt-16 lg:pt-8 lg:p-10"
        )}
      >
        <div className={cn(fullscreen ? "flex-1 flex flex-col min-h-0" : "max-w-[1600px] mx-auto")}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
