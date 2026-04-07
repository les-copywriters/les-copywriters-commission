import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import {
  LayoutDashboard, AlertTriangle, Shield, Users,
  UserCog, Settings, LogOut, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allNavItems = [
  { to: "/dashboard",   labelKey: "nav.dashboard",   icon: LayoutDashboard, adminOnly: false },
  { to: "/team",        labelKey: "nav.team",        icon: Users,           adminOnly: true  },
  { to: "/refunds",     labelKey: "nav.refunds",     icon: AlertTriangle,   adminOnly: true  },
  { to: "/admin",       labelKey: "nav.admin",       icon: Shield,          adminOnly: true  },
  { to: "/team/manage", labelKey: "nav.teamManage",  icon: UserCog,         adminOnly: true  },
  { to: "/settings",    labelKey: "nav.settings",    icon: Settings,        adminOnly: false },
];

function UserAvatar({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleColor: Record<string, string> = {
    admin:  "bg-primary/20 text-primary",
    closer: "bg-success/20 text-success",
    setter: "bg-warning/20 text-warning",
  };

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-sidebar-accent/60">
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
        roleColor[role] ?? "bg-primary/20 text-primary"
      )}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sidebar-foreground truncate">{name}</p>
        <p className="text-xs capitalize text-white/50">{role}</p>
      </div>
    </div>
  );
}

const AppSidebar = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => {
  const { pathname } = useLocation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const navItems = allNavItems.filter(item => !item.adminOnly || user?.role === "admin");

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={onToggle}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col",
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        "transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="text-sm font-black text-white">LC</span>
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-none">Les Copywriters</p>
            <p className="text-xs text-white/40 mt-0.5">Commissions</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
          {navItems.map(({ to, labelKey, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={onToggle}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  "transition-colors duration-150",
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 pb-3 space-y-2 border-t border-sidebar-border pt-3">
          {user && <UserAvatar name={user.name} role={user.role} />}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 text-sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {t("nav.logout")}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
