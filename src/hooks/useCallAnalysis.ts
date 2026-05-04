import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CallAnalysis, CallAnalysisDetails, CallFeedback, CloserFramework, CloserProfile } from "@/types";

// ─── Mappers ──────────────────────────────────────────────────────────────────

type CallRow = {
  id: string;
  closer_id: string;
  fathom_meeting_id: string | null;
  call_title: string | null;
  call_date: string | null;
  call_started_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  score: number | null;
  feedback: unknown;
  analysis_details: unknown;
  status: "pending" | "synced" | "analyzing" | "done" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const mapCall = (row: CallRow): CallAnalysis => ({
  id: row.id,
  closerId: row.closer_id,
  fathomMeetingId: row.fathom_meeting_id,
  callTitle: row.call_title,
  callDate: row.call_date,
  callStartedAt: row.call_started_at,
  durationSeconds: row.duration_seconds,
  transcript: row.transcript,
  score: row.score,
  feedback: row.feedback as CallFeedback | null,
  analysisDetails: row.analysis_details as CallAnalysisDetails | null,
  status: row.status,
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type FrameworkRow = {
  id: string;
  closer_id: string;
  framework: string;
  generated_from_calls: string[];
  created_at: string;
  updated_at: string;
};

const mapFramework = (row: FrameworkRow): CloserFramework => ({
  id: row.id,
  closerId: row.closer_id,
  framework: row.framework,
  generatedFromCalls: row.generated_from_calls,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type CloserProfileRow = {
  id: string;
  closer_id: string;
  overview: string;
  strengths: string[];
  development_priorities: string[];
  common_objections: string[];
  winning_patterns: string[];
  risk_patterns: string[];
  coaching_tags: string[];
  average_scores: Record<string, number> | null;
  calls_analyzed: number;
  last_compiled_at: string | null;
  created_at: string;
  updated_at: string;
};

const mapCloserProfile = (row: CloserProfileRow): CloserProfile => ({
  id: row.id,
  closerId: row.closer_id,
  overview: row.overview,
  strengths: row.strengths,
  developmentPriorities: row.development_priorities,
  commonObjections: row.common_objections,
  winningPatterns: row.winning_patterns,
  riskPatterns: row.risk_patterns,
  coachingTags: row.coaching_tags,
  averageScores: row.average_scores ?? {},
  callsAnalyzed: row.calls_analyzed,
  lastCompiledAt: row.last_compiled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ─── Queries ──────────────────────────────────────────────────────────────────

// Lightweight list — no transcript column (transcripts can be 50KB+ each).
// Use this for all list/picker views. Fetch the full record only when opening
// a detail dialog via useFullCallAnalysis(id).
const LIST_COLUMNS = "id,closer_id,fathom_meeting_id,call_title,call_date,call_started_at,duration_seconds,score,status,error_message,created_at,updated_at,feedback,analysis_details";

export const useCallAnalyses = (closerId?: string) =>
  useQuery({
    queryKey: ["call_analyses", closerId ?? "all"],
    queryFn: async (): Promise<CallAnalysis[]> => {
      let query = supabase
        .from("call_analyses")
        .select(LIST_COLUMNS)
        .order("call_date", { ascending: false });

      if (closerId) query = query.eq("closer_id", closerId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as CallRow[]).map(mapCall);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasAnalyzing = Array.isArray(data) && data.some((c) => c.status === "analyzing");
      return hasAnalyzing ? 5000 : false;
    },
  });

// Full single-call fetch including transcript — used by CallDetailsDialog.
export const useFullCallAnalysis = (callId: string | null) =>
  useQuery({
    queryKey: ["call_analysis_full", callId],
    queryFn: async (): Promise<CallAnalysis | null> => {
      if (!callId) return null;
      const { data, error } = await supabase
        .from("call_analyses")
        .select("*")
        .eq("id", callId)
        .single();
      if (error) throw new Error(error.message);
      return mapCall(data as CallRow);
    },
    enabled: !!callId,
    staleTime: 30_000,
  });

export const useCloserFramework = (closerId: string | null) =>
  useQuery({
    queryKey: ["closer_framework", closerId],
    queryFn: async (): Promise<CloserFramework | null> => {
      if (!closerId) return null;
      const { data, error } = await supabase
        .from("closer_frameworks")
        .select("*")
        .eq("closer_id", closerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapFramework(data as FrameworkRow) : null;
    },
    enabled: !!closerId,
  });

export type FrameworkHistoryEntry = {
  id: string;
  closerId: string;
  framework: string;
  generatedFromCalls: string[];
  callsCount: number;
  createdAt: string;
};

export const useCloserFrameworkHistory = (closerId: string | null) =>
  useQuery({
    queryKey: ["closer_framework_history", closerId],
    queryFn: async (): Promise<FrameworkHistoryEntry[]> => {
      if (!closerId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("closer_framework_history")
        .select("id, closer_id, framework, generated_from_calls, calls_count, created_at")
        .eq("closer_id", closerId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) {
        // Table may not exist yet — return empty rather than crashing
        if (error.message.includes("does not exist")) return [];
        throw new Error(error.message);
      }
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        closerId: String(r.closer_id),
        framework: String(r.framework),
        generatedFromCalls: Array.isArray(r.generated_from_calls) ? r.generated_from_calls as string[] : [],
        callsCount: Number(r.calls_count ?? 0),
        createdAt: String(r.created_at),
      }));
    },
    enabled: !!closerId,
    staleTime: 0,
  });


// ─── Mutations ────────────────────────────────────────────────────────────────

export type SyncFathomResult = {
  ok: boolean;
  imported: number;
  total_seen: number;
  transcripts_fetched: number;
  remaining_pending: number;
  errors: string[];
  error?: string;
};

async function invokeSyncFathom(closerId?: string): Promise<SyncFathomResult> {
  const body = closerId ? { closer_id: closerId } : undefined;
  const { data, error } = await supabase.functions.invoke("sync-fathom", { body });
  if (error) {
    const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
    const parsed = await ctx.context?.json?.().catch(() => null);
    throw new Error((parsed as { error?: string })?.error ?? error.message);
  }
  const result = data as SyncFathomResult;
  if (!result.ok) throw new Error(result.error ?? "Sync failed");
  return result;
}

export const useSyncFathom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (closerId?: string): Promise<SyncFathomResult & { rounds: number }> => {
      const MAX_ROUNDS = 10;
      let rounds = 0;
      let totalImported = 0;
      let totalTranscripts = 0;
      let lastResult: SyncFathomResult | null = null;

      do {
        lastResult = await invokeSyncFathom(closerId);
        totalImported   += lastResult.imported;
        totalTranscripts += lastResult.transcripts_fetched;
        rounds++;
        // Invalidate between rounds so the UI reflects progress in real time.
        qc.invalidateQueries({ queryKey: ["call_analyses"] });
      } while (lastResult.remaining_pending > 0 && rounds < MAX_ROUNDS);

      return {
        ...lastResult,
        imported: totalImported,
        transcripts_fetched: totalTranscripts,
        rounds,
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call_analyses"] }),
  });
};

export const useAnalyzeCall = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke("analyze-call", {
        body: { call_id: callId },
      });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const result = data as { ok: boolean; score?: number; error?: string };
      if (!result.ok) throw new Error(result.error ?? "Analysis failed");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call_analyses"] });
      qc.invalidateQueries({ queryKey: ["closer_profile"] });
    },
  });
};

export const useGenerateFramework = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ closerId, callIds }: { closerId: string; callIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke("generate-framework", {
        body: { closer_id: closerId, call_ids: callIds },
      });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const result = data as { ok: boolean; framework?: string; calls_used?: number; error?: string };
      if (!result.ok) throw new Error(result.error ?? "Framework generation failed");
      return result;
    },
    onSuccess: (_data, { closerId }) => {
      qc.invalidateQueries({ queryKey: ["closer_framework", closerId] });
    },
  });
};


export const useBulkAnalyze = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (closerId?: string): Promise<{ analyzed: number; remaining: number; errors: string[] }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const { data, error } = await supabase.functions.invoke("bulk-analyze", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: closerId ? { closer_id: closerId } : {},
      });

      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }

      const result = data as { ok: boolean; analyzed: number; remaining: number; errors: string[]; error?: string };
      if (!result.ok) throw new Error(result.error ?? "Bulk analysis failed");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call_analyses"] });
      qc.invalidateQueries({ queryKey: ["closer_profile"] });
    },
  });
};

export const useUpdateFathomKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, apiKey }: { profileId: string; apiKey: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ fathom_api_key: apiKey || null })
        .eq("id", profileId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
};
