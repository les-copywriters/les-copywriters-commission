import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export type SyncSource = "aircall" | "pipedrive" | "iclosed";
export type SyncMode = "manual" | "scheduled";

type Caller = {
  userId: string | null;
  role: "admin" | "closer" | "setter" | null;
  viaCron: boolean;
};

type SetterMapping = {
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
};

type CallAggregate = {
  profile_id: string;
  metric_date: string;
  source: "aircall";
  calls_made: number;
  calls_answered: number;
  talk_time_seconds: number;
  raw_payload: Record<string, unknown>;
};

type CallRecord = {
  profile_id: string;
  aircall_call_id: string;
  direction: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  talk_time_seconds: number;
  contact_name: string | null;
  contact_phone: string | null;
  recording_url: string | null;
  notes: string | null;
  transcription?: string | null;
  summary?: string | null;
  ai_topics?: any;
  ai_sentiments?: any;
  talk_listen_ratio?: { agent: number; customer: number } | null;
  raw_payload: Record<string, unknown>;
};

type FunnelAggregate = {
  profile_id: string;
  metric_date: string;
  source: "pipedrive" | "iclosed";
  leads_validated: number;
  leads_canceled: number;
  show_ups: number;
  closes: number;
  raw_payload: Record<string, unknown>;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function resolveCaller(req: Request, supabase: SupabaseClient): Promise<Caller> {
  const cronSecret = Deno.env.get("SETTER_DASHBOARD_CRON_SECRET");
  const providedCronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedCronSecret && providedCronSecret === cronSecret) {
    return { userId: null, role: "admin", viaCron: true };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { userId: null, role: null, viaCron: false };

  // Decode the JWT payload to extract the user ID.
  // Supabase projects using ES256 signing cannot re-validate the token from within
  // an Edge Function — but the Supabase gateway already validated it before invoking us.
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return { userId: null, role: null, viaCron: false };

  let payload: { sub?: string; role?: string; exp?: number };
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    payload = JSON.parse(atob(base64));
  } catch {
    return { userId: null, role: null, viaCron: false };
  }

  // Reject expired tokens as a basic sanity check
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return { userId: null, role: null, viaCron: false };
  }

  const userId = payload.sub;
  if (!userId) return { userId: null, role: null, viaCron: false };

  // Look up the application role from the profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  return {
    userId,
    role: (profile?.role as Caller["role"]) ?? null,
    viaCron: false,
  };
}

export function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toUnixSeconds(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

function getDateWindow(startDate?: string, endDate?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const end = normalizeDate(endDate) ?? today;
  const start = normalizeDate(startDate) ?? "2020-01-01";
  return { start, end, fromUnix: toUnixSeconds(start), toUnix: toUnixSeconds(end) + 86399 };
}

export async function getGlobalSettings(supabase: SupabaseClient): Promise<Record<string, string | null>> {
  const { data, error } = await supabase.from("global_settings").select("key, value");
  const settings: Record<string, string | null> = {
    aircall_api_id: Deno.env.get("AIRCALL_API_ID") || null,
    aircall_api_token: Deno.env.get("AIRCALL_API_TOKEN") || null,
    iclosed_api_key: Deno.env.get("ICLOSED_API_KEY") || null,
    iclosed_api_base_url: Deno.env.get("ICLOSED_API_BASE_URL") || "https://public.api.iclosed.io/v1",
  };
  
  if (!error && data) {
    for (const s of data) {
      // Database overrides environment variables if set in DB
      if (s.value) settings[s.key] = s.value;
    }
  }
  return settings;
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${url}: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid JSON returned from ${url}`);
    }
  } catch (err) {
    const errStr = String(err);
    const isDns = errStr.includes("dns error") || errStr.includes("Name or service not known") || errStr.includes("failed to lookup");
    const isTimeout = errStr.includes("abort") || errStr.includes("timed out");
    if (isDns) {
      const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
      throw new Error(`Cannot reach "${host}" — domain not found in DNS. Check the iClosed API Base URL in Settings → API Keys → Global Integrations.`);
    }
    if (isTimeout) {
      throw new Error(`Request to ${url} timed out after 20 s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function groupCallRows(rows: CallAggregate[]) {
  const grouped = new Map<string, CallAggregate>();
  for (const row of rows) {
    const key = `${row.profile_id}:${row.metric_date}:${row.source}`;
    const current = grouped.get(key) ?? {
      profile_id: row.profile_id,
      metric_date: row.metric_date,
      source: row.source,
      calls_made: 0,
      calls_answered: 0,
      talk_time_seconds: 0,
      raw_payload: { count: 0 },
    };
    current.calls_made += row.calls_made;
    current.calls_answered += row.calls_answered;
    current.talk_time_seconds += row.talk_time_seconds;
    current.raw_payload = {
      count: Number(current.raw_payload.count ?? 0) + Number(row.raw_payload.count ?? 0),
    };
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function groupFunnelRows(rows: FunnelAggregate[]) {
  const grouped = new Map<string, FunnelAggregate>();
  for (const row of rows) {
    const key = `${row.profile_id}:${row.metric_date}:${row.source}`;
    const current = grouped.get(key) ?? {
      profile_id: row.profile_id,
      metric_date: row.metric_date,
      source: row.source,
      leads_validated: 0,
      leads_canceled: 0,
      show_ups: 0,
      closes: 0,
      raw_payload: { count: 0 },
    };
    current.leads_validated += row.leads_validated;
    current.leads_canceled += row.leads_canceled;
    current.show_ups += row.show_ups;
    current.closes += row.closes;
    current.raw_payload = {
      count: Number(current.raw_payload.count ?? 0) + Number(row.raw_payload.count ?? 0),
    };
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function getAircallTalkTime(call: Record<string, unknown>) {
  const direct = Number(call.talk_time ?? call.duration ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const answeredAt = typeof call.answered_at === "string" ? Date.parse(call.answered_at) : NaN;
  const endedAt = typeof call.ended_at === "string" ? Date.parse(call.ended_at) : NaN;
  if (!Number.isNaN(answeredAt) && !Number.isNaN(endedAt) && endedAt > answeredAt) {
    return Math.round((endedAt - answeredAt) / 1000);
  }

  return 0;
}


function pushFunnelMetric(
  rows: FunnelAggregate[],
  profileId: string,
  source: "pipedrive" | "iclosed",
  metricDate: string | null,
  key: "leads_validated" | "leads_canceled" | "show_ups" | "closes",
) {
  if (!metricDate) return;
  rows.push({
    profile_id: profileId,
    metric_date: metricDate,
    source,
    leads_validated: key === "leads_validated" ? 1 : 0,
    leads_canceled: key === "leads_canceled" ? 1 : 0,
    show_ups: key === "show_ups" ? 1 : 0,
    closes: key === "closes" ? 1 : 0,
    raw_payload: { count: 1, event: key },
  });
}

// Syncs one setter's iClosed account using their own API credentials.
async function syncIClosedForSetter(
  mapping: SetterMapping,
  startDate?: string,
  endDate?: string,
): Promise<{ rows: FunnelAggregate[]; recordsSeen: number }> {
  const apiKey = mapping.iclosed_api_key;
  const baseUrl = mapping.iclosed_api_base_url;
  if (!apiKey || !baseUrl) return { rows: [], recordsSeen: 0 };

  const { start, end } = getDateWindow(startDate, endDate);
  const base = baseUrl.replace(/\/$/, "");
  const rows: FunnelAggregate[] = [];
  let totalSeen = 0;
  let page = 1;

  while (page <= 20) {
    const params = new URLSearchParams({
      eventType: "ALL",
      dateFrom: start,
      dateTo: end,
      limit: "100",
      page: String(page),
    });
    // Filter by setter — iClosed links setters via SettedClaim, use setterIds param
    if (mapping.iclosed_user_id) params.set("setterIds", mapping.iclosed_user_id);

    const url = `${base}/eventCalls?${params}`;
    console.log(`[iclosed] fetching: ${url}`);
    const payload = await fetchJson(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log(`[iclosed] response top-level keys: ${Object.keys(payload).join(", ")}`);
    console.log(`[iclosed] payload.data type: ${typeof payload.data}, isArray: ${Array.isArray(payload.data)}`);
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      console.log(`[iclosed] payload.data keys: ${Object.keys(payload.data as object).join(", ")}`);
    }

    // iClosed may wrap in { data: { eventCalls: [...] } } or { eventCalls: [...] }
    const dataWrapper = (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data))
      ? payload.data as Record<string, unknown>
      : payload;
    const items = Array.isArray(dataWrapper.eventCalls)
      ? dataWrapper.eventCalls
      : Array.isArray(payload.eventCalls)
      ? payload.eventCalls
      : Array.isArray(payload.data)
      ? payload.data
      : [];
    console.log(`[iclosed] items count: ${items.length}`);

    if (!items.length) break;

    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const metricDate = normalizeDate(String(item.dateTime ?? item.date_time ?? ""));

      // Outcome can be on the event call directly OR on the setter's SettedClaim
      const settedClaim = item.SettedClaim as Record<string, unknown> | null | undefined;
      const outcome = String(item.outcome ?? settedClaim?.outcome ?? "").toUpperCase();

      // Every booked call with a setter claim = lead validated
      pushFunnelMetric(rows, mapping.profile_id, "iclosed", metricDate, "leads_validated");

      // Canceled by admin or contact
      if (outcome === "ADMIN_CANCELLED" || outcome === "CONTACT_CANCELLED") {
        pushFunnelMetric(rows, mapping.profile_id, "iclosed", metricDate, "leads_canceled");
      }

      // Showed up = had a real outcome (not a cancel or no-show, and not empty)
      if (outcome && outcome !== "NO_SHOW" && outcome !== "ADMIN_CANCELLED" && outcome !== "CONTACT_CANCELLED") {
        pushFunnelMetric(rows, mapping.profile_id, "iclosed", metricDate, "show_ups");
      }

      // Closed = APPROVED (sale made)
      if (outcome === "APPROVED") {
        pushFunnelMetric(rows, mapping.profile_id, "iclosed", metricDate, "closes");
      }

      totalSeen++;
    }

    if (items.length < 100) break;
    page++;
  }

  return { rows: groupFunnelRows(rows), recordsSeen: totalSeen };
}

async function upsertCallRecords(supabase: SupabaseClient, records: CallRecord[]) {
  if (!records.length) return 0;
  const { error } = await supabase.from("setter_call_records").upsert(records, {
    onConflict: "aircall_call_id,profile_id",
  });
  if (error) throw new Error(error.message);
  return records.length;
}

async function upsertCallMetrics(supabase: SupabaseClient, rows: CallAggregate[]) {
  if (!rows.length) return 0;
  const { error } = await supabase.from("setter_call_metrics_daily").upsert(rows, {
    onConflict: "profile_id,metric_date,source",
  });
  if (error) throw new Error(error.message);
  return rows.length;
}

async function upsertFunnelMetrics(supabase: SupabaseClient, rows: FunnelAggregate[]) {
  if (!rows.length) return 0;
  const { error } = await supabase.from("setter_funnel_metrics_daily").upsert(rows, {
    onConflict: "profile_id,metric_date,source",
  });
  if (error) throw new Error(error.message);
  return rows.length;
}

async function createRun(
  supabase: SupabaseClient,
  source: SyncSource,
  mode: SyncMode,
  triggeredBy: string | null,
  startDate?: string,
  endDate?: string,
) {
  const { data, error } = await supabase
    .from("integration_sync_runs")
    .insert({
      source,
      mode,
      status: "running",
      triggered_by: triggeredBy,
      synced_from: normalizeDate(startDate),
      synced_to: normalizeDate(endDate),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Unable to create sync run");
  return String(data.id);
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string,
  status: "success" | "partial" | "error",
  recordsSeen: number,
  rowsWritten: number,
  errors: string[],
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("integration_sync_runs")
    .update({
      status,
      records_seen: recordsSeen,
      rows_written: rowsWritten,
      errors,
      metadata,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function runSetterDashboardSync(options: {
  supabase: SupabaseClient;
  source: SyncSource | "all";
  mode: SyncMode;
  startDate?: string;
  endDate?: string;
  triggeredBy: string | null;
  profileId?: string;
}) {
  const { supabase, source, mode, startDate, endDate, triggeredBy, profileId } = options;
  const selectedSources: SyncSource[] = source === "all" ? ["aircall", "iclosed"] : [source];

    let mappingQuery = supabase
    .from("setter_integration_mappings")
    .select(
      "profile_id, aircall_api_id, aircall_api_token, aircall_user_id, aircall_email, pipedrive_owner_id, pipedrive_email, iclosed_api_key, iclosed_api_base_url, iclosed_user_id, iclosed_email",
    );
  if (profileId) mappingQuery = mappingQuery.eq("profile_id", profileId);

  const { data: mappings, error: mappingError } = await mappingQuery;
  if (mappingError) throw new Error(mappingError.message);

  if (!mappings || mappings.length === 0) {
    throw new Error("No setter mappings found. Please go to Settings -> Setter Integrations and add your team members (at least their Aircall/iClosed User IDs) to enable syncing.");
  }
  
  const global = await getGlobalSettings(supabase);
  const rows = ((mappings ?? []) as SetterMapping[]).map(m => ({
    ...m,
    aircall_api_id: m.aircall_api_id || global.aircall_api_id,
    aircall_api_token: m.aircall_api_token || global.aircall_api_token,
    iclosed_api_key: m.iclosed_api_key || global.iclosed_api_key,
    iclosed_api_base_url: m.iclosed_api_base_url || global.iclosed_api_base_url,
  }));

  const results: Array<{
    source: SyncSource;
    records_seen: number;
    rows_written: number;
    status: "success" | "partial" | "error";
    errors: string[];
  }> = [];

  for (const selectedSource of selectedSources) {
    const runId = await createRun(supabase, selectedSource, mode, triggeredBy, startDate, endDate);
    let totalRecordsSeen = 0;
    let totalRowsWritten = 0;
    const errors: string[] = [];

    try {
      if (selectedSource === "aircall") {
        const allCallRows: CallAggregate[] = [];
        const allCallRecords: CallRecord[] = [];
        
        // Group setters by their Aircall credentials to avoid redundant API calls
        const credGroups = new Map<string, { id: string; token: string; mappings: SetterMapping[] }>();
        for (const m of rows) {
          if (!m.aircall_api_id || !m.aircall_api_token) continue;
          const key = `${m.aircall_api_id}:${m.aircall_api_token}`;
          if (!credGroups.has(key)) {
            credGroups.set(key, { id: m.aircall_api_id, token: m.aircall_api_token, mappings: [] });
          }
          credGroups.get(key)!.mappings.push(m);
        }

        if (credGroups.size === 0) {
          errors.push("No setter mappings with Aircall credentials found. Configure setter mappings and global API keys in Settings → Setter Integrations.");
        }

        for (const group of credGroups.values()) {
          try {
            const { fromUnix, toUnix } = getDateWindow(startDate, endDate);
            const auth = btoa(`${group.id}:${group.token}`);
            let page = 1;
            const seenUserIds = new Set<string>();

            while (page <= 20) {
              const payload = await fetchJson(
                `https://api.aircall.io/v1/calls?from=${fromUnix}&to=${toUnix}&page=${page}&per_page=100`,
                { headers: { Authorization: `Basic ${auth}` } },
              );
              const calls = (Array.isArray(payload.calls) ? payload.calls : Array.isArray(payload.data) ? payload.data : []) as Record<string, unknown>[];
              if (!calls.length) break;

              for (const call of calls) {
                const callUserId = String(call.user_id ?? (call.user as Record<string, unknown> | undefined)?.id ?? "");
                if (callUserId) seenUserIds.add(callUserId);
                const answered = Boolean(call.answered ?? call.answered_at ?? (call.status === "answered"));
                const talkTime = getAircallTalkTime(call);
                const metricDate = normalizeDate(String(call.started_at ?? call.created_at ?? "")) || normalizeDate(startDate) || new Date().toISOString().slice(0, 10);

                // Assign to every matching setter
                for (const m of group.mappings) {
                  if (m.aircall_user_id && String(m.aircall_user_id) !== callUserId) continue;
                  
                  allCallRows.push({
                    profile_id: m.profile_id,
                    metric_date: metricDate,
                    source: "aircall",
                    calls_made: 1,
                    calls_answered: answered ? 1 : 0,
                    talk_time_seconds: talkTime,
                    raw_payload: { count: 1 },
                  });

                  const contact = call.contact as Record<string, unknown> | null | undefined;
                  const recording = call.recording as Record<string, unknown> | undefined;
                  const startedUnix = Number(call.started_at ?? 0);
                  const endedUnix = Number(call.ended_at ?? 0);
                  const rawDigits = String(call.raw_digits ?? "");

                  let cn = String(contact?.name ?? "");
                  if (!cn && contact) {
                    cn = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
                  }
                  if (!cn) {
                    const participants = Array.isArray(call.participants)
                      ? (call.participants as Array<Record<string, unknown>>)
                      : [];
                    const agentId = String((call.user as Record<string, unknown> | undefined)?.id ?? call.user_id ?? "");
                    const external = participants.find(p =>
                      p.type === "external" || p.type === "contact" ||
                      (p.type !== "user" && String(p.id ?? "") !== agentId)
                    );
                    if (external?.name) cn = String(external.name);
                  }
                    const record: CallRecord = {
                      profile_id: m.profile_id,
                      aircall_call_id: String(call.id ?? ""),
                      direction: String(call.direction ?? ""),
                      status: String(call.status ?? ""),
                      started_at: startedUnix > 0 ? new Date(startedUnix * 1000).toISOString() : null,
                      ended_at: endedUnix > 0 ? new Date(endedUnix * 1000).toISOString() : null,
                      duration_seconds: Number(call.duration ?? 0),
                      talk_time_seconds: talkTime,
                      contact_name: cn || null,
                      contact_phone: String(contact?.direct_phone_number ?? contact?.phone_number ?? rawDigits ?? "") || null,
                      recording_url: String(recording?.url ?? call.recording_url ?? "") || null,
                      notes: String(call.comments ?? "") || null,
                      raw_payload: call,
                    };

                    allCallRecords.push(record);
                }
                totalRecordsSeen++;
              }
              if (calls.length < 100) break;
              page++;
            }

            if (totalRecordsSeen > 0 && allCallRows.length === 0 && seenUserIds.size > 0) {
              const mappingIds = group.mappings.map(m => m.aircall_user_id ?? "(none)").join(", ");
              console.log(
                `[aircall] ${totalRecordsSeen} calls fetched but none matched setter IDs. ` +
                `IDs in calls: [${[...seenUserIds].join(", ")}], IDs in mappings: [${mappingIds}]`
              );
            }
          } catch (err) {
            errors.push(`Aircall Group ${group.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        await upsertCallRecords(supabase, allCallRecords);
        totalRowsWritten = await upsertCallMetrics(supabase, groupCallRows(allCallRows));

      } else if (selectedSource === "iclosed") {
        const allFunnelRows: FunnelAggregate[] = [];
        for (const mapping of rows) {
          if (!mapping.iclosed_api_key || !mapping.iclosed_api_base_url) {
            errors.push(`${mapping.profile_id}: Missing iClosed API key or Base URL (check Global Settings)`);
            continue;
          }
          try {
            const synced = await syncIClosedForSetter(mapping, startDate, endDate);
            allFunnelRows.push(...synced.rows);
            totalRecordsSeen += synced.recordsSeen;
          } catch (err) {
            errors.push(`${mapping.profile_id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        totalRowsWritten = await upsertFunnelMetrics(supabase, groupFunnelRows(allFunnelRows));
      }

      const status = errors.length > 0 ? "partial" : "success";
      await finishRun(supabase, runId, status, totalRecordsSeen, totalRowsWritten, errors, { profile_id: profileId ?? null });
      results.push({ source: selectedSource, records_seen: totalRecordsSeen, rows_written: totalRowsWritten, status, errors });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      await finishRun(supabase, runId, "error", totalRecordsSeen, totalRowsWritten, errors, { profile_id: profileId ?? null });
      results.push({ source: selectedSource, records_seen: totalRecordsSeen, rows_written: totalRowsWritten, status: "error", errors });
    }
  }

  return {
    ok: results.every((r) => r.status !== "error"),
    results,
  };
}
