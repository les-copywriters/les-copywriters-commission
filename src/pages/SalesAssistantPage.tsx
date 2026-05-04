import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import SalesAssistantPanel from "@/components/SalesAssistantPanel";
import { useAuth } from "@/context/AuthContext";
import { useCallAnalyses } from "@/hooks/useCallAnalysis";
import { supabase } from "@/lib/supabase";
import { CallAnalysis } from "@/types";

const SalesAssistantPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canAccessAssistant = user?.role === "admin" || user?.role === "closer";
  const [searchParams, setSearchParams] = useSearchParams();

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
  const { data: calls = [] } = useCallAnalyses(assistantCloserId || undefined);

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) ?? null,
    [calls, selectedCallId],
  );

  const closerLookup = useMemo(() => new Map(closers.map((closer) => [closer.id, closer.name])), [closers]);
  const closerName = isAdmin
    ? (selectedCloserId ? closerLookup.get(selectedCloserId) ?? null : null)
    : (user?.name ?? null);

  // Include done + synced (has transcript in DB) + error (failed analysis but has transcript).
  // Only fully analyzed calls give Max structured context (score, feedback, patterns).
  // Synced-only calls have a transcript but no AI analysis, which produces weaker coaching.
  const focusableCalls = useMemo(
    () => calls.filter((call) => call.status === "done"),
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

  if (!canAccessAssistant) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout fullscreen>
      <SalesAssistantPanel
          closerId={assistantCloserId || null}
          closerName={closerName}
          isAdmin={isAdmin}
          closers={closers}
          selectedCloserId={selectedCloserId}
          onSelectCloser={(id) => {
            setSelectedCloserId(id);
            setSelectedCallId(null);
          }}
          selectedCall={selectedCall}
          calls={focusableCalls}
          disabledReason={!assistantCloserId ? "Choose a closer to open the assistant." : null}
          onOpenCall={(call: CallAnalysis) => setSelectedCallId(call.id)}
          onClearSelectedCall={() => setSelectedCallId(null)}
          selectedThreadId={selectedThreadId}
          onSelectThread={(id) => setSelectedThreadId(id)}
        />
    </AppLayout>
  );
};

export default SalesAssistantPage;
