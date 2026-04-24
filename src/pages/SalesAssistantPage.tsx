import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import SalesAssistantPanel from "@/components/SalesAssistantPanel";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useCallAnalyses } from "@/hooks/useCallAnalysis";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { CallAnalysis } from "@/types";
import { Calendar, Clock3, Pin, UserRoundSearch } from "lucide-react";

const SalesAssistantPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canAccessAssistant = user?.role === "admin" || user?.role === "closer";
  const [searchParams, setSearchParams] = useSearchParams();

  if (!canAccessAssistant) {
    return <Navigate to="/dashboard" replace />;
  }

  const [selectedCloserId, setSelectedCloserId] = useState(() => searchParams.get("closer") ?? "");
  const [selectedCallId, setSelectedCallId] = useState(() => searchParams.get("call"));
  const [selectedThreadId, setSelectedThreadId] = useState(() => searchParams.get("thread"));

  const { data: closers = [] } = useQuery({
    queryKey: ["profiles", "closers", "assistant-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "closer")
        .order("name");
      if (error) throw new Error(error.message);
      return data as Array<{ id: string; name: string }>;
    },
    enabled: isAdmin,
  });

  const assistantCloserId = isAdmin ? (selectedCloserId || "") : (user?.id ?? "");
  const { data: calls = [], isLoading } = useCallAnalyses(assistantCloserId || undefined);

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) ?? null,
    [calls, selectedCallId],
  );

  const closerLookup = useMemo(() => new Map(closers.map((closer) => [closer.id, closer.name])), [closers]);
  const closerName = isAdmin
    ? (selectedCloserId ? closerLookup.get(selectedCloserId) ?? null : null)
    : (user?.name ?? null);

  const focusableCalls = useMemo(
    () => calls.filter((call) => call.status === "done" || call.transcript),
    [calls],
  );

  useEffect(() => {
    if (!selectedCallId) return;
    if (!calls.some((call) => call.id === selectedCallId)) {
      setSelectedCallId(null);
    }
  }, [calls, selectedCallId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedCloserId) next.set("closer", selectedCloserId);
    else next.delete("closer");

    if (selectedCallId) next.set("call", selectedCallId);
    else next.delete("call");

    if (selectedThreadId) next.set("thread", selectedThreadId);
    else next.delete("thread");

    setSearchParams(next, { replace: true });
  }, [searchParams, selectedCallId, selectedCloserId, selectedThreadId, setSearchParams]);

  return (
    <AppLayout>
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Sales Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Chat-first coaching for calls, objections, and sales patterns.
            </p>
          </div>

          {isAdmin && (
            <Select
              value={selectedCloserId || "none"}
              onValueChange={(value) => {
                setSelectedCloserId(value === "none" ? "" : value);
                setSelectedCallId(null);
              }}
            >
              <SelectTrigger className="h-11 min-w-[260px] rounded-2xl border-border/60 bg-background font-bold">
                <SelectValue placeholder="Choose closer" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="none">Choose closer</SelectItem>
                {closers.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>
                    {closer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex-1">
          <SalesAssistantPanel
            closerId={assistantCloserId || null}
            closerName={closerName}
            selectedCall={selectedCall}
            calls={focusableCalls}
            disabledReason={!assistantCloserId ? "Choose a closer to open the standalone assistant." : null}
            onOpenCall={(call: CallAnalysis) => setSelectedCallId(call.id)}
            onClearSelectedCall={() => setSelectedCallId(null)}
            selectedThreadId={selectedThreadId}
            onSelectThread={(id) => setSelectedThreadId(id)}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default SalesAssistantPage;
