import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/i18n";
import { useCallAnalyses, useCloserFramework, useGenerateFramework, useSyncFathom } from "@/hooks/useCallAnalysis";
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
  Brain,
  Calendar,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Phone,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const FrameworkDisplay = ({ markdown }: { markdown: string }) => {
  const lines = markdown.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground/80">
      {lines.map((line, index) => {
        if (line.startsWith("# ")) return <h1 key={index} className="text-xl font-black tracking-tight mt-2 mb-4">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={index} className="text-sm font-bold uppercase tracking-widest text-primary mt-6 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={index} className="text-sm font-bold text-foreground mt-4 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex items-start gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line === "---") return <div key={index} className="my-4 h-px bg-border/40" />;
        if (!line.trim()) return <div key={index} className="h-1" />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
};

const CoachingPage = () => {
  const { t } = useLanguage();
  const [selectedCloserId, setSelectedCloserId] = useState("");
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
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
  const generateFramework = useGenerateFramework();
  const syncFathom = useSyncFathom();

  const usableCalls = useMemo(
    () => calls.filter((call) => call.transcript && call.transcript.length > 50),
    [calls],
  );

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
      next.has(id) ? next.delete(id) : next.add(id);
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
        if (res.imported > 0) {
          toast.success(`${res.imported} ${t("calls.syncImported")}`, {
            description: res.fetched ? `Fetched ${res.fetched} meeting(s) from Fathom.` : undefined,
          });
          return;
        }
        if ((res.errors?.length ?? 0) > 0) {
          toast.error(t("calls.syncError"), {
            description: res.errors.slice(0, 3).join("\n"),
          });
          return;
        }
        toast.info(t("calls.syncUpToDate"), {
          description: res.fetched
            ? `Fetched ${res.fetched} meeting(s), but none were new to import.`
            : "No meetings were returned by Fathom for this API key.",
        });
      },
      onError: (error) => toast.error(`${t("calls.syncError")}: ${error.message}`),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t("coaching.title")}</h1>
            <p className="text-sm text-muted-foreground font-medium">{t("coaching.subtitle")}</p>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-border/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
                {t("coaching.selectCloser")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Choose a closer to sync calls and build a coaching framework.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Select
                value={selectedCloserId}
                onValueChange={(value) => {
                  setSelectedCloserId(value);
                  setSelectedCallIds(new Set());
                }}
              >
                <SelectTrigger className="rounded-2xl h-11 font-bold border-border/60 min-w-[240px]">
                  <SelectValue placeholder={t("coaching.selectCloserPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id} className="rounded-xl font-medium">
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedCloserId || syncFathom.isPending}
                className="rounded-xl h-11 px-4 font-bold border-border/60"
                onClick={handleSync}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", syncFathom.isPending && "animate-spin")} />
                {syncFathom.isPending ? t("calls.syncing") : t("calls.syncButton")}
              </Button>
            </div>
          </div>
        </Card>

        {selectedCloserId && stats ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title={t("calls.totalCalls")} value={String(stats.total)} subtitle="All synced calls" accent="blue" icon={<Phone className="h-5 w-5" />} />
              <StatCard title="Usable Calls" value={String(stats.usable)} subtitle="Transcript available" accent="green" icon={<FileText className="h-5 w-5" />} />
              <StatCard title={t("calls.analyzed")} value={String(stats.analyzed)} subtitle="AI reviewed calls" accent="orange" icon={<CheckCircle2 className="h-5 w-5" />} />
              <StatCard title={t("calls.avgScore")} value={stats.avg !== null ? `${stats.avg}/100` : "—"} subtitle="Average call quality" accent="blue" icon={<TrendingUp className="h-5 w-5" />} />
            </div>

            <div className="grid gap-8 lg:grid-cols-5">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                  <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
                        {t("coaching.selectCalls")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">{t("coaching.selectCallsHint")}</p>
                    </div>
                    {usableCalls.length > 0 && (
                      <Badge variant="outline" className="border-primary/20 text-primary font-bold px-3 py-1">
                        {selectedCallIds.size} {t("coaching.callsSelected")}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-4">
                    {loadingCalls ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <Skeleton key={index} className="h-20 rounded-2xl" />
                        ))}
                      </div>
                    ) : usableCalls.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground font-medium">{t("coaching.noCallsWithTranscript")}</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">{t("coaching.noCallsHint")}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {usableCalls.map((call) => {
                          const checked = selectedCallIds.has(call.id);
                          const duration = call.durationSeconds ? `${Math.round(call.durationSeconds / 60)} min` : "—";
                          return (
                            <button
                              key={call.id}
                              type="button"
                              className={cn(
                                "w-full rounded-2xl border p-4 text-left transition-all",
                                checked
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-border/40 bg-background hover:bg-muted/20",
                              )}
                              onClick={() => toggleCall(call.id)}
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleCall(call.id)}
                                  className="rounded-lg mt-1"
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold truncate">{call.callTitle ?? t("calls.untitledCall")}</p>
                                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{call.callDate ?? "No date"}</span>
                                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{duration}</span>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-xl"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setViewingCall(call);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {call.score !== null && (
                                    <p className={cn(
                                      "mt-2 text-xs font-black tabular-nums",
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
                  </CardContent>
                </Card>

                <Button
                  className="w-full rounded-2xl h-12 font-bold gap-2 shadow-lg shadow-primary/20"
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
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden h-full">
                  <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
                        {t("coaching.framework")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {framework
                          ? `${framework.generatedFromCalls.length} ${t("coaching.callsSource")}`
                          : t("coaching.noFrameworkHint")}
                      </p>
                    </div>
                    {framework && (
                      <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 font-bold px-3 py-1">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-6">
                    {loadingFramework ? (
                      <div className="space-y-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <Skeleton key={index} className={cn("h-4 rounded-lg", index % 3 === 0 && "w-2/3")} />
                        ))}
                      </div>
                    ) : framework ? (
                      <FrameworkDisplay markdown={framework.framework} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground/30" />
                        <div>
                          <p className="font-bold text-muted-foreground">{t("coaching.noFramework")}</p>
                          <p className="text-sm text-muted-foreground/60 mt-1 max-w-md">{t("coaching.noFrameworkHint")}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <Card className="border-none shadow-sm rounded-3xl">
            <CardContent className="py-20 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-bold text-muted-foreground">{t("coaching.selectPrompt")}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">{t("coaching.selectPromptHint")}</p>
            </CardContent>
          </Card>
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
