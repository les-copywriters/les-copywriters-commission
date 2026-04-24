import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type CallFeedback = {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
};

type CallAnalysisDetails = {
  rapportScore?: number;
  discoveryScore?: number;
  pitchScore?: number;
  objectionHandlingScore?: number;
  closingScore?: number;
  confidenceScore?: number;
  nextStepClarityScore?: number;
  dominantObjections?: string[];
  buyerSignals?: string[];
  coachTags?: string[];
  missedOpportunities?: string[];
  recommendedNextActions?: string[];
};

type CompletedCall = {
  feedback: CallFeedback | null;
  analysis_details: CallAnalysisDetails | null;
  score: number | null;
  call_date: string | null;
  call_title: string | null;
};

function normalizeItems(items: string[] | undefined, limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const item of items ?? []) {
    const normalized = item.trim().replace(/\s+/g, " ");
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function collectScores(calls: CompletedCall[], key: keyof CallAnalysisDetails): number[] {
  return calls
    .map((call) => call.analysis_details?.[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function buildOverview(calls: CompletedCall[], strengths: string[], priorities: string[], objections: string[]): string {
  if (calls.length === 0) {
    return "No completed call analyses yet. Analyze a few calls to generate a closer profile.";
  }

  const recentCall = [...calls]
    .filter((call) => call.call_date)
    .sort((a, b) => (b.call_date ?? "").localeCompare(a.call_date ?? ""))[0];
  const avgScore = averageOf(calls.map((call) => call.score).filter((value): value is number => typeof value === "number"));

  const overview = [
    `This profile is compiled from ${calls.length} analyzed call${calls.length === 1 ? "" : "s"}.`,
    avgScore > 0 ? `Average overall score is ${avgScore}/100.` : null,
    strengths[0] ? `Most consistent strength: ${strengths[0]}` : null,
    priorities[0] ? `Main coaching priority: ${priorities[0]}` : null,
    objections[0] ? `Most common objection trend: ${objections[0]}` : null,
    recentCall?.call_title ? `Most recent analyzed call: ${recentCall.call_title}.` : null,
  ].filter(Boolean);

  return overview.join(" ");
}

export async function refreshCloserProfile(adminClient: SupabaseClient, closerId: string) {
  const { data, error } = await adminClient
    .from("call_analyses")
    .select("feedback, analysis_details, score, call_date, call_title")
    .eq("closer_id", closerId)
    .eq("status", "done")
    .order("call_date", { ascending: false });

  if (error) throw new Error(error.message);

  const calls = (data ?? []) as CompletedCall[];

  const strengths = normalizeItems(calls.flatMap((call) => call.feedback?.strengths ?? []));
  const developmentPriorities = normalizeItems(calls.flatMap((call) => call.feedback?.improvements ?? []));
  const commonObjections = normalizeItems(calls.flatMap((call) => call.analysis_details?.dominantObjections ?? []));
  const winningPatterns = normalizeItems([
    ...calls.flatMap((call) => call.feedback?.strengths ?? []),
    ...calls.flatMap((call) => call.analysis_details?.buyerSignals ?? []),
  ]);
  const riskPatterns = normalizeItems([
    ...calls.flatMap((call) => call.feedback?.improvements ?? []),
    ...calls.flatMap((call) => call.analysis_details?.missedOpportunities ?? []),
  ]);
  const coachingTags = normalizeItems(calls.flatMap((call) => call.analysis_details?.coachTags ?? []), 8);

  const averageScores = {
    overall: averageOf(calls.map((call) => call.score).filter((value): value is number => typeof value === "number")),
    rapport: averageOf(collectScores(calls, "rapportScore")),
    discovery: averageOf(collectScores(calls, "discoveryScore")),
    pitch: averageOf(collectScores(calls, "pitchScore")),
    objectionHandling: averageOf(collectScores(calls, "objectionHandlingScore")),
    closing: averageOf(collectScores(calls, "closingScore")),
    confidence: averageOf(collectScores(calls, "confidenceScore")),
    nextStepClarity: averageOf(collectScores(calls, "nextStepClarityScore")),
  };

  const now = new Date().toISOString();
  const payload = {
    closer_id: closerId,
    overview: buildOverview(calls, strengths, developmentPriorities, commonObjections),
    strengths,
    development_priorities: developmentPriorities,
    common_objections: commonObjections,
    winning_patterns: winningPatterns,
    risk_patterns: riskPatterns,
    coaching_tags: coachingTags,
    average_scores: averageScores,
    calls_analyzed: calls.length,
    last_compiled_at: now,
    updated_at: now,
  };

  const { error: upsertError } = await adminClient
    .from("closer_profiles")
    .upsert(payload, { onConflict: "closer_id" });

  if (upsertError) throw new Error(upsertError.message);

  return payload;
}
