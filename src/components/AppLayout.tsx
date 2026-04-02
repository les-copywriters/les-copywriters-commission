import { ReactNode, useState } from "react";
import AppSidebar from "@/components/AppSidebar";

/** Layout wrapper for authenticated pages with sidebar */
const AppLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} />
      <main className="flex-1 p-6 pt-16 lg:ml-64 lg:pt-6 lg:p-8">{children}</main>
    </div>
  );
};

export default AppLayout;
