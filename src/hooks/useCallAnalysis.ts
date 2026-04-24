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

export const useCallAnalyses = (closerId?: string) =>
  useQuery({
    queryKey: ["call_analyses", closerId ?? "all"],
    queryFn: async (): Promise<CallAnalysis[]> => {
      let query = supabase
        .from("call_analyses")
        .select("*")
        .order("call_date", { ascending: false });

      if (closerId) query = query.eq("closer_id", closerId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as CallRow[]).map(mapCall);
    },
    refetchInterval: (query) => {
      // Poll every 5 seconds while any call is still being analyzed
      const data = query.state.data;
      const hasAnalyzing = Array.isArray(data) && data.some((c) => c.status === "analyzing");
      return hasAnalyzing ? 5000 : false;
    },
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

export const useCloserProfile = (closerId: string | null) =>
  useQuery({
    queryKey: ["closer_profile", closerId],
    queryFn: async (): Promise<CloserProfile | null> => {
      if (!closerId) return null;
      const { data, error } = await supabase
        .from("closer_profiles")
        .select("*")
        .eq("closer_id", closerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapCloserProfile(data as CloserProfileRow) : null;
    },
    enabled: !!closerId,
  });

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useSyncFathom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (closerId?: string) => {
      const body = closerId ? { closer_id: closerId } : undefined;
      const { data, error } = await supabase.functions.invoke("sync-fathom", { body });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const result = data as {
        ok: boolean;
        imported: number;
        total_seen: number;
        errors: string[];
        error?: string;
      };
      if (!result.ok) throw new Error(result.error ?? "Sync failed");
      return result;
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

export const useRefreshCloserProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (closerId: string) => {
      const { data, error } = await supabase.functions.invoke("refresh-closer-profile", {
        body: { closer_id: closerId },
      });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? "Closer profile refresh failed");
      return result;
    },
    onSuccess: (_data, closerId) => {
      qc.invalidateQueries({ queryKey: ["closer_profile", closerId] });
      qc.invalidateQueries({ queryKey: ["call_analyses", closerId] });
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
