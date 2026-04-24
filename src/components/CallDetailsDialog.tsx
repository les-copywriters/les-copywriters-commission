import { useState } from "react";
import { CallAnalysis } from "@/types";
import { useAnalyzeCall } from "@/hooks/useCallAnalysis";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

const statusConfig: Record<CallAnalysis["status"], { label: string; className: string; icon?: React.ReactNode }> = {
  pending: { label: "Pending", className: "bg-muted/30 text-muted-foreground border-muted/40" },
  synced: { label: "Synced", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  analyzing: { label: "Analyzing", className: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  done: { label: "Done", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  error: { label: "Error", className: "bg-rose-500/10 text-rose-500 border-rose-500/20", icon: <XCircle className="h-3 w-3" /> },
};

const ScoreBlock = ({ score }: { score: number }) => {
  const tone =
    score >= 80 ? "text-emerald-500 bg-emerald-500/10" :
    score >= 60 ? "text-amber-500 bg-amber-500/10" :
    "text-rose-500 bg-rose-500/10";

  return (
    <div className={cn("flex h-28 w-28 flex-col items-center justify-center rounded-3xl", tone)}>
      <span className="text-3xl font-black tabular-nums leading-none">{score}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">/100</span>
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

  if (!call) return null;

  const status = statusConfig[call.status];
  const duration = call.durationSeconds ? `${Math.round(call.durationSeconds / 60)} min` : "—";
  const feedback = call.feedback;

  const handleAnalyze = () => {
    analyze.mutate(call.id, {
      onSuccess: () => toast.success(t("calls.analyzeSuccess")),
      onError: (error) => toast.error(`${t("calls.analyzeError")}: ${error.message}`),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0">
        <div className="p-8 border-b border-border/40 bg-background/80">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline" className={cn("gap-1.5 font-semibold text-xs", status.className)}>
                    {status.icon}
                    {status.label}
                  </Badge>
                  {call.score !== null && (
                    <Badge variant="outline" className="border-primary/20 text-primary font-bold px-3 py-1">
                      {call.score}/100
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-black tracking-tight leading-tight">
                  {call.callTitle ?? t("calls.untitledCall")}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {call.callDate ?? "No date"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {duration}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-8">
          {call.status === "done" && call.score !== null && feedback && (
            <div className="flex flex-col md:flex-row gap-6">
              <div className="shrink-0">
                <ScoreBlock score={call.score} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {t("calls.summary")}
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">{feedback.summary}</p>
              </div>
            </div>
          )}

          {call.status === "analyzing" && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <Loader2 className="h-5 w-5 text-amber-500 animate-spin shrink-0" />
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {t("calls.analyzingMessage")}
              </p>
            </div>
          )}

          {call.status === "error" && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{t("calls.analyzeError")}</p>
                {call.errorMessage && <p className="text-xs text-muted-foreground mt-1">{call.errorMessage}</p>}
              </div>
            </div>
          )}

          {feedback?.strengths && feedback.strengths.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("calls.strengths")}
                </p>
              </div>
              <div className="space-y-2 pl-8">
                {feedback.strengths.map((item, index) => (
                  <div key={index} className="flex items-start gap-2.5">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <p className="text-sm text-foreground/80 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {feedback?.improvements && feedback.improvements.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("calls.improvements")}
                </p>
              </div>
              <div className="space-y-2 pl-8">
                {feedback.improvements.map((item, index) => (
                  <div key={index} className="flex items-start gap-2.5">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <p className="text-sm text-foreground/80 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(call.status === "synced" || call.status === "error") && call.transcript && (
            <>
              <Separator className="opacity-40" />
              <Button
                className="w-full rounded-2xl h-12 font-bold gap-2"
                disabled={analyze.isPending}
                onClick={handleAnalyze}
              >
                {analyze.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("calls.analyzing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("calls.analyzeButton")}
                  </>
                )}
              </Button>
            </>
          )}

          {call.status === "pending" && !call.transcript && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{t("calls.noTranscript")}</p>
            </div>
          )}

          {call.transcript && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-3">
                <button
                  className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowTranscript((value) => !value)}
                >
                  {showTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {t("calls.transcript")}
                </button>
                {showTranscript && (
                  <div className="rounded-2xl bg-muted/20 border border-border/30 p-5 max-h-72 overflow-y-auto">
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
                      {call.transcript}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallDetailsDialog;
