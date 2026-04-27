import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, CheckCircle2, XCircle, Zap } from "lucide-react";

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
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const statusStyle: Record<string, { color: string; icon: React.ReactNode }> = {
  success: { color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  partial: { color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: <Activity className="h-3 w-3" /> },
  error:   { color: "text-rose-500 bg-rose-500/10 border-rose-500/20",   icon: <XCircle className="h-3 w-3" /> },
  running: { color: "text-blue-500 bg-blue-500/10 border-blue-500/20",   icon: <Activity className="h-3 w-3 animate-pulse" /> },
};

export default function AutoSyncStatus() {
  const { data: runs = [] } = useQuery<SyncRun[]>({
    queryKey: ["auto_sync_runs"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("integration_sync_runs")
        .select("id, source, mode, status, records_seen, rows_written, errors, started_at, finished_at")
        .order("started_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  // Most recent run per source
  const latest: Record<string, SyncRun> = {};
  for (const run of runs) {
    if (!latest[run.source]) latest[run.source] = run;
  }

  const scheduledRuns = runs.filter(r => r.mode === "scheduled");
  const lastScheduled = scheduledRuns[0];

  return (
    <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden mt-6">
      <div className="p-8 border-b border-border/40 bg-muted/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">Auto Sync</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Scheduled via GitHub Actions — every 30 minutes
            </p>
          </div>
        </div>
        {lastScheduled ? (
          <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold border gap-1.5", statusStyle[lastScheduled.status]?.color ?? "")}>
            {statusStyle[lastScheduled.status]?.icon}
            Last run {timeAgo(lastScheduled.started_at)}
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
            No scheduled runs yet
          </Badge>
        )}
      </div>

      <CardContent className="p-8 space-y-8">
        {/* Per-source status */}
        <div className="grid gap-4 sm:grid-cols-3">
          {["aircall", "iclosed", "jotform"].map((source) => {
            const run = latest[source];
            const style = run ? (statusStyle[run.status] ?? statusStyle.error) : null;
            return (
              <div key={source} className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {source === "jotform" ? "JotForm" : source === "iclosed" ? "iClosed" : "Aircall"}
                  </p>
                  {run && style && (
                    <Badge className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold border gap-1", style.color)}>
                      {style.icon} {run.status}
                    </Badge>
                  )}
                </div>
                {run ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold tabular-nums">
                      {run.rows_written.toLocaleString()} rows written
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.records_seen.toLocaleString()} seen · {timeAgo(run.started_at)}
                    </p>
                    {!!run.errors?.length && (
                      <p className="text-[10px] text-rose-500 font-medium truncate">
                        {run.errors[0]}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No sync runs yet</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent runs table */}
        {runs.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recent Runs</p>
            <div className="divide-y divide-border/30 rounded-2xl border border-border/40 overflow-hidden">
              {runs.slice(0, 8).map((run) => {
                const style = statusStyle[run.status] ?? statusStyle.error;
                return (
                  <div key={run.id} className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/10 transition-colors">
                    <Badge className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold border gap-1 shrink-0", style.color)}>
                      {style.icon} {run.status}
                    </Badge>
                    <span className="font-medium text-xs capitalize min-w-[70px]">{run.source}</span>
                    <span className="text-xs text-muted-foreground capitalize min-w-[60px]">{run.mode}</span>
                    <span className="text-xs tabular-nums text-muted-foreground flex-1">
                      {run.rows_written} written / {run.records_seen} seen
                    </span>
                    <span className="text-xs text-muted-foreground/50 shrink-0">
                      {timeAgo(run.started_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
