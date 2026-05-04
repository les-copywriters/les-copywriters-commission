import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://api.fathom.ai/external/v1";
const FATHOM_MAX_RETRIES = 3;
const FATHOM_TIMEOUT_MS = 20000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function fathomGet(path, apiKey, options = {}) {
  const { retries = FATHOM_MAX_RETRIES, tolerate429 = false } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FATHOM_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
      const text = await res.text();
      console.log(`[sync-fathom] ${res.status} ${path} — ${text.slice(0, 300)}`);

      if (res.status === 429) {
        if (tolerate429) {
          throw new Error("FATHOM_RATE_LIMIT_SOFT");
        }

        const retryAfterHeader = Number(res.headers.get("Retry-After") ?? "0");
        const waitMs = Math.max(
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 0,
          5000 * (attempt + 1),
        );

        if (attempt < retries) {
          console.warn(`[sync-fathom] rate limited on ${path} — waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`);
          clearTimeout(timer);
          await sleep(waitMs);
          continue;
        }

        throw new Error("Fathom rate limit reached. Please wait a minute and try syncing again.");
      }

      if (!res.ok) throw new Error(`Fathom ${res.status}: ${text.slice(0, 200)}`);
      return JSON.parse(text);
    } catch (err) {
      if (err?.name === "AbortError") {
        if (attempt < retries) {
          const waitMs = 2000 * (attempt + 1);
          console.warn(`[sync-fathom] timeout on ${path} — waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`);
          await sleep(waitMs);
          continue;
        }
        throw new Error("Fathom request timed out.");
      }

      if (String(err?.message ?? err) === "FATHOM_RATE_LIMIT_SOFT") {
        throw err;
      }

      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Fathom request failed.");
}

async function fetchTranscript(recordingId, apiKey) {
  try {
    const data = await fathomGet(`/recordings/${recordingId}/transcript`, apiKey, { tolerate429: true });
    const segments = Array.isArray(data.transcript) ? data.transcript : [];
    if (!segments.length) return null;
    return segments.map((s) => {
      const name = s.speaker?.display_name ?? "Unknown";
      const ts = s.timestamp ? `[${s.timestamp}] ` : "";
      return `${ts}${name}: ${s.text ?? ""}`;
    }).join("\n");
  } catch (err) {
    if (String(err?.message ?? err) === "FATHOM_RATE_LIMIT_SOFT") {
      console.warn(`[sync-fathom] transcript rate-limited for ${recordingId}; importing call without transcript for now`);
      return null;
    }
    console.warn(`[sync-fathom] transcript failed for ${recordingId}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond({ error: "Missing Authorization header" }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return respond({ error: "Unauthorized" }, 401);

    const { data: caller } = await supabase
      .from("profiles").select("id, role, fathom_api_key").eq("id", user.id).single();
    if (!caller) return respond({ error: "Profile not found" }, 404);

    let body = {};
    try { body = await req.json(); } catch (_) { /* no body is fine */ }

    let closerId = caller.id;
    let apiKey = caller.fathom_api_key;

    if (caller.role === "admin" && body.closer_id) {
      const { data: target } = await supabase
        .from("profiles").select("id, fathom_api_key").eq("id", body.closer_id).single();
      if (!target) return respond({ error: "Closer not found" }, 404);
      closerId = target.id;
      apiKey = target.fathom_api_key;
    } else if (caller.role !== "closer" && caller.role !== "admin") {
      return respond({ error: "Only closers and admins can sync" }, 403);
    }

    if (!apiKey) {
      return respond({ ok: false, error: "No Fathom API key saved. Go to Settings → API Keys." }, 400);
    }

    // Create audit log entry for this sync run
    const viaCron = req.headers.get("x-cron-secret") !== null;
    let runId: string | null = null;
    try {
      const { data: runRow } = await supabase
        .from("integration_sync_runs")
        .insert({
          source: "fathom",
          mode: viaCron ? "scheduled" : "manual",
          status: "running",
          triggered_by: caller.id,
        })
        .select("id").single();
      runId = runRow?.id ? String(runRow.id) : null;
    } catch { /* non-fatal — continue even if logging fails */ }

    // Load existing IDs so we skip already-imported meetings
    const { data: existing } = await supabase
      .from("call_analyses")
      .select("fathom_meeting_id")
      .eq("closer_id", closerId)
      .not("fathom_meeting_id", "is", null);

    const seen = new Set((existing ?? []).map((r) => String(r.fathom_meeting_id)));

    // Load existing session start times for deduplication.
    // Wrapped in try/catch in case the call_started_at column hasn't been
    // added via migration yet — sync still works, just without time-based dedup.
    let seenStartTimes = new Set<string>();
    try {
      const { data: existingTimes } = await supabase
        .from("call_analyses")
        .select("call_started_at")
        .eq("closer_id", closerId)
        .not("call_started_at", "is", null);
      seenStartTimes = new Set(
        (existingTimes ?? []).map((r) => String(r.call_started_at))
      );
    } catch {
      console.warn("[sync-fathom] call_started_at column not yet available — skipping time-based deduplication");
    }

    console.log(`[sync-fathom] ${seen.size} already in DB, ${seenStartTimes.size} unique sessions`);

    let imported = 0;
    let transcriptsFetched = 0;
    const errors = [];
    let cursor = null;
    let page = 0;
    let totalSeen = 0;

    // ── Phase 1: Import all meeting metadata (fast — no transcript calls) ───
    // This completes in seconds regardless of how many meetings exist.
    const newlyImported: Array<{ dbId?: string; fathomId: string }> = [];

    do {
      const path = cursor ? `/meetings?limit=50&cursor=${encodeURIComponent(cursor)}` : "/meetings?limit=50";
      const res = await fathomGet(path, apiKey);
      const meetings = Array.isArray(res.items) ? res.items : [];
      totalSeen += meetings.length;

      for (const m of meetings) {
        const id = String(m.recording_id ?? m.id ?? "");
        if (!id) continue;

        if (seen.has(id)) continue; // already in DB by fathom_meeting_id, skip

        const title     = (m.meeting_title || m.title || null);
        const dateRaw   = m.created_at || m.scheduled_start_time || null;
        const callDate  = dateRaw ? String(dateRaw).split("T")[0] : null;

        // Parse the full start datetime for deduplication and display
        const startedAt = m.scheduled_start_time
          ? new Date(String(m.scheduled_start_time)).toISOString()
          : null;

        // If another recording for this closer at exactly the same start time
        // already exists, this is a duplicate session (notetaker + host, or
        // two participants both running Fathom). Skip silently.
        if (startedAt && seenStartTimes.has(startedAt)) {
          console.log(`[sync-fathom] skipping duplicate session at ${startedAt} (${id})`);
          continue;
        }

        let duration = null;
        if (m.scheduled_start_time && m.scheduled_end_time) {
          const diff = new Date(m.scheduled_end_time).getTime() - new Date(m.scheduled_start_time).getTime();
          if (diff > 0) duration = Math.round(diff / 1000);
        }

        // Insert metadata only — transcript fetched in Phase 2.
        // call_started_at is stored separately so a missing column never
        // blocks the sync (the column may not exist until the migration runs).
        const basePayload = {
          closer_id: closerId,
          fathom_meeting_id: id,
          call_title: title,
          call_date: callDate,
          duration_seconds: duration,
          transcript: null,
          status: "pending",
          updated_at: new Date().toISOString(),
        };

        let { error: insertErr } = await supabase.from("call_analyses").upsert(
          { ...basePayload, call_started_at: startedAt },
          { onConflict: "fathom_meeting_id", ignoreDuplicates: true }
        );

        // If the column doesn't exist yet, retry without it
        if (insertErr?.message?.includes("call_started_at")) {
          console.warn("[sync-fathom] call_started_at column missing — retrying without it");
          ({ error: insertErr } = await supabase.from("call_analyses").upsert(
            basePayload,
            { onConflict: "fathom_meeting_id", ignoreDuplicates: true }
          ));
        }

        if (insertErr) {
          errors.push(`${id}: ${insertErr.message}`);
        } else {
          imported++;
          seen.add(id);
          if (startedAt) seenStartTimes.add(startedAt);
          newlyImported.push({ fathomId: id });
        }
      }

      cursor = res.next_cursor || null;
      page++;
      if (page >= 100) break;
    } while (cursor);

    console.log(`[sync-fathom] phase 1 done — metadata imported: ${imported}, total seen: ${totalSeen}`);

    // ── Phase 2: Fetch transcripts within a strict time budget ──────────────
    // Fetches transcripts for all pending calls for this closer (newest first).
    // Stops when the time budget is exhausted so the function never times out.
    // Each subsequent sync picks up where the last left off.
    const TIME_BUDGET_MS = 90_000; // 90 s — well within Supabase's 150 s limit
    const phaseStart = Date.now();

    const { data: pendingCalls } = await supabase
      .from("call_analyses")
      .select("id, fathom_meeting_id")
      .eq("closer_id", closerId)
      .eq("status", "pending")
      .not("fathom_meeting_id", "is", null)
      .order("call_date", { ascending: false })
      .limit(200);

    let processedInPhase2 = 0;
    for (const call of pendingCalls ?? []) {
      if (Date.now() - phaseStart > TIME_BUDGET_MS) {
        console.log("[sync-fathom] time budget reached — remaining transcripts will be fetched on next invocation");
        break;
      }

      const transcript = await fetchTranscript(String(call.fathom_meeting_id), apiKey);
      if (transcript) {
        await supabase.from("call_analyses").update({
          transcript,
          status: "synced",
          updated_at: new Date().toISOString(),
        }).eq("id", call.id);
        transcriptsFetched++;
      }

      processedInPhase2++;
      await sleep(300); // stay under Fathom rate limits
    }

    // Count how many pending transcripts are still left so the caller knows
    // whether to invoke again.
    const { count: remainingPending } = await supabase
      .from("call_analyses")
      .select("id", { count: "exact", head: true })
      .eq("closer_id", closerId)
      .eq("status", "pending")
      .not("fathom_meeting_id", "is", null);

    console.log(`[sync-fathom] phase 2 done — transcripts fetched: ${transcriptsFetched}, remaining pending: ${remainingPending ?? 0}`);

    // Finish audit log entry
    if (runId) {
      try {
        await supabase.from("integration_sync_runs").update({
          status: errors.length > 0 ? "partial" : "success",
          records_seen: totalSeen,
          rows_written: imported + transcriptsFetched,
          errors: errors.length > 0 ? errors.slice(0, 5) : null,
          finished_at: new Date().toISOString(),
        }).eq("id", runId);
      } catch { /* non-fatal */ }
    }

    return respond({ ok: true, imported, transcripts_fetched: transcriptsFetched, total_seen: totalSeen, remaining_pending: remainingPending ?? 0, errors });

  } catch (err) {
    console.error("[sync-fathom] error:", err);
    return respond({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
  // runId is block-scoped above — error path handled inline
});
