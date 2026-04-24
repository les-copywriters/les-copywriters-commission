import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { useProfiles } from "@/hooks/useProfiles";
import { useSetterCallRecords, useSetterDashboardMetrics, useSetterSyncHealth, useSyncSetterDashboard } from "@/hooks/useSetterDashboard";
import { computeSetterDateRange, formatTalkTime } from "@/lib/setterDashboard";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  RefreshCw,
  Timer,
  Trophy,
  Users,
  AlertTriangle,
  Search
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DatePreset = "thisMonth" | "lastMonth" | "last3m" | "last6m" | "thisYear" | "allTime" | "custom";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border: "rgba(128,128,128,0.12)",
  accent: "#f59e0b",
  success: "#10b981",
  warning: "#f97316",
  danger: "#ef4444",
};

const ChartCard = ({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden rounded-3xl">
    <div className="p-6 pb-0 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <h3 className="font-semibold text-sm text-foreground/70">{title}</h3>
      </div>
      {action}
    </div>
    <CardContent className="p-6">{children}</CardContent>
  </Card>
);

const EmptyChartState = ({ title, body }: { title: string; body: string }) => (
  <div className="flex h-[320px] items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 bg-muted/10 px-6 text-center">
    <div className="space-y-2">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  </div>
);

const SyncRunList = ({
  title,
  runs,
}: {
  title: string;
  runs: Array<{
    id: string;
    source: string;
    status: string;
    recordsSeen: number;
    rowsWritten: number;
    startedAt: string;
  }>;
}) => (
  <ChartCard
    title={title}
    icon={Activity}
    action={<Badge variant="outline" className="rounded-full px-3 py-1">{runs.length}</Badge>}
  >
    <div className="space-y-3">
      {runs.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border/60 bg-muted/10 px-5 py-8 text-center text-sm text-muted-foreground">
          No sync runs recorded yet.
        </div>
      ) : (
        runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-3 rounded-[1.75rem] border border-border/40 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">{run.source}</p>
                <Badge variant="outline" className="rounded-full capitalize text-xs">{run.status}</Badge>
              </div>
              <p className="text-sm font-semibold">{new Date(run.startedAt).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Seen</p>
                <p className="mt-1 font-semibold tabular-nums">{run.recordsSeen}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Written</p>
                <p className="mt-1 font-semibold tabular-nums">{run.rowsWritten}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </ChartCard>
);

const SetterDashboardPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: profiles = [] } = useProfiles();
  const syncAircall = useSyncSetterDashboard();
  const syncIclosed = useSyncSetterDashboard();

  const isAdmin = user?.role === "admin";
  const isSetter = user?.role === "setter";
  const isAllowed = isAdmin || isSetter;

  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedSetterId, setSelectedSetterId] = useState<string>("all");

  const { data: syncRuns = [] } = useSetterSyncHealth(isAdmin);
  const [testResults, setTestResults] = useState<{ aircall?: { ok: boolean }; iclosed?: { ok: boolean } } | null>(null);

  useQuery({
    queryKey: ["global_connection_test"],
    queryFn: async () => {
      try {
        const { data } = await supabase.functions.invoke("sync-setter-dashboard", {
          body: { validate_only: true }
        });
        setTestResults(data.results);
        return data.results;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // Check every 5 mins
  });
  const setters = profiles.filter((profile) => profile.role === "setter");
  const scopedSetterId = isAdmin ? (selectedSetterId === "all" ? undefined : selectedSetterId) : user?.id;

  const { start, end } = useMemo(
    () => computeSetterDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );

  const {
    data: metrics,
    isLoading,
    isError,
    error,
  } = useSetterDashboardMetrics({
    profileId: scopedSetterId,
    startDate: start,
    endDate: end,
    enabled: isAllowed,
  });

  const { data: callRecords = [] } = useSetterCallRecords(scopedSetterId);
  const [callSearch, setCallSearch] = useState("");
  const [callLimit, setCallLimit] = useState(25);
  const navigate = useNavigate();

  if (!isAllowed) return <Navigate to="/dashboard" replace />;

  const summary = metrics?.summary;
  const points = metrics?.points ?? [];
  const hasData = points.some((point) =>
    point.callsMade ||
    point.callsAnswered ||
    point.talkTimeSeconds ||
    point.leadsValidated ||
    point.leadsCanceled ||
    point.showUps ||
    point.closes,
  );

  const presetButtons: Array<{ key: DatePreset; label: string }> = [
    { key: "thisMonth", label: t("analytics.preset.thisMonth") },
    { key: "lastMonth", label: t("analytics.preset.lastMonth") },
    { key: "last3m", label: t("analytics.preset.last3m") },
    { key: "last6m", label: t("analytics.preset.last6m") },
    { key: "thisYear", label: t("analytics.preset.thisYear") },
    { key: "allTime", label: t("analytics.preset.allTime") },
    { key: "custom", label: t("analytics.preset.custom") },
  ];

  const syncErrorMessage = error instanceof Error ? error.message : t("setterDashboard.loadErrorBody");
  const looksLikeMissingTable = /setter_(call|funnel)_metrics_daily|schema cache/i.test(syncErrorMessage);

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{t("nav.setterDashboard")}</h1>
              {testResults?.aircall?.ok && testResults?.iclosed?.ok && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-none h-5 px-2 text-[10px] font-medium">
                  <Activity className="h-2.5 w-2.5 mr-1 animate-pulse" /> Live
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-muted-foreground">
                {isAdmin ? t("setterDashboard.subtitle") : `${user?.name} · ${t("setterDashboard.subtitle")}`}
              </p>
              {syncRuns[0] && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {new Date(syncRuns[0].startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-nowrap">
            {isAdmin && (
              <Select value={selectedSetterId} onValueChange={setSelectedSetterId}>
                <SelectTrigger className="h-9 min-w-[180px] rounded-lg border-border/60 bg-background text-sm">
                  <SelectValue placeholder={t("setterDashboard.chooseSetter")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">{t("setterDashboard.allSetters")}</SelectItem>
                  {setters.map((setter) => (
                    <SelectItem key={setter.id} value={setter.id}>{setter.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2 flex-nowrap">
              <Button
                variant="outline"
                size="sm"
                disabled={syncAircall.isPending || syncIclosed.isPending}
                className="h-9 px-3.5 rounded-lg text-sm border-border/60 whitespace-nowrap"
                onClick={() =>
                  syncAircall.mutate(
                    { source: "aircall", profileId: scopedSetterId },
                    {
                      onSuccess: (data) => {
                        const r = (data as any)?.results?.[0];
                        if (r?.errors?.length) toast.error(`Aircall: ${r.errors[0]}`);
                        else if (r?.rows_written > 0) toast.success(`Aircall synced — ${r.rows_written} rows written`);
                        else if (r?.records_seen > 0) toast.success(`Aircall sync complete — no calls found for this setter in the synced period.`);
                        else toast.warning("Aircall sync found 0 calls for this date range. Try a wider date range or verify the API credentials.");
                      },
                      onError: (syncError) => toast.error(syncError.message),
                    },
                  )
                }
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncAircall.isPending && "animate-spin")} />
                {syncAircall.isPending ? t("settings.syncing") : "Sync Aircall"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={syncAircall.isPending || syncIclosed.isPending}
                className="h-9 px-3.5 rounded-lg text-sm border-border/60 whitespace-nowrap"
                onClick={() =>
                  syncIclosed.mutate(
                    { source: "iclosed", profileId: scopedSetterId },
                    {
                      onSuccess: (data) => {
                        const r = (data as any)?.results?.[0];
                        if (r?.errors?.length) toast.error(`iClosed: ${r.errors[0]}`);
                        else if (r?.rows_written > 0) toast.success(`iClosed synced — ${r.rows_written} rows written`);
                        else toast.success(`iClosed sync complete — no events found for this setter in the synced period.`);
                      },
                      onError: (syncError) => toast.error(syncError.message),
                    },
                  )
                }
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncIclosed.isPending && "animate-spin")} />
                {syncIclosed.isPending ? t("settings.syncing") : "Sync iClosed"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {presetButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDatePreset(key)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                datePreset === key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground/50 hidden md:block">{start} → {end}</span>
        </div>

        {datePreset === "custom" && (
          <div className="flex flex-wrap gap-5 items-end bg-muted/10 px-5 py-4 rounded-xl border border-border/40 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("analytics.filter.from")}</p>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-9 w-40 rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("analytics.filter.to")}</p>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-9 w-40 rounded-lg text-sm" />
            </div>
          </div>
        )}

        {isError && (
          <Alert className={cn(
            "rounded-3xl border-none shadow-sm",
            looksLikeMissingTable ? "bg-amber-500/5 text-amber-700" : "bg-destructive/5 text-destructive",
          )}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-semibold">
              {looksLikeMissingTable ? "Setter Ops data source not set up yet" : t("setterDashboard.loadErrorTitle")}
            </AlertTitle>
            <AlertDescription className="pt-1">
              {looksLikeMissingTable
                ? "The page is styled and ready, but the new setter tables have not been applied in Supabase yet. Run the latest migration to start loading data here."
                : syncErrorMessage}
            </AlertDescription>
          </Alert>
        )}

        {isLoading || !summary ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t("setterDashboard.callsMade")}
              value={String(summary.callsMade)}
              subtitle={`${summary.callsAnswered} ${t("setterDashboard.callsAnswered").toLowerCase()}`}
              accent="blue"
              icon={<PhoneCall className="h-5 w-5" />}
            />
            <StatCard
              title={t("setterDashboard.talkTime")}
              value={formatTalkTime(summary.talkTimeSeconds)}
              subtitle={`${summary.talkTimeSeconds.toLocaleString()} s`}
              accent="green"
              icon={<Timer className="h-5 w-5" />}
            />
            <StatCard
              title={t("setterDashboard.showRate")}
              value={`${summary.showRate.toFixed(1)}%`}
              subtitle={`${summary.showUps} ${t("setterDashboard.showUps")}`}
              trend="up"
              accent="orange"
              icon={<Calendar className="h-5 w-5" />}
            />
            <StatCard
              title={t("setterDashboard.closeRate")}
              value={`${summary.closeRate.toFixed(1)}%`}
              subtitle={`${summary.closes} ${t("setterDashboard.closes")}`}
              trend="up"
              accent="red"
              icon={<Trophy className="h-5 w-5" />}
            />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <ChartCard
            title={t("setterDashboard.chartPerformance")}
            icon={PhoneIncoming}
            action={<Badge variant="outline" className="rounded-full px-3 py-1">{points.length} days</Badge>}
          >
            {!hasData ? (
              <EmptyChartState
                title="No setter activity yet"
                body="Once Aircall and your funnel source start syncing, daily call volume, show-ups, and closes will appear here."
              />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={points}>
                  <defs>
                    <linearGradient id="setterOpsCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.24} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Area type="monotone" dataKey="callsMade" stroke={CHART_COLORS.primary} fill="url(#setterOpsCalls)" strokeWidth={3} />
                  <Area type="monotone" dataKey="showUps" stroke={CHART_COLORS.accent} fillOpacity={0} strokeWidth={2} />
                  <Area type="monotone" dataKey="closes" stroke={CHART_COLORS.danger} fillOpacity={0} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={t("setterDashboard.chartFunnel")} icon={Users}>
            {!hasData ? (
              <EmptyChartState
                title="Waiting for funnel data"
                body="Validated leads, cancellations, show-ups, and closes will stack here once your owner mappings and integrations are live."
              />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={[
                    { name: t("setterDashboard.leadsValidated"), value: summary?.leadsValidated ?? 0, fill: CHART_COLORS.primary },
                    { name: t("setterDashboard.leadsCanceled"), value: summary?.leadsCanceled ?? 0, fill: CHART_COLORS.warning },
                    { name: t("setterDashboard.showUps"), value: summary?.showUps ?? 0, fill: CHART_COLORS.accent },
                    { name: t("setterDashboard.closes"), value: summary?.closes ?? 0, fill: CHART_COLORS.success },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {isAdmin && (
          <SyncRunList
            title={t("setterDashboard.healthTitle")}
            runs={syncRuns.slice(0, 6).map((run) => ({
              id: run.id,
              source: run.source,
              status: run.status,
              recordsSeen: run.recordsSeen,
              rowsWritten: run.rowsWritten,
              startedAt: run.startedAt,
            }))}
          />
        )}

        {/* ── Call Log ── */}
        <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden rounded-2xl">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary"><PhoneCall className="h-3.5 w-3.5" /></div>
              <div>
                <h3 className="font-semibold text-sm">Call Log</h3>
                <p className="text-xs text-muted-foreground">{callRecords.length} calls synced</p>
              </div>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search contact or phone..."
                value={callSearch}
                onChange={(e) => { setCallSearch(e.target.value); setCallLimit(25); }}
                className="h-9 pl-9 rounded-lg text-sm border-border/50"
              />
            </div>
          </div>

          {callRecords.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No calls synced yet — click Sync Aircall to import.</div>
          ) : (() => {
            const filtered = callSearch
              ? callRecords.filter((c) =>
                  (c.contactName ?? "").toLowerCase().includes(callSearch.toLowerCase()) ||
                  (c.contactPhone ?? "").includes(callSearch)
                )
              : callRecords;
            const visible = filtered.slice(0, callLimit);

            return (
              <>
                <div className="hidden md:grid grid-cols-[2.5rem_1fr_7rem_5rem_8rem_2rem] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground border-b border-border/20">
                  <span />
                  <span>Contact</span>
                  <span>Status</span>
                  <span>Talk time</span>
                  <span className="text-right">Date & Time</span>
                  <span />
                </div>

                <div className="divide-y divide-border/20">
                  {visible.map((call) => {
                    const isAnswered = call.status === "answered" || call.status === "done";
                    const isMissed = call.status === "missed" || call.status === "voicemail";
                    const mins = Math.floor(call.talkTimeSeconds / 60);
                    const secs = call.talkTimeSeconds % 60;

                    return (
                      <button
                        key={call.id}
                        className="w-full text-left grid grid-cols-[2.5rem_1fr] md:grid-cols-[2.5rem_1fr_7rem_5rem_8rem_2rem] gap-4 items-center px-5 py-3.5 hover:bg-muted/20 transition-colors group"
                        onClick={() => navigate(`/setter-dashboard/calls/${call.id}`, { state: { call } })}
                      >
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl shrink-0",
                          isAnswered ? "bg-emerald-500/10 text-emerald-500" : isMissed ? "bg-rose-500/10 text-rose-500" : "bg-muted/40 text-muted-foreground"
                        )}>
                          {isMissed ? <PhoneMissed className="h-3.5 w-3.5" /> : call.direction === "outbound" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-semibold text-sm truncate">
                            {call.contactName || <span className="text-muted-foreground font-normal">{call.contactPhone || "Unknown caller"}</span>}
                          </p>
                          {call.contactName && (
                            <p className="text-xs text-muted-foreground truncate">{call.contactPhone || "No phone recorded"}</p>
                          )}
                        </div>
                        <span className={cn("hidden md:inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                          isAnswered ? "bg-emerald-500/10 text-emerald-600" : isMissed ? "bg-rose-500/10 text-rose-600" : "bg-muted/50 text-muted-foreground"
                        )}>
                          {call.status ?? "—"}
                        </span>
                        <p className="hidden md:block text-xs text-muted-foreground tabular-nums">
                          {call.talkTimeSeconds > 0 ? `${mins}m ${secs}s` : "—"}
                        </p>
                        <div className="hidden md:block text-right">
                          <p className="text-xs text-muted-foreground">{call.startedAt ? new Date(call.startedAt).toLocaleDateString() : "—"}</p>
                          <p className="text-xs text-muted-foreground/50">{call.startedAt ? new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                        </div>
                        <ArrowUpRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </button>
                    );
                  })}
                </div>

                {filtered.length > callLimit && (
                  <div className="p-4 text-center border-t border-border/20">
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-2 font-medium" onClick={() => setCallLimit((l) => l + 25)}>
                      Show 25 more <span className="text-muted-foreground">({filtered.length - callLimit} remaining)</span>
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      </div>
    </AppLayout>
  );
};

export default SetterDashboardPage;
