import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnalyzeCall, useCallAnalyses, useSyncFathom } from "@/hooks/useCallAnalysis";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { CallAnalysis } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import CallDetailsDialog from "@/components/CallDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Calendar,
 CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  VideoOff,
  XCircle,
} from "lucide-react";

type QuickFilter = "all" | "ready" | "done" | "issues" | "noTranscript";
type StatusFilter = "all" | CallAnalysis["status"];
type ScoreFilter = "all" | "high" | "mid" | "low" | "unscored";
type TranscriptFilter = "all" | "withTranscript" | "withoutTranscript";
type SortFilter = "newest" | "oldest" | "scoreHigh" | "scoreLow";

const statusConfig: Record<CallAnalysis["status"], { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    className: "bg-muted/30 text-muted-foreground border-muted/40",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  synced: {
    label: "Synced",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  analyzing: {
    label: "Analyzing",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  done: {
    label: "Done",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  error: {
    label: "Error",
    className: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const ScorePill = ({ score }: { score: number }) => {
  const tone =
    score >= 80 ? "bg-emerald-500/10 text-emerald-500" :
    score >= 60 ? "bg-amber-500/10 text-amber-500" :
    "bg-rose-500/10 text-rose-500";

  return (
    <span className={cn("inline-flex min-w-[4.75rem] items-center justify-center rounded-full px-3 py-1 text-xs font-black tabular-nums", tone)}>
      {score}/100
    </span>
  );
};

const LoadingState = () => (
  <div className="space-y-6">
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-3xl" />
      ))}
    </div>
    <Skeleton className="h-[520px] rounded-3xl" />
  </div>
);

const CallsPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const isCloser = user?.role === "closer";

  const { data: calls = [], isLoading } = useCallAnalyses(isAdmin ? undefined : user?.id);
  const syncFathom = useSyncFathom();
  const analyzeCall = useAnalyzeCall();

  const [selectedCall, setSelectedCall] = useState<CallAnalysis | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [transcriptFilter, setTranscriptFilter] = useState<TranscriptFilter>("all");
  const [sortBy, setSortBy] = useState<SortFilter>("newest");
  const [visible, setVisible] = useState(12);
  const [analyzingCallId, setAnalyzingCallId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const analyzed = calls.filter((call) => call.status === "done").length;
    const ready = calls.filter((call) => call.status === "synced" && call.transcript).length;
    const issues = calls.filter((call) => call.status === "error").length;
    const noTranscript = calls.filter((call) => !call.transcript).length;
    const scores = calls.filter((call) => call.score !== null).map((call) => call.score as number);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;

    return { total: calls.length, analyzed, ready, issues, noTranscript, avgScore };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = calls.filter((call) => {
      if (quickFilter === "ready" && !(call.status === "synced" && call.transcript)) return false;
      if (quickFilter === "done" && call.status !== "done") return false;
      if (quickFilter === "issues" && call.status !== "error") return false;
      if (quickFilter === "noTranscript" && !!call.transcript) return false;

      if (statusFilter !== "all" && call.status !== statusFilter) return false;
      if (transcriptFilter === "withTranscript" && !call.transcript) return false;
      if (transcriptFilter === "withoutTranscript" && !!call.transcript) return false;

      if (scoreFilter === "high" && ((call.score ?? -1) < 80)) return false;
      if (scoreFilter === "mid" && (call.score === null || call.score < 60 || call.score >= 80)) return false;
      if (scoreFilter === "low" && (call.score === null || call.score >= 60)) return false;
      if (scoreFilter === "unscored" && call.score !== null) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        call.callTitle ?? "",
        call.callDate ?? "",
        call.fathomMeetingId ?? "",
        call.feedback?.summary ?? "",
      ].join(" ").toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "newest") return (b.callDate ?? "").localeCompare(a.callDate ?? "");
      if (sortBy === "oldest") return (a.callDate ?? "").localeCompare(b.callDate ?? "");
      if (sortBy === "scoreHigh") return (b.score ?? -1) - (a.score ?? -1);
      return (a.score ?? 999) - (b.score ?? 999);
    });
  }, [calls, quickFilter, query, scoreFilter, sortBy, statusFilter, transcriptFilter]);

  const activeFilterCount = [
    quickFilter !== "all",
    statusFilter !== "all",
    scoreFilter !== "all",
    transcriptFilter !== "all",
    sortBy !== "newest",
    query.trim().length > 0,
  ].filter(Boolean).length;

  const handleSync = () => {
    syncFathom.mutate(undefined, {
      onSuccess: (res) => {
        if (res.imported > 0) {
          toast.success(`${res.imported} ${t("calls.syncImported")}`, {
            description: res.total_seen ? `Fetched ${res.total_seen} meeting(s) from Fathom.` : undefined,
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
          description: res.total_seen != null
            ? `Fetched ${res.total_seen} meeting(s) from Fathom — none were new.`
            : "No meetings were returned by Fathom for this API key.",
        });
      },
      onError: (error) => toast.error(`${t("calls.syncError")}: ${error.message}`),
    });
  };

  const handleAnalyze = (event: React.MouseEvent, callId: string) => {
    event.stopPropagation();
    if (analyzingCallId) return;

    setAnalyzingCallId(callId);
    analyzeCall.mutate(callId, {
      onSuccess: () => toast.success(t("calls.analyzeSuccess")),
      onError: (error) => toast.error(`${t("calls.analyzeError")}: ${error.message}`),
      onSettled: () => setAnalyzingCallId(null),
    });
  };

  const handleOpenAssistant = (call?: CallAnalysis) => {
    const params = new URLSearchParams();
    const closerId = call?.closerId ?? user?.id;
    if (closerId) params.set("closer", closerId);
    if (call?.id) params.set("call", call.id);
    navigate(`/assistant${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const quickFilters: Array<{ id: QuickFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: stats.total },
    { id: "ready", label: "Ready", count: stats.ready },
    { id: "done", label: "Analyzed", count: stats.analyzed },
    { id: "issues", label: "Issues", count: stats.issues },
    { id: "noTranscript", label: "No transcript", count: stats.noTranscript },
  ];

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{t("calls.title")}</h1>
              <p className="text-sm text-muted-foreground font-medium">{t("calls.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">

            {(isCloser || isAdmin) && (
              <Button
                variant="outline"
                size="sm"
                disabled={syncFathom.isPending}
                className="rounded-xl h-10 px-4 font-bold border-border/60 hover:bg-primary/5 transition-all active:scale-95"
                onClick={handleSync}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", syncFathom.isPending && "animate-spin")} />
                {syncFathom.isPending ? t("calls.syncing") : t("calls.syncButton")}
              </Button>
            )}
          </div>
        </div>

        {(isCloser || isAdmin) && (
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">The assistant now lives in its own dedicated workspace.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use Calls to review recordings and jump into the standalone assistant when you want coaching.
                </p>
              </div>
              <Button className="rounded-2xl h-10 px-4 font-bold" onClick={() => handleOpenAssistant()}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Go to Sales Assistant
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title={t("calls.totalCalls")}
                value={String(stats.total)}
                subtitle="All synced recordings"
                accent="blue"
                icon={<Phone className="h-5 w-5" />}
              />
              <StatCard
                title={t("calls.readyToAnalyze")}
                value={String(stats.ready)}
                subtitle="Transcript available"
                accent="orange"
                icon={<Sparkles className="h-5 w-5" />}
              />
              <StatCard
                title={t("calls.analyzed")}
                value={String(stats.analyzed)}
                subtitle="AI review completed"
                accent="green"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
              <StatCard
                title={t("calls.avgScore")}
                value={stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
                subtitle="Average analyzed score"
                accent="blue"
                icon={<TrendingUp className="h-5 w-5" />}
              />
            </div>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-border/40 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
                      {t("calls.tableTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Filter recordings by status, score, transcript availability, and keyword.
                    </p>
                  </div>

                  <div className="relative w-full lg:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setVisible(12);
                      }}
                      placeholder="Search title, date, summary..."
                      className="h-11 rounded-2xl border-border/60 pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setQuickFilter(item.id);
                        setVisible(12);
                      }}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-all border",
                        quickFilter === item.id
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/15"
                          : "bg-background text-muted-foreground border-border/60 hover:bg-primary/5 hover:text-foreground",
                      )}
                    >
                      {item.label} <span className="ml-1 opacity-70">{item.count}</span>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/60">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">Any status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="synced">Synced</SelectItem>
                      <SelectItem value="analyzing">Analyzing</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={scoreFilter} onValueChange={(value) => setScoreFilter(value as ScoreFilter)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/60">
                      <SelectValue placeholder="Score" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">Any score</SelectItem>
                      <SelectItem value="high">High 80-100</SelectItem>
                      <SelectItem value="mid">Mid 60-79</SelectItem>
                      <SelectItem value="low">Low 0-59</SelectItem>
                      <SelectItem value="unscored">Not analyzed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={transcriptFilter} onValueChange={(value) => setTranscriptFilter(value as TranscriptFilter)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/60">
                      <SelectValue placeholder="Transcript" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">Any transcript state</SelectItem>
                      <SelectItem value="withTranscript">With transcript</SelectItem>
                      <SelectItem value="withoutTranscript">Without transcript</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortFilter)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/60">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                      <SelectItem value="scoreHigh">Highest score</SelectItem>
                      <SelectItem value="scoreLow">Lowest score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-muted/20 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {filteredCalls.length} recording(s) found
                    {activeFilterCount > 0 ? ` • ${activeFilterCount} active filter(s)` : ""}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl h-9 px-4 font-bold"
                    disabled={activeFilterCount === 0}
                    onClick={() => {
                      setQuickFilter("all");
                      setQuery("");
                      setStatusFilter("all");
                      setScoreFilter("all");
                      setTranscriptFilter("all");
                      setSortBy("newest");
                      setVisible(12);
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>

              <CardContent className="p-6">
                {filteredCalls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Phone className="h-7 w-7 text-primary/50" />
                    </div>
                    <div>
                      <p className="font-bold text-muted-foreground">{t("calls.noCalls")}</p>
                      <p className="text-sm text-muted-foreground/60 mt-1">
                        Try adjusting the filters or sync more Fathom recordings.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCalls.slice(0, visible).map((call) => {
                      const status = statusConfig[call.status];
                      const canAnalyze = (call.status === "synced" || call.status === "error") && !!call.transcript;
                      const isAnalyzingThisCall = analyzingCallId === call.id;
                      const duration = call.durationSeconds ? `${Math.round(call.durationSeconds / 60)} min` : "—";

                      return (
                        <div
                          key={call.id}
                          className="rounded-3xl border border-border/50 bg-background p-5 transition-all hover:shadow-sm hover:border-border cursor-pointer"
                          onClick={() => setSelectedCall(call)}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <Badge variant="outline" className={cn("gap-1.5 font-semibold text-[11px]", status.className)}>
                                  {status.icon}
                                  {status.label}
                                </Badge>
                                {call.score !== null ? <ScorePill score={call.score} /> : null}
                                {!call.transcript && (
                                  <Badge variant="outline" className="text-[11px] font-semibold text-muted-foreground border-muted/60">
                                    <VideoOff className="h-3 w-3 mr-1" />
                                    No transcript
                                  </Badge>
                                )}
                              </div>

                              <h4 className="text-base font-bold tracking-tight truncate">
                                {call.callTitle ?? t("calls.untitledCall")}
                              </h4>

                              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {call.callDate ?? "No date"}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {duration}
                                </span>
                              </div>

                              <p className="mt-4 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                {call.feedback?.summary ?? (call.transcript
                                  ? "Transcript is available for detailed review and AI analysis."
                                  : "This recording synced without transcript content yet.")}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 lg:pl-4 flex-wrap justify-end">
                              {(isCloser || isAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-xl h-10 px-4 font-bold"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenAssistant(call);
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Coach
                                </Button>
                              )}
                              {canAnalyze && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl h-10 px-4 font-bold"
                                  disabled={!!analyzingCallId}
                                  onClick={(event) => handleAnalyze(event, call.id)}
                                >
                                  {isAnalyzingThisCall ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                  )}
                                  {isAnalyzingThisCall ? t("calls.analyzing") : t("calls.analyzeButton")}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCall(call);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {visible < filteredCalls.length && (
                      <div className="flex justify-center pt-2">
                        <Button
                          variant="outline"
                          className="rounded-xl h-10 px-5 font-bold"
                          onClick={() => setVisible((count) => count + 12)}
                        >
                          {t("calls.showMore")} ({filteredCalls.length - visible} {t("calls.remaining")})
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <CallDetailsDialog
        call={selectedCall}
        open={!!selectedCall}
        onOpenChange={(open) => {
          if (!open) setSelectedCall(null);
        }}
      />
    </AppLayout>
  );
};

export default CallsPage;
