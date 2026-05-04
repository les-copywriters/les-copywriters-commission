import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/i18n";
import { FrameworkDisplay } from "@/components/FrameworkDisplay";
import { useCallAnalyses, useCloserFramework, useCloserFrameworkHistory, useGenerateFramework, useSyncFathom } from "@/hooks/useCallAnalysis";
import { CallAnalysis } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import CallDetailsDialog from "@/components/CallDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  FileText,
  History,
  Loader2,
  Phone,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";


const CoachingPage = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Persist selected closer in URL so page refresh restores it
  const selectedCloserId = searchParams.get("closer") ?? "";
  const setSelectedCloserId = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("closer", id); else next.delete("closer");
    setSearchParams(next, { replace: true });
    setSelectedCallIds(new Set());
  };

  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [viewingCall, setViewingCall] = useState<CallAnalysis | null>(null);

  const { data: closers = [] } = useQuery({
    queryKey: ["profiles", "closers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "closer")
        .order("name");
      if (error) throw new Error(error.message);
      return data as { id: string; name: string }[];
    },
  });

  const { data: calls = [], isLoading: loadingCalls } = useCallAnalyses(selectedCloserId || undefined);
  const { data: framework, isLoading: loadingFramework } = useCloserFramework(selectedCloserId || null);
  const { data: frameworkHistory = [] } = useCloserFrameworkHistory(selectedCloserId || null);
  const generateFramework = useGenerateFramework();
  const syncFathom = useSyncFathom();

  // transcript is not included in the list query (too large) — use status as proxy:
  // "synced" = transcript fetched, not yet analyzed; "done" = transcript + AI analysis
  const usableCalls = useMemo(
    () => calls.filter((call) => call.status === "synced" || call.status === "done"),
    [calls],
  );

  const MAX_CALLS = 10;
  const atCallLimit = selectedCallIds.size >= MAX_CALLS;

  const stats = useMemo(() => {
    if (!selectedCloserId) return null;
    const analyzed = calls.filter((call) => call.status === "done").length;
    const scores = calls.filter((call) => call.score !== null).map((call) => call.score as number);
    const avg = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
    return {
      total: calls.length,
      usable: usableCalls.length,
      analyzed,
      avg,
    };
  }, [calls, selectedCloserId, usableCalls.length]);

  const toggleCall = (id: string) => {
    setSelectedCallIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_CALLS) {
        next.add(id);
      } else {
        toast.warning(`Maximum ${MAX_CALLS} calls per framework generation`);
      }
      return next;
    });
  };

  const handleGenerate = () => {
    if (!selectedCloserId || selectedCallIds.size === 0) return;
    generateFramework.mutate(
      { closerId: selectedCloserId, callIds: Array.from(selectedCallIds) },
      {
        onSuccess: (result) => {
          toast.success(`${t("coaching.frameworkGenerated")} (${result.calls_used} ${t("coaching.callsUsed")})`);
          setSelectedCallIds(new Set());
        },
        onError: (error) => toast.error(`${t("coaching.frameworkError")}: ${error.message}`),
      },
    );
  };

  const handleSync = () => {
    if (!selectedCloserId) return;
    syncFathom.mutate(selectedCloserId, {
      onSuccess: (res) => {
        if ((res.errors?.length ?? 0) > 0) {
          toast.error(t("calls.syncError"), {
            description: res.errors.slice(0, 3).join("\n"),
          });
          return;
        }
        const parts: string[] = [];
        if (res.imported > 0)            parts.push(`${res.imported} new call(s) imported`);
        if (res.transcripts_fetched > 0) parts.push(`${res.transcripts_fetched} transcript(s) fetched`);
        if (res.rounds > 1)              parts.push(`completed in ${res.rounds} passes`);

        if (parts.length > 0) {
          toast.success(t("calls.syncImported"), { description: parts.join(" · ") });
        } else {
          toast.info(t("calls.syncUpToDate"), {
            description: res.total_seen != null
              ? `Checked ${res.total_seen} meeting(s) — all up to date.`
              : "No meetings were returned by Fathom for this API key.",
          });
        }
      },
      onError: (error) => toast.error(`${t("calls.syncError")}: ${error.message}`),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("coaching.subtitle")}</p>
          <h1 className="text-xl font-semibold">{t("coaching.title")}</h1>
        </div>

        <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
            <p className="text-sm font-medium">{t("coaching.selectCloser")}</p>
          </div>
          <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select
              value={selectedCloserId}
              onValueChange={(value) => {
                setSelectedCloserId(value);
              }}
            >
              <SelectTrigger className="rounded-lg h-9 border-border/60 text-sm min-w-[220px]">
                <SelectValue placeholder={t("coaching.selectCloserPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {closers.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id} className="text-sm">
                    {closer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedCloserId || syncFathom.isPending}
              className="rounded-lg h-9 px-3 border-border/60 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleSync}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", syncFathom.isPending && "animate-spin")} />
              {syncFathom.isPending ? t("calls.syncing") : t("calls.syncButton")}
            </Button>
          </div>
        </div>

        {selectedCloserId && stats ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title={t("calls.totalCalls")} value={String(stats.total)} subtitle="All synced calls" accent="blue" icon={<Phone className="h-4 w-4" />} />
              <StatCard title="Usable Calls" value={String(stats.usable)} subtitle="Transcript available" accent="green" icon={<FileText className="h-4 w-4" />} />
              <StatCard title={t("calls.analyzed")} value={String(stats.analyzed)} subtitle="AI reviewed calls" accent="orange" icon={<CheckCircle2 className="h-4 w-4" />} />
              <StatCard title={t("calls.avgScore")} value={stats.avg !== null ? `${stats.avg}/100` : "—"} subtitle="Average call quality" accent="blue" icon={<TrendingUp className="h-4 w-4" />} />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2 space-y-3">
                <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                    <p className="text-sm font-medium">{t("coaching.selectCalls")}</p>
                    {usableCalls.length > 0 && (
                      <Badge variant="outline" className={cn(
                        "rounded-md text-[10px]",
                        atCallLimit ? "border-amber-500/30 text-amber-600 bg-amber-500/5" : "border-primary/20 text-primary"
                      )}>
                        {selectedCallIds.size}/{MAX_CALLS} {t("coaching.callsSelected")}
                      </Badge>
                    )}
                  </div>

                  <div className="p-3">
                    {loadingCalls ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <Skeleton key={index} className="h-20 rounded-lg" />
                        ))}
                      </div>
                    ) : usableCalls.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-sm text-muted-foreground">{t("coaching.noCallsWithTranscript")}</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">{t("coaching.noCallsHint")}</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                        {usableCalls.map((call) => {
                          const checked = selectedCallIds.has(call.id);
                          const disabled = !checked && atCallLimit;
                          const duration = call.durationSeconds ? `${Math.round(call.durationSeconds / 60)} min` : "—";
                          return (
                            <button
                              key={call.id}
                              type="button"
                              disabled={disabled}
                              className={cn(
                                "w-full rounded-lg border p-3 text-left transition-all",
                                checked
                                  ? "border-primary/30 bg-primary/5"
                                  : disabled
                                  ? "border-border/20 bg-muted/10 opacity-40 cursor-not-allowed"
                                  : "border-border/40 bg-background hover:bg-muted/20",
                              )}
                              onClick={() => toggleCall(call.id)}
                            >
                              <div className="flex items-start gap-2.5">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleCall(call.id)}
                                  className="rounded mt-0.5"
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{call.callTitle ?? t("calls.untitledCall")}</p>
                                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{call.callDate ?? "No date"}</span>
                                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{duration}</span>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-lg shrink-0"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setViewingCall(call);
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  {call.score !== null && (
                                    <p className={cn(
                                      "mt-1.5 text-xs font-medium tabular-nums",
                                      call.score >= 80 ? "text-emerald-500" : call.score >= 60 ? "text-amber-500" : "text-rose-500"
                                    )}>
                                      {call.score}/100
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full rounded-lg h-9 text-xs font-medium gap-2"
                  disabled={selectedCallIds.size === 0 || generateFramework.isPending}
                  onClick={handleGenerate}
                >
                  {generateFramework.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("coaching.generating")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t("coaching.generateButton")}
                    </>
                  )}
                </Button>
              </div>

              <div className="lg:col-span-3">
                <div className="rounded-xl border border-border/40 overflow-hidden bg-background h-full">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                    <p className="text-sm font-medium">{t("coaching.framework")}</p>
                    {framework && (
                      <Badge variant="outline" className="rounded-md text-[10px] border-emerald-500/20 text-emerald-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      {framework
                        ? `${framework.generatedFromCalls.length} ${t("coaching.callsSource")}`
                        : t("coaching.noFrameworkHint")}
                    </p>
                    {loadingFramework ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <Skeleton key={index} className={cn("h-3 rounded-md", index % 3 === 0 && "w-2/3")} />
                        ))}
                      </div>
                    ) : framework ? (
                      <FrameworkDisplay markdown={framework.framework} />
                    ) : (
                      <div className="text-center py-16">
                        <p className="text-sm text-muted-foreground">{t("coaching.noFramework")}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">{t("coaching.noFrameworkHint")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">{t("coaching.selectPrompt")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t("coaching.selectPromptHint")}</p>
            </div>
          </div>
        )}

        {/* ── Framework History ── */}
        {selectedCloserId && frameworkHistory.length > 0 && (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/40">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Framework History</p>
              <Badge variant="outline" className="rounded-md text-[10px] ml-auto">{frameworkHistory.length} version{frameworkHistory.length !== 1 ? "s" : ""}</Badge>
            </div>
            <div className="divide-y divide-border/30">
              {frameworkHistory.map((entry, idx) => (
                <div key={entry.id} className="p-4">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        idx === 0 ? "border-primary/20 bg-primary/5 text-primary" : "border-border/40 text-muted-foreground"
                      )}>
                        {idx === 0 ? "Latest" : `v${frameworkHistory.length - idx}`}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Generated from {entry.callsCount} call{entry.callsCount !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    {expandedHistoryId === entry.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>
                  {expandedHistoryId === entry.id && (
                    <div className="mt-4 pt-4 border-t border-border/30">
                      <FrameworkDisplay markdown={entry.framework} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <CallDetailsDialog
          call={viewingCall}
          open={!!viewingCall}
          onOpenChange={(open) => !open && setViewingCall(null)}
        />
      </div>
    </AppLayout>
  );
};

export default CoachingPage;
