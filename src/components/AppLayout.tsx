import { ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";

/** Layout wrapper for authenticated pages with sidebar */
const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen">
    <AppSidebar />
    <main className="ml-64 flex-1 p-6 lg:p-8">{children}</main>
  </div>
);

export default AppLayout;
