import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSetterCallRecords, SetterCallRecord } from "@/hooks/useSetterDashboard";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  Info,
  MessageSquare,
  Mic,
  PhoneCall,
  PhoneMissed,
  Play,
  Sparkles,
  User,
  Volume2,
} from "lucide-react";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const SetterCallDetailPage = () => {
  const { callId } = useParams<{ callId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const profileId = isAdmin ? undefined : user?.id;

  const { data: records = [], isLoading } = useSetterCallRecords(profileId);
  const stateCall = location.state?.call as SetterCallRecord | undefined;
  const call = stateCall ?? records.find((r) => String(r.id) === callId);

  const isAnswered = call?.status === "answered" || call?.status === "done";
  const isMissed = call?.status === "missed" || call?.status === "voicemail";
  const mins = Math.floor((call?.talkTimeSeconds ?? 0) / 60);
  const secs = (call?.talkTimeSeconds ?? 0) % 60;
  const durationMins = Math.floor((call?.durationSeconds ?? 0) / 60);
  const durationSecs = (call?.durationSeconds ?? 0) % 60;
  const displayName = call?.contactName || call?.contactPhone || "Unknown caller";

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-8 animate-in fade-in duration-400">

        {/* Back + header */}
        <div className="space-y-5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground -ml-1 rounded-lg"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Setter Ops
          </Button>

          {isLoading && !call ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-xl" />
              <Skeleton className="h-4 w-64 rounded-xl" />
            </div>
          ) : call ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl shrink-0",
                  isAnswered ? "bg-emerald-500/10 text-emerald-500"
                    : isMissed ? "bg-rose-500/10 text-rose-500"
                    : "bg-muted/40 text-muted-foreground"
                )}>
                  {isMissed
                    ? <PhoneMissed className="h-5 w-5" />
                    : call.direction === "outbound"
                      ? <ArrowUpRight className="h-5 w-5" />
                      : <ArrowDownLeft className="h-5 w-5" />}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {call.contactName && call.contactPhone && (
                      <span className="text-sm text-muted-foreground">{call.contactPhone}</span>
                    )}
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      isAnswered ? "bg-emerald-500/10 text-emerald-600"
                        : isMissed ? "bg-rose-500/10 text-rose-600"
                        : "bg-muted/50 text-muted-foreground"
                    )}>
                      {call.status ?? "unknown"}
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">{call.direction}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-medium">
                  {call.startedAt ? new Date(call.startedAt).toLocaleDateString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {call.startedAt ? new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Call not found.</p>
          )}
        </div>

        {call && (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Duration", value: formatDuration(call.durationSeconds) },
                { label: "Talk time", value: formatDuration(call.talkTimeSeconds) },
                { label: "Direction", value: call.direction ?? "—" },
                { label: "Call ID", value: call.aircallCallId },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border/40 bg-background p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                  <p className="text-sm font-semibold truncate tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Detail tabs */}
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <Tabs defaultValue="info">
                  <TabsList className="bg-transparent border-b border-border/40 w-full justify-start rounded-none h-11 p-0">
                    <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-6 text-sm font-medium gap-1.5">
                      <Info className="h-3.5 w-3.5" /> Information
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-6 text-sm font-medium gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Analysis
                    </TabsTrigger>
                    <TabsTrigger value="transcript" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-6 text-sm font-medium gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Transcript
                    </TabsTrigger>
                  </TabsList>

                  {/* Information */}
                  <TabsContent value="info" className="m-0 p-6 focus-visible:ring-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Contact</p>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary shrink-0">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">
                                {call.contactName || <span className="text-muted-foreground italic">No name in Aircall</span>}
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">{call.contactPhone || "—"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Direction</p>
                          <Badge variant="outline" className="capitalize text-xs font-medium border-border/40">{call.direction}</Badge>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Status</p>
                          <Badge variant="outline" className={cn(
                            "capitalize text-xs font-medium",
                            isAnswered ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                              : isMissed ? "border-rose-500/30 text-rose-600 bg-rose-500/5"
                              : "border-border/40"
                          )}>{call.status ?? "unknown"}</Badge>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Timestamp</p>
                          <p className="text-sm font-medium">{call.startedAt ? new Date(call.startedAt).toLocaleString() : "—"}</p>
                          <p className="text-xs text-muted-foreground/60">ID: {call.aircallCallId}</p>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Duration</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground/60 mb-0.5">Total</p>
                              <p className="font-semibold tabular-nums">{durationMins}m {durationSecs}s</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground/60 mb-0.5">Talk</p>
                              <p className="font-semibold tabular-nums">{mins}m {secs}s</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recording — full width */}
                      <div className="sm:col-span-2 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Recording</p>
                        {call.recordingUrl ? (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/20">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary text-white hover:bg-primary/90 shrink-0">
                              <Play className="h-4 w-4 fill-current" />
                            </Button>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-0 bg-primary w-1/3" />
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                              0:00 / {durationMins}:{durationSecs.toString().padStart(2, "0")}
                            </p>
                            <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground shrink-0">
                              <Volume2 className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border/40 text-center">
                            <p className="text-xs text-muted-foreground italic">Recording not available</p>
                          </div>
                        )}
                      </div>

                      {call.notes && (
                        <div className="sm:col-span-2 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Agent Notes</p>
                          <p className="text-sm text-muted-foreground leading-relaxed italic bg-muted/20 rounded-xl p-4">"{call.notes}"</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Analysis */}
                  <TabsContent value="analysis" className="m-0 p-6 focus-visible:ring-0">
                    <div className="grid md:grid-cols-[1fr_280px] gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-semibold">AI Summary</h4>
                        </div>
                        <div className="p-5 rounded-xl bg-primary/5 border border-primary/10">
                          {call.summary ? (
                            <p className="text-sm text-foreground/80 leading-relaxed">{call.summary}</p>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                              <Activity className="h-8 w-8 opacity-20 animate-pulse" />
                              <p className="text-xs italic">Summary not available — call may be too short or still processing.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs font-medium text-muted-foreground">Talk Ratio</p>
                        <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/20">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span>Agent</span>
                              <span className="text-muted-foreground">
                                {call.talkListenRatio?.agent ? `${Math.round(call.talkListenRatio.agent * 100)}%` : "—"}
                              </span>
                            </div>
                            <Progress value={call.talkListenRatio?.agent ? call.talkListenRatio.agent * 100 : 0} className="h-1.5 bg-muted" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                              <span>Contact</span>
                              <span>
                                {call.talkListenRatio?.customer ? `${Math.round(call.talkListenRatio.customer * 100)}%` : "—"}
                              </span>
                            </div>
                            <Progress value={call.talkListenRatio?.customer ? call.talkListenRatio.customer * 100 : 0} className="h-1.5 bg-muted" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Transcript */}
                  <TabsContent value="transcript" className="m-0 p-6 focus-visible:ring-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-semibold">Transcript</h4>
                        </div>
                        <Badge variant="outline" className="text-xs font-medium border-border/40">
                          ~ {Math.ceil(call.durationSeconds / 60)} min read
                        </Badge>
                      </div>

                      <ScrollArea className="h-[480px] w-full rounded-xl bg-muted/10 border border-border/20 p-5">
                        {call.transcription ? (
                          <div className="space-y-5">
                            {call.transcription.split("\n\n").map((para, i) => (
                              <div key={i} className="flex gap-3">
                                <div className={cn(
                                  "h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold",
                                  i % 2 === 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                )}>
                                  {i % 2 === 0 ? "A" : "C"}
                                </div>
                                <div className="space-y-0.5 flex-1">
                                  <p className="text-xs font-medium text-muted-foreground/60">
                                    {i % 2 === 0 ? "Agent" : "Contact"}
                                  </p>
                                  <p className="text-sm leading-relaxed text-foreground/80">{para}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                            <div className="h-12 w-12 rounded-full border-2 border-dashed border-border/40 flex items-center justify-center opacity-40">
                              <Mic className="h-6 w-6" />
                            </div>
                            <p className="text-xs italic">No transcription available for this call.</p>
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default SetterCallDetailPage;
