import { useRef, useState, useMemo } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { useProfiles } from "@/hooks/useProfiles";
import {
  useSetterPerformance,
  useSetterDailyActivity,
  useSetterCallHistory,
  type SetterCallHistoryRow,
} from "@/hooks/useSetterDashboard";
import AppLayout from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, isMigrationMissing } from "@/lib/utils";
import { ArrowLeft, Play, Pause, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays, parseISO } from "date-fns";

// ── Date helpers ──────────────────────────────────────────────────────────────
type DatePreset = "today" | "7d" | "30d" | "90d";
const PRESET_KEYS: DatePreset[] = ["today", "7d", "30d", "90d"];

function computeRange(preset: DatePreset) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d")    return { from: format(subDays(new Date(), 6),  "yyyy-MM-dd"), to: today };
  if (preset === "30d")   return { from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: today };
  return { from: format(subDays(new Date(), 89), "yyyy-MM-dd"), to: today };
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtEur(n: number) { return `${n.toLocaleString("fr-FR")} €`; }
function fmtDur(s: number) { return `${Math.floor(s/60)}m ${String(s%60).padStart(2,"0")}s`; }
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { const d = parseISO(iso); return `${format(d,"d MMM")} · ${format(d,"HH")}h${format(d,"mm")}`; } catch { return "—"; }
}
function shortDate(iso: string) {
  try { return format(parseISO(iso), "EEE d"); } catch { return iso; }
}

// ── Call status ───────────────────────────────────────────────────────────────
type DS = SetterCallHistoryRow["displayStatus"];
const STATUS_CLASSES: Record<DS, string> = {
  closed:        "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  annule_setter: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  no_show:       "bg-rose-500/10 text-rose-700 border-rose-500/20",
  valide:        "bg-primary/10 text-primary border-primary/20",
  pas_decroche:  "bg-muted/50 text-muted-foreground border-border/30",
};

const AVATAR_COLORS = [
  "bg-primary/10 text-primary",
  "bg-emerald-500/10 text-emerald-700",
  "bg-amber-500/10 text-amber-700",
  "bg-rose-500/10 text-rose-700",
];

// ── Compact KPI tile ──────────────────────────────────────────────────────────
const Tile = ({ label, value, sub, valueClass = "", cardClass = "" }: {
  label: string; value: string; sub?: string; valueClass?: string; cardClass?: string;
}) => (
  <div className={cn("rounded-lg p-3 space-y-1", cardClass || "bg-muted/50")}>
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("text-xl font-semibold tabular-nums leading-none", valueClass)}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground/60">{sub}</p>}
  </div>
);

// ── Audio button ──────────────────────────────────────────────────────────────
const AudioButton = ({ url }: { url: string }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else         { ref.current.play();  setPlaying(true);  }
  };
  return (
    <>
      <audio ref={ref} src={url} onEnded={() => setPlaying(false)} />
      <button
        onClick={toggle}
        className="h-7 w-7 rounded-full border border-border/50 bg-background flex items-center justify-center hover:bg-muted transition-colors"
      >
        {playing ? <Pause className="h-2.5 w-2.5 fill-current" /> : <Play className="h-2.5 w-2.5 fill-current" />}
      </button>
    </>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const SetterDetailPage = () => {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const { t }         = useLanguage();
  const [sp, setSp]   = useSearchParams();

  // Compute values needed by hooks before any early returns
  const effectiveId = user?.role === "setter" ? user.id : (profileId ?? user?.id ?? "");
  const preset = (sp.get("range") as DatePreset) ?? "7d";
  const { from, to } = computeRange(preset);
  const setPreset = (p: DatePreset) => {
    const n = new URLSearchParams(sp); n.set("range", p); setSp(n);
  };

  // All hooks called unconditionally before any early return (React rules of hooks)
  const { data: profiles = [] }   = useProfiles();
  const setters = profiles.filter(p => p.role === "setter");

  const { data: allPerf = [], isLoading: perfLoading, error: perfErrorObj } = useSetterPerformance(from, to);
  const perfErrMsg = perfErrorObj instanceof Error ? perfErrorObj.message : "";
  const migrationMissing = isMigrationMissing(perfErrMsg);

  const { data: daily = [] }                             = useSetterDailyActivity(from, to, effectiveId);
  const { data: calls = [], isLoading: callsLoading }    = useSetterCallHistory(effectiveId, from, to);

  const myPerf     = allPerf.find(r => r.profileId === effectiveId);
  const setterName = myPerf?.fullName ?? profiles.find(p => p.id === effectiveId)?.name ?? "Setter";

  const teamEurPerVal = useMemo(() => {
    const enc = allPerf.reduce((s, r) => s + r.totalEncaisse, 0);
    const val = allPerf.reduce((s, r) => s + r.validated, 0);
    return val > 0 ? enc / val : 0;
  }, [allPerf]);

  // Early returns after all hooks
  const isAllowed = user?.role === "admin" || user?.role === "setter";
  if (!isAllowed) return <Navigate to="/dashboard" replace />;
  if (user?.role === "setter" && profileId && profileId !== user.id)
    return <Navigate to={`/setter-dashboard/setter/${user.id}`} replace />;

  const teamDialed = allPerf.reduce((s, r) => s + r.dialed, 0);
  const eurDiff    = myPerf ? Math.round(myPerf.eurPerValidated - teamEurPerVal) : 0;

  const chartData = daily.map(p => ({ date: shortDate(p.date), dialed: p.dialed, pickup: p.pickup, validated: p.validated }));

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Setup warning */}
        {migrationMissing && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">Run the two setter migrations in Supabase, then redeploy the edge function.</p>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/setter-dashboard?range=${preset}`)}
              className="flex items-center gap-1 rounded-lg border border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("setter.detail.backToTeam")}
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("role.setter")}</p>
              <h1 className="text-xl font-semibold">{setterName}</h1>
            </div>
          </div>

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

        {/* ── Setter pills (admin only) ── */}
        {user?.role === "admin" && setters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {setters.map((s, idx) => {
              const active = s.id === effectiveId;
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/setter-dashboard/setter/${s.id}?range=${preset}`)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
                    active
                      ? "bg-primary/10 text-primary border-primary/30 font-medium"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60",
                  )}
                >
                  <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium", AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  {s.name}
                </button>
              );
            })}
          </div>
        )}

        {/* ── KPI grid ── */}
        {perfLoading ? (
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-9">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-9">
            <Tile label={t("setter.kpi.dialed")}   value={String(myPerf?.dialed ?? 0)}
              sub={teamDialed > 0 && myPerf ? `${((myPerf.dialed/teamDialed)*100).toFixed(0)}% équipe` : undefined} />
            <Tile label={t("setter.kpi.pickup")}   value={String(myPerf?.pickup ?? 0)}
              sub={`${myPerf?.pickupRatePct.toFixed(0) ?? 0}% décroché`} />
            <Tile label={t("setter.kpi.validated")} value={String(myPerf?.validated ?? 0)}
              sub={myPerf && myPerf.pickup > 0 ? `${((myPerf.validated/myPerf.pickup)*100).toFixed(0)}% du pick up` : undefined} />
            <Tile label={t("setter.kpi.showRate")} value={`${myPerf?.showRatePct.toFixed(0) ?? 0}%`}
              valueClass={(myPerf?.showRatePct ?? 0) >= 70 ? "text-emerald-600" : "text-amber-600"}
              sub={`${myPerf?.shows ?? 0} shows · ${myPerf?.noShows ?? 0} NS`} />
            <Tile label={t("setter.leaderboard.colClosed")} value={String(myPerf?.closed ?? 0)}
              sub={`${myPerf?.closeRatePct.toFixed(0) ?? 0}% close`} />
            <Tile label={t("setter.kpi.encaisse")} value={fmtEur(myPerf?.totalEncaisse ?? 0)} />
            <Tile label={t("setter.leaderboard.colEurValid")} value={fmtEur(Math.round(myPerf?.eurPerValidated ?? 0))}
              sub={myPerf ? `${eurDiff >= 0 ? "+" : ""}${eurDiff}€ ${t("setter.detail.eurVsTeam")}` : undefined}
              valueClass={eurDiff >= 0 ? "text-emerald-600" : "text-rose-600"} />
            <Tile label={t("setter.kpi.avgDuration")} value={fmtDur(myPerf?.avgDurationSeconds ?? 0)} />
            <Tile label={t("setter.kpi.cancelRate")}
              value={`${(myPerf?.cancelRatePct ?? 0).toFixed(1)}%`}
              valueClass={(myPerf?.cancelRatePct ?? 0) > 5 ? "text-rose-600" : (myPerf?.cancelRatePct ?? 0) > 3 ? "text-amber-600" : ""}
              sub={`${myPerf?.setterCancellations ?? 0} / ${myPerf?.pickup ?? 0}`}
              cardClass={(myPerf?.cancelRatePct ?? 0) > 5 ? "bg-rose-500/5 border border-rose-500/20" : "bg-muted/50"} />
          </div>
        )}

        {/* ── Activity chart ── */}
        <div className="rounded-lg border border-border/40 bg-background p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">{t("setter.chart.dailyActivityFor")} {setterName}</p>
            <div className="flex gap-3">
              {[
                { color: "hsl(var(--primary))", key: "setter.chart.dialed" },
                { color: "#10b981",             key: "setter.chart.pickup" },
                { color: "#f59e0b",             key: "setter.chart.validated" },
              ].map(s => (
                <span key={s.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  {t(s.key)}
                </span>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
              {t("setter.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
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

        {/* ── Call history ── */}
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
            <p className="text-sm font-medium">{t("setter.callHistory.title")}</p>
            <span className="text-[11px] text-muted-foreground">{calls.length} {t("setter.callHistory.hint")}</span>
          </div>

          {callsLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-[11px] text-muted-foreground">
                    <th className="text-left py-2 px-4 font-medium">{t("setter.callHistory.colDate")}</th>
                    <th className="text-left py-2 px-2 font-medium">{t("setter.callHistory.colProspect")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.callHistory.colDuration")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.callHistory.colStatus")}</th>
                    <th className="text-center py-2 px-2 font-medium">{t("setter.callHistory.colAudio")}</th>
                    <th className="text-right py-2 px-4 font-medium">{t("setter.callHistory.colEncaisse")}</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        {t("setter.callHistory.empty")}
                      </td>
                    </tr>
                  ) : calls.map(call => {
                    const sk = `setter.status.${
                      call.displayStatus === "annule_setter" ? "annuleSetter" :
                      call.displayStatus === "no_show"       ? "noShow" :
                      call.displayStatus === "pas_decroche"  ? "pasDecroche" :
                      call.displayStatus
                    }` as const;
                    return (
                      <tr key={call.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {fmtDate(call.startedAt)}
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-medium truncate max-w-[160px]">
                            {call.contactName ?? <span className="text-muted-foreground font-normal">{t("setter.callHistory.unknown")}</span>}
                          </p>
                          {call.contactPhone && <p className="text-[10px] text-muted-foreground">{call.contactPhone}</p>}
                        </td>
                        <td className="py-3 px-2 text-center text-xs tabular-nums">{fmtDur(call.durationSeconds)}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_CLASSES[call.displayStatus])}>
                            {t(sk)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {call.recordingUrl
                            ? <AudioButton url={call.recordingUrl} />
                            : <span className="text-muted-foreground/30 text-xs">—</span>
                          }
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {call.amountCollected > 0
                            ? <span className="font-semibold text-primary">{fmtEur(call.amountCollected)}</span>
                            : <span className="text-muted-foreground/30">—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-2 text-[11px] text-muted-foreground/50">{t("setter.callHistory.footnote")}</p>
        </div>

      </div>
    </AppLayout>
  );
};

export default SetterDetailPage;
