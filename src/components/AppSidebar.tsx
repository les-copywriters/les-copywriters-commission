import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { LayoutDashboard, AlertTriangle, Shield, Users, LogOut, Globe, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/team", labelKey: "nav.team", icon: Users },
  { to: "/refunds", labelKey: "nav.refunds", icon: AlertTriangle },
  { to: "/admin", labelKey: "nav.admin", icon: Shield },
];

const AppSidebar = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();

  const handleLogout = () => { logout(); navigate("/"); };
  const toggleLang = () => setLocale(locale === "fr" ? "en" : "fr");

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onToggle} />}

      <Button variant="ghost" size="icon" className="fixed left-4 top-4 z-50 lg:hidden" onClick={onToggle}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-16 items-center gap-2 px-6 font-bold text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-black text-sidebar-primary-foreground">LC</span>
          </div>
          Les Copywriters
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, labelKey, icon: Icon }) => (
            <Link key={to} to={to} onClick={onToggle} className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === to
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}>
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggleLang}>
            <Globe className="h-4 w-4" />
            {locale === "fr" ? "English" : "Français"}
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {t("nav.logout")}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
