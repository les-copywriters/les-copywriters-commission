import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, PlusCircle, AlertTriangle, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/sales/new", label: "Nouvelle vente", icon: PlusCircle },
  { to: "/refunds", label: "Remboursements", icon: AlertTriangle },
  { to: "/admin", label: "Administration", icon: Shield },
];

/** Sidebar navigation for authenticated pages */
const AppSidebar = () => {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-16 items-center gap-2 px-6 font-bold text-lg">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <LayoutDashboard className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        Sales Tracker
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === to
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
