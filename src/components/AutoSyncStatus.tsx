import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Activity, CheckCircle2, ChevronDown, Clock, XCircle, Zap } from "lucide-react";

type SyncRun = {
  id: string;
  source: string;
  mode: string;
  status: string;
  records_seen: number;
  rows_written: number;
  errors: string[] | null;
  started_at: string;
  finished_at: string | null;
  triggered_by: string | null;
};

type Profile = { id: string; name: string; role: string };

const SOURCE_LABELS: Record<string, string> = {
  aircall: "Aircall",
  iclosed: "iClosed",
  jotform: "JotForm",
  fathom:  "Fathom",
};

const ROLE_COLORS: Record<string, string> = {
  admin:  "bg-amber-500/10 text-amber-600",
  closer: "bg-primary/10 text-primary",
  setter: "bg-emerald-500/10 text-emerald-600",
};

const STATUS_STYLE: Record<string, { dot: string; badge: string; icon: React.ReactNode }> = {
  success: { dot: "bg-emerald-500", badge: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  partial: { dot: "bg-amber-500",   badge: "text-amber-600 bg-amber-500/10 border-amber-500/20",     icon: <Activity    className="h-3 w-3" /> },
  error:   { dot: "bg-rose-500",    badge: "text-rose-600 bg-rose-500/10 border-rose-500/20",         icon: <XCircle     className="h-3 w-3" /> },
  running: { dot: "bg-blue-500 animate-pulse", badge: "text-blue-600 bg-blue-500/10 border-blue-500/20", icon: <Activity className="h-3 w-3 animate-pulse" /> },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)    return "just now";
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function duration(start: string, end: string | null) {
  if (!end) return null;
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

const BATCH = 10;

export default function AutoSyncStatus() {
  const [open, setOpen] = useState(true);
  const [visible, setVisible] = useState(BATCH);
  const { data: runs = [] } = useQuery<SyncRun[]>({
    queryKey: ["auto_sync_runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_sync_runs")
        .select("id, source, mode, status, records_seen, rows_written, errors, started_at, finished_at, triggered_by")
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles_for_sync_log"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, name, role");
      return (data ?? []) as Profile[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const latest: Record<string, SyncRun> = {};
  for (const run of runs) {
    if (!latest[run.source]) latest[run.source] = run;
  }

  const lastScheduled = runs.find(r => r.mode === "scheduled");
  const sources = ["aircall", "iclosed", "jotform", "fathom"];

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-background">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 flex-1">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Sync Activity</p>
          <span className="text-[11px] text-muted-foreground">· Auto-runs every 30 min</span>
        </div>
        <div className="flex items-center gap-2">
          {lastScheduled ? (
            <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium", STATUS_STYLE[lastScheduled.status]?.badge ?? "")}>
              {STATUS_STYLE[lastScheduled.status]?.icon}
              Last scheduled {timeAgo(lastScheduled.started_at)}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">No scheduled runs yet</span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground/50 transition-transform duration-300 ease-in-out", open && "rotate-180")} />
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
      <div className="overflow-hidden"><div className="p-4 space-y-5">

        {/* Per-source status cards */}
        <div className="grid gap-3 sm:grid-cols-4">
          {sources.map((source) => {
            const run   = latest[source];
            const style = run ? (STATUS_STYLE[run.status] ?? STATUS_STYLE.error) : null;
            return (
              <div key={source} className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {style && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />}
                    <p className="text-xs font-medium">{SOURCE_LABELS[source]}</p>
                  </div>
                  {run && style && (
                    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", style.badge)}>
                      {style.icon} {run.status}
                    </span>
                  )}
                </div>
                {run ? (
                  <>
                    <p className="text-sm font-semibold tabular-nums">{run.rows_written.toLocaleString()} written</p>
                    <p className="text-[11px] text-muted-foreground">{run.records_seen.toLocaleString()} seen · {timeAgo(run.started_at)}</p>
                    {!!run.errors?.length && (
                      <p className="text-[11px] text-rose-500 line-clamp-1 mt-0.5">{run.errors[0]}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No runs yet</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Full audit log */}
        {runs.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Audit Log</p>
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/30">
                    <th className="text-left py-2 px-3 text-[11px] font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 text-[11px] font-medium text-muted-foreground">Source</th>
                    <th className="text-left py-2 px-3 text-[11px] font-medium text-muted-foreground">Triggered by</th>
                    <th className="text-left py-2 px-3 text-[11px] font-medium text-muted-foreground">Mode</th>
                    <th className="text-right py-2 px-3 text-[11px] font-medium text-muted-foreground">Records</th>
                    <th className="text-right py-2 px-3 text-[11px] font-medium text-muted-foreground">Duration</th>
                    <th className="text-right py-2 px-3 text-[11px] font-medium text-muted-foreground">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {runs.slice(0, visible).map((run) => {
                    const style   = STATUS_STYLE[run.status] ?? STATUS_STYLE.error;
                    const profile = run.triggered_by ? profileMap.get(run.triggered_by) : null;
                    const dur     = duration(run.started_at, run.finished_at);
                    return (
                      <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", style.badge)}>
                            {style.icon} {run.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs font-medium">{SOURCE_LABELS[run.source] ?? run.source}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {profile ? (
                            <div className="flex items-center gap-1.5">
                              <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shrink-0", ROLE_COLORS[profile.role] ?? "bg-muted text-muted-foreground")}>
                                {profile.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-xs">{profile.name}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/50 italic">
                              {run.mode === "scheduled" ? "Auto" : "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            run.mode === "scheduled"
                              ? "bg-violet-500/10 text-violet-600"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {run.mode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span className="text-xs font-medium">{run.rows_written.toLocaleString()}</span>
                          <span className="text-[11px] text-muted-foreground"> / {run.records_seen.toLocaleString()}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {dur ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />{dur}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div>
                            <p className="text-[11px] text-muted-foreground/50">{timeAgo(run.started_at)}</p>
                            {!!run.errors?.length && (
                              <p className="text-[10px] text-rose-500 line-clamp-1 mt-0.5 max-w-[180px]">{run.errors[0]}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {runs.length > visible && (
              <button
                onClick={() => setVisible(v => v + BATCH)}
                className="mt-2 w-full rounded-lg border border-border/40 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              >
                Show {Math.min(BATCH, runs.length - visible)} more · {runs.length - visible} remaining
              </button>
            )}
          </div>
        )}
      </div>
      </div></div>
    </div>
  );
}
