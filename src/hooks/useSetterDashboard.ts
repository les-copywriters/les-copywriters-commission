import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  IntegrationSyncRun,
  SetterCallMetricDaily,
  SetterDashboardMetrics,
  SetterFunnelMetricDaily,
  SetterIntegrationMapping,
} from "@/types";
import { computeSetterDashboardMetrics } from "@/lib/setterDashboard";

type MappingRow = {
  profile_id: string;
  aircall_api_id: string | null;
  aircall_api_token: string | null;
  aircall_user_id: string | null;
  aircall_email: string | null;
  pipedrive_owner_id: string | null;
  pipedrive_email: string | null;
  iclosed_api_key: string | null;
  iclosed_api_base_url: string | null;
  iclosed_user_id: string | null;
  iclosed_email: string | null;
  notes: string | null;
  updated_at: string | null;
  profile: { id: string; name: string } | null;
};

type CallMetricRow = {
  profile_id: string;
  metric_date: string;
  source: "aircall";
  calls_made: number;
  calls_answered: number;
  talk_time_seconds: number;
};

type FunnelMetricRow = {
  profile_id: string;
  metric_date: string;
  source: "pipedrive" | "iclosed";
  leads_validated: number;
  leads_canceled: number;
  show_ups: number;
  closes: number;
};

type SyncRunRow = {
  id: string;
  source: "aircall" | "pipedrive" | "iclosed" | "scheduler";
  mode: "manual" | "scheduled";
  status: "running" | "success" | "partial" | "error";
  synced_from: string | null;
  synced_to: string | null;
  records_seen: number;
  rows_written: number;
  errors: string[] | null;
  started_at: string;
  finished_at: string | null;
  triggered_by: string | null;
};

const mapMapping = (row: MappingRow): SetterIntegrationMapping => ({
  profileId: row.profile_id,
  setterName: row.profile?.name ?? "Unknown setter",
  aircallApiId: row.aircall_api_id,
  aircallApiToken: row.aircall_api_token,
  aircallUserId: row.aircall_user_id,
  aircallEmail: row.aircall_email,
  pipedriveOwnerId: row.pipedrive_owner_id,
  pipedriveEmail: row.pipedrive_email,
  iclosedApiKey: row.iclosed_api_key,
  iclosedApiBaseUrl: row.iclosed_api_base_url,
  iclosedUserId: row.iclosed_user_id,
  iclosedEmail: row.iclosed_email,
  notes: row.notes,
  updatedAt: row.updated_at,
});

const mapCallMetric = (row: CallMetricRow): SetterCallMetricDaily => ({
  profileId: row.profile_id,
  metricDate: row.metric_date,
  source: row.source,
  callsMade: row.calls_made,
  callsAnswered: row.calls_answered,
  talkTimeSeconds: row.talk_time_seconds,
});

const mapFunnelMetric = (row: FunnelMetricRow): SetterFunnelMetricDaily => ({
  profileId: row.profile_id,
  metricDate: row.metric_date,
  source: row.source,
  leadsValidated: row.leads_validated,
  leadsCanceled: row.leads_canceled,
  showUps: row.show_ups,
  closes: row.closes,
});

const mapRun = (row: SyncRunRow): IntegrationSyncRun => ({
  id: row.id,
  source: row.source,
  mode: row.mode,
  status: row.status,
  syncedFrom: row.synced_from,
  syncedTo: row.synced_to,
  recordsSeen: row.records_seen,
  rowsWritten: row.rows_written,
  errors: Array.isArray(row.errors) ? row.errors : [],
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  triggeredBy: row.triggered_by,
});

export const useSetterIntegrationMappings = () =>
  useQuery({
    queryKey: ["setter_integration_mappings"],
    queryFn: async (): Promise<SetterIntegrationMapping[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("setter_integration_mappings")
        .select(`
          profile_id,
          aircall_api_id,
          aircall_api_token,
          aircall_user_id,
          aircall_email,
          pipedrive_owner_id,
          pipedrive_email,
          iclosed_api_key,
          iclosed_api_base_url,
          iclosed_user_id,
          iclosed_email,
          notes,
          updated_at,
          profile:profiles!profile_id(id, name)
        `)
        .order("updated_at", { ascending: false, nullsFirst: false });

      if (error) throw new Error(error.message);
      return ((data ?? []) as MappingRow[]).map(mapMapping);
    },
  });

export const useUpsertSetterIntegrationMapping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<SetterIntegrationMapping, "setterName" | "updatedAt">) => {
      const payload = {
        profile_id: input.profileId,
        aircall_api_id: input.aircallApiId || null,
        aircall_api_token: input.aircallApiToken || null,
        aircall_user_id: input.aircallUserId || null,
        aircall_email: input.aircallEmail || null,
        pipedrive_owner_id: input.pipedriveOwnerId || null,
        pipedrive_email: input.pipedriveEmail || null,
        iclosed_api_key: input.iclosedApiKey || null,
        iclosed_api_base_url: input.iclosedApiBaseUrl || null,
        iclosed_user_id: input.iclosedUserId || null,
        iclosed_email: input.iclosedEmail || null,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("setter_integration_mappings")
        .upsert(payload, { onConflict: "profile_id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setter_integration_mappings"] });
      qc.invalidateQueries({ queryKey: ["setter_sync_health"] });
    },
  });
};

export const useSetterDashboardMetrics = ({
  profileId,
  startDate,
  endDate,
  enabled = true,
}: {
  profileId?: string;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ["setter_dashboard_metrics", profileId ?? "all", startDate, endDate],
    queryFn: async (): Promise<SetterDashboardMetrics> => {
      // The generated database types have not been refreshed for these new tables yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let callQuery = (supabase as any)
        .from("setter_call_metrics_daily")
        .select("profile_id, metric_date, source, calls_made, calls_answered, talk_time_seconds")
        .gte("metric_date", startDate)
        .lte("metric_date", endDate)
        .order("metric_date", { ascending: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let funnelQuery = (supabase as any)
        .from("setter_funnel_metrics_daily")
        .select("profile_id, metric_date, source, leads_validated, leads_canceled, show_ups, closes")
        .gte("metric_date", startDate)
        .lte("metric_date", endDate)
        .order("metric_date", { ascending: true });

      if (profileId) {
        callQuery = callQuery.eq("profile_id", profileId);
        funnelQuery = funnelQuery.eq("profile_id", profileId);
      }

      const [{ data: callRows, error: callError }, { data: funnelRows, error: funnelError }] = await Promise.all([
        callQuery,
        funnelQuery,
      ]);
      if (callError) throw new Error(callError.message);
      if (funnelError) throw new Error(funnelError.message);

      return computeSetterDashboardMetrics(
        ((callRows ?? []) as CallMetricRow[]).map(mapCallMetric),
        ((funnelRows ?? []) as FunnelMetricRow[]).map(mapFunnelMetric),
      );
    },
    enabled,
  });

export const useSetterSyncHealth = (enabled = true) =>
  useQuery({
    queryKey: ["setter_sync_health"],
    queryFn: async (): Promise<IntegrationSyncRun[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("integration_sync_runs")
        .select("id, source, mode, status, synced_from, synced_to, records_seen, rows_written, errors, started_at, finished_at, triggered_by")
        .order("started_at", { ascending: false })
        .limit(12);
      if (error) throw new Error(error.message);
      return ((data ?? []) as SyncRunRow[]).map(mapRun);
    },
    enabled,
  });

export const useSyncSetterDashboard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      source?: "all" | "aircall" | "pipedrive" | "iclosed";
      profileId?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("sync-setter-dashboard", {
        body: {
          source: payload.source ?? "all",
          profile_id: payload.profileId,
          start_date: payload.startDate,
          end_date: payload.endDate,
        },
      });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      return data as { ok: boolean; results?: unknown[]; error?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setter_dashboard_metrics"] });
      qc.invalidateQueries({ queryKey: ["setter_sync_health"] });
      qc.invalidateQueries({ queryKey: ["setter_call_records"] });
    },
  });
};

export type SetterCallRecord = {
  id: number;
  profileId: string;
  aircallCallId: string;
  direction: string | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  talkTimeSeconds: number;
  contactName: string | null;
  contactPhone: string | null;
  recordingUrl: string | null;
  notes: string | null;
  transcription: string | null;
  summary: string | null;
  aiTopics: any;
  aiSentiments: any;
  talkListenRatio: any;
};

function extractNameFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  // Try contact object first
  const contact = p.contact as Record<string, unknown> | null | undefined;
  if (contact) {
    const name = String(contact.name ?? "").trim();
    if (name) return name;
    const full = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
    if (full) return full;
  }

  // Try participants array — most reliable source for external party name
  const participants = Array.isArray(p.participants)
    ? (p.participants as Array<Record<string, unknown>>)
    : [];
  const agentId = String((p.user as Record<string, unknown> | undefined)?.id ?? p.user_id ?? "");
  const external = participants.find(
    (part) =>
      part.type === "external" ||
      part.type === "contact" ||
      (part.type !== "user" && String(part.id ?? "") !== agentId),
  );
  if (external?.name) return String(external.name).trim() || null;

  return null;
}

export const useSetterCallRecords = (profileId?: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ["setter_call_records", profileId, startDate, endDate],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("setter_call_records")
        .select("id, profile_id, aircall_call_id, direction, status, started_at, ended_at, duration_seconds, talk_time_seconds, contact_name, contact_phone, recording_url, notes, transcription, summary, ai_topics, ai_sentiments, talk_listen_ratio, raw_payload")
        .order("started_at", { ascending: false })
        .limit(200);
      if (profileId) query = query.eq("profile_id", profileId);
      if (startDate) query = query.gte("started_at", startDate);
      if (endDate) query = query.lte("started_at", `${endDate}T23:59:59`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        profileId: r.profile_id,
        aircallCallId: r.aircall_call_id,
        direction: r.direction,
        status: r.status,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        durationSeconds: r.duration_seconds,
        talkTimeSeconds: r.talk_time_seconds,
        // Use stored name, fall back to raw_payload participants/contact
        contactName: r.contact_name || extractNameFromPayload(r.raw_payload) || null,
        contactPhone: r.contact_phone,
        recordingUrl: r.recording_url,
        notes: r.notes,
        transcription: r.transcription,
        summary: r.summary,
        aiTopics: r.ai_topics,
        aiSentiments: r.ai_sentiments,
        talkListenRatio: r.talk_listen_ratio,
      })) as SetterCallRecord[];
    },
  });
};
