import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import {
  LayoutDashboard, BarChart2, AlertTriangle, Shield,
  Users, UserCog, Settings, LogOut, Menu, X, ChevronRight,
  Phone, Brain, MessageSquare, Target, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Nav structure ────────────────────────────────────────────────────────────
type NavItem = { to: string; labelKey: string; icon: React.ElementType };

const mainItems: NavItem[] = [
  { to: "/dashboard",        labelKey: "nav.dashboard",        icon: LayoutDashboard },
  { to: "/analytics",        labelKey: "nav.analytics",        icon: BarChart2       },
  { to: "/setter-dashboard", labelKey: "nav.setterDashboard",  icon: Target          },
  { to: "/calls",            labelKey: "nav.calls",            icon: Phone           },
  { to: "/assistant",        labelKey: "nav.assistant",        icon: MessageSquare   },
];

const adminItems: NavItem[] = [
  { to: "/refunds",     labelKey: "nav.refunds",   icon: AlertTriangle },
  { to: "/admin",       labelKey: "nav.admin",     icon: Shield        },
  { to: "/coaching",    labelKey: "nav.coaching",  icon: Brain         },
  { to: "/team",        labelKey: "nav.team",      icon: Users         },
  { to: "/team/manage", labelKey: "nav.teamManage", icon: UserCog      },
];

// ─── NavGroup ─────────────────────────────────────────────────────────────────
function NavGroup({
  label,
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
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
      {label && !collapsed && (
        <p className="px-3 pt-4 pb-1 text-[10px] font-medium text-white/30 select-none">
          {label}
        </p>
      )}
      {label && collapsed && <div className="pt-3" />}

      {items.map(({ to, labelKey, icon: Icon }) => {
        const active = bestScore >= 0 && getScore(to) === bestScore;
        const label  = t(labelKey);

        if (collapsed) {
          return (
            <Tooltip key={to} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 mx-auto rounded-lg transition-colors",
                    active
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
            <span className="flex-1">{label}</span>
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
  collapsed,
  onToggle,
  onCollapse,
  onNavigate,
}: {
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onNavigate: () => void;
}) => {
  const { pathname } = useLocation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isAdmin = user?.role === "admin";
  const canSeeSetterDashboard = user?.role === "admin" || user?.role === "setter";
  const canSeeAssistant       = user?.role === "admin" || user?.role === "closer";
  const canSeeCalls            = user?.role === "admin" || user?.role === "closer";

  const handleLogout = () => { onNavigate(); logout(); navigate("/"); };

  const visibleMainItems = mainItems.filter((item) => {
    if (item.to === "/setter-dashboard") return canSeeSetterDashboard;
    if (item.to === "/calls")            return canSeeCalls;
    if (item.to === "/assistant")        return canSeeAssistant && !isAdmin;
    return true;
  });

  const initials = (user?.name ?? "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleColors: Record<string, string> = {
    admin:  "bg-primary/20 text-primary",
    closer: "bg-emerald-500/20 text-emerald-400",
    setter: "bg-amber-500/20 text-amber-400",
  };

  return (
    <TooltipProvider>
      <>
        {/* Mobile backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-md lg:hidden"
            onClick={onToggle}
          />
        )}

        {/* Mobile toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50 lg:hidden text-white bg-black/60 border border-white/10 rounded-lg h-8 w-8"
          onClick={onToggle}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        <aside className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col",
          "bg-[#0A0D14] text-white border-r border-white/[0.06]",
          "transition-all duration-300 ease-in-out",
          collapsed ? "w-14" : "w-64",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>

          {/* Logo */}
          <div className="flex h-[60px] items-center gap-3 px-4 border-b border-white/[0.06] shrink-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 overflow-hidden ring-1 ring-white/10">
              <img src="/Les Copywriters Logo.jpg" alt="Les Copywriters Logo" className="h-full w-full object-cover" />
            </div>
            {!collapsed && (
              <>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-none whitespace-nowrap">Les CopyWriters</p>
                  <p className="text-[10px] text-primary/60 mt-0.5">Commission</p>
                </div>
                <button
                  onClick={onCollapse}
                  className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className={cn(
            "relative flex-1 py-4 overflow-y-auto space-y-0.5 custom-scrollbar",
            collapsed ? "px-2" : "px-3"
          )}>
            {/* Expand button — only shown in collapsed rail, at top of nav */}
            {collapsed && (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onCollapse}
                    className="flex items-center justify-center h-9 w-9 mx-auto rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors mb-2"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-medium">Expand sidebar</TooltipContent>
              </Tooltip>
            )}

            <NavGroup
              items={visibleMainItems}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />

            {isAdmin && (
              <NavGroup
                label="Admin Hub"
                items={adminItems}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )}

            <NavGroup
              label="Account"
              items={[{ to: "/settings", labelKey: "nav.settings", icon: Settings }]}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </nav>

          {/* User + collapse button */}
          <div className={cn(
            "border-t border-white/[0.06] shrink-0",
            collapsed ? "px-2 py-3 space-y-2" : "px-3 py-3 space-y-1"
          )}>
            {/* User avatar */}
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex h-9 w-9 mx-auto items-center justify-center rounded-md text-xs font-semibold cursor-default",
                    roleColors[user?.role ?? ""] ?? roleColors.admin
                  )}>
                    {initials}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-medium">
                  {user?.name} · {user?.role}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                  roleColors[user?.role ?? ""] ?? roleColors.admin
                )}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-[11px] text-white/35 capitalize">{user?.role}</p>
                </div>
              </div>
            )}

            {/* Sign out */}
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center h-9 w-9 mx-auto rounded-lg text-white/35 hover:text-rose-400 hover:bg-rose-500/8 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-medium">Sign Out</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-white/35 hover:text-rose-400 hover:bg-rose-500/8 transition-colors text-sm font-medium"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </aside>
      </>
    </TooltipProvider>
  );
};

export default AppSidebar;
