import { useMemo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import {
  useSetterPerformance,
  useSetterDailyActivity,
  useSyncSetterDashboard,
  type SetterPerformanceRow,
} from "@/hooks/useSetterDashboard";
import AppLayout from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn, parseSyncResult, isMigrationMissing } from "@/lib/utils";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays, parseISO } from "date-fns";

// ── Date helpers ──────────────────────────────────────────────────────────────
type DatePreset = "today" | "7d" | "30d" | "90d" | "custom";
const PRESET_KEYS: DatePreset[] = ["today", "7d", "30d", "90d", "custom"];

function computeRange(preset: DatePreset, customFrom: string, customTo: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (preset === "today")  return { from: today, to: today };
  if (preset === "7d")     return { from: format(subDays(new Date(), 6),  "yyyy-MM-dd"), to: today };
  if (preset === "30d")    return { from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: today };
  if (preset === "90d")    return { from: format(subDays(new Date(), 89), "yyyy-MM-dd"), to: today };
  if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  return { from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: today };
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtEur(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K€`;
  return `${n.toLocaleString("fr-FR")} €`;
}

function fmtDuration(s: number) {
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function shortDate(iso: string) {
  try { return format(parseISO(iso), "EEE d"); } catch { return iso; }
}

// ── Colour-coded badges ───────────────────────────────────────────────────────
function cancelBadge(pct: number) {
  if (pct <= 3) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (pct <= 5) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-rose-500/10 text-rose-700 border-rose-500/20";
}

function showBadge(pct: number) {
  if (pct >= 80) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (pct >= 70) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-rose-500/10 text-rose-700 border-rose-500/20";
}

const AVATAR_COLORS = [
  "bg-primary/10 text-primary",
  "bg-emerald-500/10 text-emerald-700",
  "bg-amber-500/10 text-amber-700",
  "bg-rose-500/10 text-rose-700",
];

// ── Compact KPI tile ──────────────────────────────────────────────────────────
const Tile = ({ label, value, sub, valueClass = "" }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) => (
  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("text-xl font-semibold tabular-nums leading-none", valueClass)}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground/60">{sub}</p>}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const SetterDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();

  const preset     = (params.get("range") as DatePreset) || "7d";
  const customFrom = params.get("from") ?? "";
  const customTo   = params.get("to")   ?? "";
  const { from, to } = computeRange(preset, customFrom, customTo);

  // All hooks called unconditionally before any early return (React rules of hooks)
  const syncMutation = useSyncSetterDashboard();
  const { data: perfRows = [], isLoading, isError, error } = useSetterPerformance(from, to);
  const chartProfileId = user?.role === "setter" ? user.id : undefined;
  const { data: dailyPoints = [] } = useSetterDailyActivity(from, to, chartProfileId);

  // isAllowed check — placed after all hooks per React rules of hooks
  const isAllowed = user?.role === "admin" || user?.role === "setter";

  const setPreset = (p: DatePreset) => {
    const n = new URLSearchParams(params);
    n.set("range", p);
    if (p !== "custom") { n.delete("from"); n.delete("to"); }
    setParams(n);
  };

  const perfError = error instanceof Error ? error.message : "";
  const migrationMissing = isMigrationMissing(perfError);

  const visibleRows: SetterPerformanceRow[] =
    user?.role === "setter" ? perfRows.filter(r => r.profileId === user.id) : perfRows;

  const team = useMemo(() => {
    const s = visibleRows.reduce(
      (a, r) => ({
        dialed: a.dialed + r.dialed,
        pickup: a.pickup + r.pickup,
        validated: a.validated + r.validated,
        shows: a.shows + r.shows,
        noShows: a.noShows + r.noShows,
        closed: a.closed + r.closed,
        setterCancellations: a.setterCancellations + r.setterCancellations,
        totalEncaisse: a.totalEncaisse + r.totalEncaisse,
        wDuration: a.wDuration + r.avgDurationSeconds * r.pickup,
      }),
      { dialed: 0, pickup: 0, validated: 0, shows: 0, noShows: 0, closed: 0, setterCancellations: 0, totalEncaisse: 0, wDuration: 0 },
    );
    return {
      ...s,
      pickupPct:  s.dialed > 0    ? (s.pickup / s.dialed) * 100 : 0,
      showPct:    s.validated > 0 ? (s.shows / s.validated) * 100 : 0,
      closePct:   s.shows > 0     ? (s.closed / s.shows) * 100 : 0,
      cancelPct:  s.pickup > 0    ? (s.setterCancellations / s.pickup) * 100 : 0,
      eurPerVal:  s.validated > 0 ? s.totalEncaisse / s.validated : 0,
      avgDur:     s.pickup > 0    ? Math.round(s.wDuration / s.pickup) : 0,
    };
  }, [visibleRows]);

  const chartData = useMemo(() => {
    const map = new Map<string, { dialed: number; pickup: number; validated: number }>();
    for (const p of dailyPoints) {
      const cur = map.get(p.date) ?? { dialed: 0, pickup: 0, validated: 0 };
      cur.dialed += p.dialed; cur.pickup += p.pickup; cur.validated += p.validated;
      map.set(p.date, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: shortDate(date), ...v }));
  }, [dailyPoints]);

  if (!isAllowed) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ── Setup warning ── */}
        {isError && migrationMissing && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Supabase migrations not yet applied.
              Run <code className="font-mono text-xs bg-muted px-1 rounded">20260502_iclosed_event_records.sql</code> and{" "}
              <code className="font-mono text-xs bg-muted px-1 rounded">20260502_setter_performance_rpc.sql</code>,
              then redeploy <code className="font-mono text-xs bg-muted px-1 rounded">sync-setter-dashboard</code>.
            </p>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("setter.teamOverview.subtitle").split("·")[0].trim()}</p>
            <h1 className="text-xl font-semibold">{t("setter.teamOverview.title")}</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate(
                // Setters only sync iClosed — Aircall re-fetches 3000+ calls and causes timeouts.
                // Aircall is handled by the admin's scheduled sync.
                { source: user?.role === "setter" ? "iclosed" : "all" },
                {
                  onSuccess: (data) => {
                    const { message, hasErrors } = parseSyncResult(data);
                    if (hasErrors) toast.warning(message); else toast.success(message);
                  },
                  onError: (e) => toast.error(e.message),
                },
              )}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
              {syncMutation.isPending ? t("settings.syncing") : t("setter.syncAll")}
            </button>

            {/* Date presets */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              {PRESET_KEYS.map(key => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-all",
                    preset === key
                      ? "bg-background text-foreground shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`setter.preset.${key}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom date range */}
        {preset === "custom" && (
          <div className="flex items-center gap-3 flex-wrap">
            <Input type="date" value={customFrom} className="h-8 w-36 text-sm rounded-lg"
              onChange={e => { const n = new URLSearchParams(params); n.set("range","custom"); n.set("from",e.target.value); setParams(n); }} />
            <span className="text-xs text-muted-foreground">→</span>
            <Input type="date" value={customTo} className="h-8 w-36 text-sm rounded-lg"
              onChange={e => { const n = new URLSearchParams(params); n.set("range","custom"); n.set("to",e.target.value); setParams(n); }} />
          </div>
        )}

        {/* ── KPI row ── */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            <Tile label={t("setter.kpi.dialed")}       value={team.dialed.toLocaleString("fr-FR")} sub={`${team.pickupPct.toFixed(0)}% décroché`} />
            <Tile label={t("setter.kpi.pickup")}       value={team.pickup.toLocaleString("fr-FR")} sub={`${team.validated > 0 ? ((team.validated/Math.max(team.pickup,1))*100).toFixed(0) : 0}% → validé`} />
            <Tile label={t("setter.kpi.validated")}    value={String(team.validated)} sub={`${team.shows} shows · ${team.noShows} NS`} />
            <Tile label={t("setter.kpi.showRate")}     value={`${team.showPct.toFixed(0)}%`} valueClass={team.showPct >= 70 ? "text-emerald-600" : "text-amber-600"} />
            <Tile label={t("setter.leaderboard.colClosed")}  value={String(team.closed)} sub={`${team.closePct.toFixed(0)}% close rate`} />
            <Tile label={t("setter.kpi.encaisse")}     value={fmtEur(team.totalEncaisse)} />
            <Tile label={t("setter.kpi.eurPerValidated")} value={`${Math.round(team.eurPerVal).toLocaleString("fr-FR")} €`} sub={t("setter.kpi.benchmarkSub")} />
            <Tile label={t("setter.kpi.cancelRate")}   value={`${team.cancelPct.toFixed(1)}%`} valueClass={team.cancelPct > 5 ? "text-rose-600" : team.cancelPct > 3 ? "text-amber-600" : ""} sub={`${team.setterCancellations} / ${team.pickup}`} />
          </div>
        )}

        {/* ── Daily activity chart ── */}
        <div className="rounded-lg border border-border/40 bg-background p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">{t("setter.chart.dailyActivity")}</p>
            <div className="flex gap-3">
              {[
                { color: "hsl(var(--primary))", label: t("setter.chart.dialed") },
                { color: "#10b981", label: t("setter.chart.pickup") },
                { color: "#f59e0b", label: t("setter.chart.validated") },
              ].map(s => (
                <span key={s.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
              {t("setter.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                />
                <Bar dataKey="dialed"    name={t("setter.chart.dialed")}    fill="hsl(var(--primary))" radius={[3,3,0,0]} />
                <Bar dataKey="pickup"    name={t("setter.chart.pickup")}    fill="#10b981"             radius={[3,3,0,0]} />
                <Bar dataKey="validated" name={t("setter.chart.validated")} fill="#f59e0b"             radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Leaderboard ── */}
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
            <p className="text-sm font-medium">{t("setter.leaderboard.title")}</p>
            <span className="text-[11px] text-muted-foreground">{t("setter.leaderboard.sortedBy")}</span>
          </div>

          {isError && !migrationMissing && (
            <p className="p-4 text-sm text-muted-foreground">{t("setter.loadError")}</p>
          )}

          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-[11px] text-muted-foreground">
                    <th className="text-left py-2 px-4 font-medium">{t("setter.leaderboard.colSetter")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.leaderboard.colDialed")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.leaderboard.colPickup")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.leaderboard.colValid")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.leaderboard.colCancel")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.leaderboard.colShow")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.leaderboard.colClosed")}</th>
                    <th className="text-right py-2 px-2 font-medium">{t("setter.leaderboard.colEncaisse")}</th>
                    <th className="text-right py-2 px-4 font-medium">{t("setter.leaderboard.colEurValid")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => (
                    <tr
                      key={row.profileId}
                      className="border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/setter-dashboard/setter/${row.profileId}?range=${preset}${preset==="custom"?`&from=${from}&to=${to}`:""}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0", AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                            {row.fullName.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium">{row.fullName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center tabular-nums">{row.dialed}</td>
                      <td className="py-3 px-2 text-center tabular-nums">
                        {row.pickup} <span className="text-[10px] text-muted-foreground">({row.pickupRatePct.toFixed(0)}%)</span>
                      </td>
                      <td className="py-3 px-2 text-center tabular-nums">{row.validated}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", cancelBadge(row.cancelRatePct))}>
                          {row.cancelRatePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", showBadge(row.showRatePct))}>
                          {row.showRatePct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center tabular-nums font-medium">{row.closed}</td>
                      <td className="py-3 px-2 text-right tabular-nums">{row.totalEncaisse.toLocaleString("fr-FR")} €</td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">
                        {Math.round(row.eurPerValidated).toLocaleString("fr-FR")} €
                      </td>
                    </tr>
                  ))}

                  {/* Total row — only meaningful when multiple setters are shown (admin view) */}
                  {visibleRows.length > 1 && (
                    <tr className="bg-muted/20 border-t border-border/40 text-sm font-medium">
                      <td className="py-2.5 px-4 text-muted-foreground text-[11px] uppercase tracking-wide">{t("setter.leaderboard.totalRow")}</td>
                      <td className="py-2.5 px-2 text-center tabular-nums">{team.dialed.toLocaleString("fr-FR")}</td>
                      <td className="py-2.5 px-2 text-center tabular-nums">{team.pickup.toLocaleString("fr-FR")} <span className="text-[10px] text-muted-foreground">({team.pickupPct.toFixed(0)}%)</span></td>
                      <td className="py-2.5 px-2 text-center tabular-nums">{team.validated}</td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-muted-foreground">{team.cancelPct.toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-muted-foreground">{team.showPct.toFixed(0)}%</td>
                      <td className="py-2.5 px-2 text-center tabular-nums">{team.closed}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{team.totalEncaisse.toLocaleString("fr-FR")} €</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-primary">{Math.round(team.eurPerVal).toLocaleString("fr-FR")} €</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-2 text-[11px] text-muted-foreground/50">{t("setter.leaderboard.footnote")}</p>
        </div>

      </div>
    </AppLayout>
  );
};

export default SetterDashboardPage;
