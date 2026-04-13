import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import {
  LayoutDashboard, BarChart2, AlertTriangle, Shield,
  Users, UserCog, Settings, LogOut, Menu, X, Sparkles, ChevronRight
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
  const roleStyles: Record<string, string> = {
    admin:  "bg-primary text-white shadow-primary/20",
    closer: "bg-emerald-500 text-white shadow-emerald-500/20",
    setter: "bg-amber-500 text-white shadow-amber-500/20",
  };
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm group transition-all hover:bg-white/[0.05]">
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-lg transform transition-transform group-hover:scale-105",
        roleStyles[role] ?? roleStyles.admin
      )}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white truncate leading-tight tracking-tight">{name}</p>
        <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mt-0.5">{role}</p>
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
        <p className="px-5 pt-6 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 select-none">
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
              "group relative flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm font-bold transition-all duration-300",
              active
                ? "bg-primary text-white shadow-xl shadow-primary/20"
                : "text-white/40 hover:text-white hover:bg-white/[0.05]"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-300", active ? "scale-110" : "group-hover:scale-110")} />
            <span className="flex-1">{t(labelKey)}</span>
            {active && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
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
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-md lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden text-white bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl"
        onClick={onToggle}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-72 flex-col",
        "bg-[#0A0D14] text-white border-r border-white/5",
        "transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Grain Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

        {/* Logo */}
        <div className="relative flex h-20 items-center gap-4 px-6 border-b border-white/5 shrink-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-2xl shadow-primary/40 ring-4 ring-primary/10">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-black text-white tracking-tight leading-none">Elite CP</p>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em] mt-1">Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 px-4 py-8 overflow-y-auto space-y-2 custom-scrollbar">
          <NavGroup
            items={mainItems}
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
        <div className="relative p-4 space-y-3 border-t border-white/5 pt-6 bg-white/[0.01] shrink-0">
          {user && <UserAvatar name={user.name} role={user.role} />}
          <Button
            variant="ghost"
            className="w-full justify-start gap-4 rounded-xl px-4 py-6 text-white/40 hover:text-rose-500 hover:bg-rose-500/10 text-xs font-black uppercase tracking-widest transition-all"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

      </aside>
    </>
  );
};

export default AppSidebar;
