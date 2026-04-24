import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import {
  LayoutDashboard, BarChart2, AlertTriangle, Shield,
  Users, UserCog, Settings, LogOut, Menu, X, ChevronRight, Phone, Brain, MessageSquare, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Nav structure ────────────────────────────────────────────────────────────
type NavItem = { to: string; labelKey: string; icon: React.ElementType };

const mainItems: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart2        },
  { to: "/setter-dashboard", labelKey: "nav.setterDashboard", icon: Target },
  { to: "/calls",     labelKey: "nav.calls",     icon: Phone            },
  { to: "/assistant", labelKey: "nav.assistant", icon: MessageSquare    },
];

const adminItems: NavItem[] = [
  { to: "/refunds",     labelKey: "nav.refunds",   icon: AlertTriangle },
  { to: "/admin",       labelKey: "nav.admin",     icon: Shield        },
  { to: "/coaching",    labelKey: "nav.coaching",  icon: Brain         },
  { to: "/team",        labelKey: "nav.team",      icon: Users         },
  { to: "/team/manage", labelKey: "nav.teamManage", icon: UserCog      },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function UserAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const roleStyles: Record<string, string> = {
    admin:  "bg-primary text-white shadow-primary/20",
    closer: "bg-emerald-500 text-white shadow-emerald-500/20",
    setter: "bg-amber-500 text-white shadow-amber-500/20",
  };
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm group transition-all hover:bg-white/[0.05]">
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-lg transform transition-transform group-hover:scale-105",
        roleStyles[role] ?? roleStyles.admin
      )}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate leading-tight">{name}</p>
        <p className="text-[10px] uppercase font-medium tracking-wider text-white/40 mt-0.5">{role}</p>
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
    <div className="space-y-1">
      {label && (
        <p className="px-4 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25 select-none">
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
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0 transition-colors duration-200", active ? "text-primary" : "")} />
            <span className="flex-1">{t(labelKey)}</span>
            {active && <ChevronRight className="h-3 w-3 opacity-40" />}
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
  const canSeeSetterDashboard = user?.role === "admin" || user?.role === "setter";
  const canSeeAssistant = user?.role === "admin" || user?.role === "closer";
  const canSeeCalls = user?.role === "admin" || user?.role === "closer";
  const handleLogout = () => { onNavigate(); logout(); navigate("/"); };
  const visibleMainItems = mainItems.filter((item) => {
    if (item.to === "/setter-dashboard") return canSeeSetterDashboard;
    if (item.to === "/calls") return canSeeCalls;
    if (item.to === "/assistant") return canSeeAssistant;
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-md lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden text-white bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg h-9 w-9"
        onClick={onToggle}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col",
        "bg-[#0A0D14] text-white border-r border-white/[0.06]",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="relative flex h-[68px] items-center gap-3 px-5 border-b border-white/[0.06] shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 overflow-hidden ring-1 ring-white/10 transition-all">
            <img
              src="/Les Copywriters Logo.jpg"
              alt="Les Copywriters Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Les CopyWriters</p>
            <p className="text-[10px] font-medium text-primary/70 uppercase tracking-widest mt-1">Commission</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 px-4 py-8 overflow-y-auto space-y-2 custom-scrollbar">
          <NavGroup
            items={visibleMainItems}
            pathname={pathname}
            onNavigate={onNavigate}
          />

          {isAdmin && (
            <NavGroup
              label="Admin Hub"
              items={adminItems}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          )}

          <NavGroup
            label="Account"
            items={[{ to: "/settings", labelKey: "nav.settings", icon: Settings }]}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </nav>

        {/* User card + logout */}
        <div className="relative p-4 space-y-2 border-t border-white/[0.06] bg-white/[0.01] shrink-0">
          {user && <UserAvatar name={user.name} role={user.role} />}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl px-3.5 py-2.5 text-white/35 hover:text-rose-400 hover:bg-rose-500/8 text-xs font-medium transition-all"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>

      </aside>
    </>
  );
};

export default AppSidebar;
