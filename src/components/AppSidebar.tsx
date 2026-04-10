import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import {
  LayoutDashboard, BarChart2, AlertTriangle, Shield,
  Users, UserCog, Settings, LogOut, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Nav structure ────────────────────────────────────────────────────────────
type NavItem = { to: string; labelKey: string; icon: React.ElementType };

const mainItems: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart2        },
];

const adminItems: NavItem[] = [
  { to: "/refunds",     labelKey: "nav.refunds",   icon: AlertTriangle },
  { to: "/admin",       labelKey: "nav.admin",     icon: Shield        },
  { to: "/team",        labelKey: "nav.team",      icon: Users         },
  { to: "/team/manage", labelKey: "nav.teamManage", icon: UserCog      },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function UserAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
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

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  const { t } = useLanguage();
  const getScore = (to: string) => {
    if (pathname === to) return 1000 + to.length;
    if (pathname.startsWith(`${to}/`)) return to.length;
    return -1;
  };
  const bestScore = items.reduce((max, item) => Math.max(max, getScore(item.to)), -1);

  return (
    <div className="space-y-0.5">
      {label && (
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30 select-none">
          {label}
        </p>
      )}
      {items.map(({ to, labelKey, icon: Icon }) => {
        const active = bestScore >= 0 && getScore(to) === bestScore;
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary text-white shadow-sm pl-4"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition-all duration-200",
                active ? "bg-white/90 opacity-100" : "opacity-0"
              )}
            />
            <Icon className="h-4 w-4 shrink-0" />
            {t(labelKey)}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
const AppSidebar = ({
  open,
  onToggle,
  onNavigate,
}: {
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) => {
  const { pathname } = useLocation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isAdmin = user?.role === "admin";
  const handleLogout = () => { onNavigate(); logout(); navigate("/"); };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile toggle button */}
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
        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="text-sm font-black text-white">LC</span>
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-none">Les Copywriters</p>
            <p className="text-xs text-white/40 mt-0.5">Commissions</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
          <NavGroup
            items={mainItems}
            pathname={pathname}
            onNavigate={onNavigate}
          />

          {isAdmin && (
            <NavGroup
              label={t("nav.adminSection")}
              items={adminItems}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          )}

          <NavGroup
            label={t("nav.accountSection")}
            items={[{ to: "/settings", labelKey: "nav.settings", icon: Settings }]}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </nav>

        {/* User card + logout */}
        <div className="px-3 pb-3 space-y-2 border-t border-sidebar-border pt-3 shrink-0">
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
