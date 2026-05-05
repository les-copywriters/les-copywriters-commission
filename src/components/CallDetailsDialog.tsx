import { useState, useEffect } from "react";
import { CallAnalysis } from "@/types";
import { useAnalyzeCall, useFullCallAnalysis } from "@/hooks/useCallAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Sparkles,
  TrendingUp,
  XCircle,
  Target,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Tag,
} from "lucide-react";

const statusConfig: Record<CallAnalysis["status"], { label: string; className: string; icon?: React.ReactNode }> = {
  pending:   { label: "Pending",   className: "bg-muted/30 text-muted-foreground border-muted/40" },
  synced:    { label: "Synced",    className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  analyzing: { label: "Analyzing", className: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  done:      { label: "Done",      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  error:     { label: "Error",     className: "bg-rose-500/10 text-rose-500 border-rose-500/20", icon: <XCircle className="h-3 w-3" /> },
};

const ScoreBlock = ({ score }: { score: number }) => {
  const tone = score >= 80 ? "text-emerald-500 bg-emerald-500/10" : score >= 60 ? "text-amber-500 bg-amber-500/10" : "text-rose-500 bg-rose-500/10";
  return (
    <div className={cn("flex h-24 w-24 flex-col items-center justify-center rounded-3xl shrink-0", tone)}>
      <span className="text-3xl font-black tabular-nums leading-none">{score}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">/100</span>
    </div>
  );
};

const SubScore = ({ label, value }: { label: string; value: number }) => {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] font-black tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

const ListSection = ({
  icon: Icon,
  title,
  items,
  colorClass,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  colorClass: string;
}) => {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("h-5 w-5 rounded-full flex items-center justify-center", colorClass)}>
          <Icon className="h-3 w-3" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-1.5 pl-7">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
            <p className="text-sm text-foreground/80 leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

type Props = {
  call: CallAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CallDetailsDialog = ({ call, open, onOpenChange }: Props) => {
  const { t } = useLanguage();
  const analyze = useAnalyzeCall();
  const [showTranscript, setShowTranscript] = useState(false);

  // Fetch the full record (with transcript) when the dialog opens.
  // The list query omits transcripts for performance, so we load on demand.
  const { data: fullCall, isLoading: loadingFull } = useFullCallAnalysis(
    open && call ? call.id : null
  );

  // Extract primitives for stable effect deps (safe to compute before early return)
  const effectiveId     = (fullCall ?? call)?.id ?? null;
  const effectiveStatus = (fullCall ?? call)?.status ?? null;

  useEffect(() => {
    if (effectiveId) {
      setShowTranscript(effectiveStatus === "synced" || effectiveStatus === "pending");
    }
  }, [effectiveId, effectiveStatus]);

  if (!call) return null;

  // Re-declare after the guard: call is CallAnalysis here, so this is always CallAnalysis
  const effectiveCall = fullCall ?? call;

  const status   = statusConfig[effectiveCall.status];
  const duration = effectiveCall.durationSeconds ? `${Math.round(effectiveCall.durationSeconds / 60)} min` : "—";
  const feedback = effectiveCall.feedback;
  const details  = effectiveCall.analysisDetails;

  const handleAnalyze = () => {
    analyze.mutate(call.id, {
      onSuccess: () => toast.success(t("calls.analyzeSuccess")),
      onError:   (error) => toast.error(`${t("calls.analyzeError")}: ${error.message}`),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto rounded-3xl border-none shadow-2xl p-0">

        {/* Header */}
        <div className="p-8 border-b border-border/40 bg-background/80">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className={cn("gap-1.5 font-semibold text-xs", status.className)}>
                {status.icon}{status.label}
              </Badge>
              {effectiveCall.score !== null && (
                <Badge variant="outline" className="border-primary/20 text-primary font-bold px-3 py-1">
                  {effectiveCall.score}/100
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl font-black tracking-tight leading-tight">
              {effectiveCall.callTitle ?? t("calls.untitledCall")}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{effectiveCall.callDate ?? "No date"}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{duration}</span>
            </div>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-8">

          {/* Not yet analyzed — prompt the closer */}
          {effectiveCall.status === "synced" && effectiveCall.score === null && (
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/15">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Ready for AI analysis</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  This call has a full transcript. Click <strong>Analyze with AI</strong> below to get a score, strengths, improvement areas, and detailed coaching feedback.
                </p>
              </div>
            </div>
          )}

          {/* Score + summary */}
          {effectiveCall.status === "done" && effectiveCall.score !== null && feedback && (
            <div className="flex flex-col sm:flex-row gap-6">
              <ScoreBlock score={effectiveCall.score} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t("calls.summary")}</p>
                <p className="text-sm leading-relaxed text-foreground/90">{feedback.summary}</p>
              </div>
            </div>
          )}

          {/* Sub-scores */}
          {details && (
            <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Score Breakdown</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SubScore label="Rapport"            value={details.rapportScore} />
                <SubScore label="Discovery"          value={details.discoveryScore} />
                <SubScore label="Pitch"              value={details.pitchScore} />
                <SubScore label="Objection Handling" value={details.objectionHandlingScore} />
                <SubScore label="Closing"            value={details.closingScore} />
                <SubScore label="Confidence"         value={details.confidenceScore} />
                <SubScore label="Next Step Clarity"  value={details.nextStepClarityScore} />
              </div>
            </div>
          )}

          {/* Strengths */}
          {feedback?.strengths && feedback.strengths.length > 0 && (
            <ListSection
              icon={CheckCircle2}
              title={t("calls.strengths")}
              items={feedback.strengths}
              colorClass="bg-emerald-500/10 text-emerald-500"
            />
          )}

          {/* Improvements */}
          {feedback?.improvements && feedback.improvements.length > 0 && (
            <ListSection
              icon={TrendingUp}
              title={t("calls.improvements")}
              items={feedback.improvements}
              colorClass="bg-amber-500/10 text-amber-500"
            />
          )}

          {/* Coach tags */}
          {details?.coachTags && details.coachTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                  <Tag className="h-3 w-3" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coach Tags</p>
              </div>
              <div className="pl-7 flex flex-wrap gap-2">
                {details.coachTags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-bold border-primary/20 bg-primary/5 text-primary px-2.5 py-1 rounded-full">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dominant objections */}
          {details?.dominantObjections && details.dominantObjections.length > 0 && (
            <ListSection
              icon={AlertTriangle}
              title="Dominant Objections"
              items={details.dominantObjections}
              colorClass="bg-rose-500/10 text-rose-500"
            />
          )}

          {/* Buyer signals */}
          {details?.buyerSignals && details.buyerSignals.length > 0 && (
            <ListSection
              icon={Target}
              title="Buyer Signals"
              items={details.buyerSignals}
              colorClass="bg-blue-500/10 text-blue-500"
            />
          )}

          {/* Missed opportunities */}
          {details?.missedOpportunities && details.missedOpportunities.length > 0 && (
            <ListSection
              icon={Lightbulb}
              title="Missed Opportunities"
              items={details.missedOpportunities}
              colorClass="bg-orange-500/10 text-orange-500"
            />
          )}

          {/* Recommended next actions */}
          {details?.recommendedNextActions && details.recommendedNextActions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                  <ArrowRight className="h-3 w-3" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Next Actions</p>
              </div>
              <div className="space-y-1.5 pl-7">
                {details.recommendedNextActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[10px] font-black text-emerald-500 shrink-0">{i + 1}.</span>
                    <p className="text-sm text-foreground/80 leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {effectiveCall.status === "analyzing" && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <Loader2 className="h-5 w-5 text-amber-500 animate-spin shrink-0" />
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{t("calls.analyzingMessage")}</p>
            </div>
          )}

          {/* Error state */}
          {effectiveCall.status === "error" && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{t("calls.analyzeError")}</p>
                {effectiveCall.errorMessage && <p className="text-xs text-muted-foreground mt-1">{effectiveCall.errorMessage}</p>}
              </div>
            </div>
          )}

          {/* No transcript */}
          {effectiveCall.status === "pending" && !effectiveCall.transcript && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{t("calls.noTranscript")}</p>
            </div>
          )}

          {/* Loading skeleton while transcript fetches */}
          {loadingFull && !fullCall && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          )}

          {/* Full transcript — shown before Analyze so the closer can read it first */}
          {effectiveCall.transcript && (
            <div className="space-y-3">
              <button
                className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowTranscript((v) => !v)}
              >
                {showTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {t("calls.transcript")}
              </button>
              {showTranscript && (
                <div className="rounded-2xl bg-muted/20 border border-border/30 p-5 overflow-x-hidden">
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {effectiveCall.transcript}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Analyze button */}
          {(effectiveCall.status === "synced" || effectiveCall.status === "error") && effectiveCall.transcript && (
            <>
              <Separator className="opacity-40" />
              <Button className="w-full rounded-2xl h-12 font-bold gap-2" disabled={analyze.isPending} onClick={handleAnalyze}>
                {analyze.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{t("calls.analyzing")}</>
                  : <><Sparkles className="h-4 w-4" />{t("calls.analyzeButton")}</>}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallDetailsDialog;
