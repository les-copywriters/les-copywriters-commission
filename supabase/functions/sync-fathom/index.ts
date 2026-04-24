// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://api.fathom.ai/external/v1";

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function fathomGet(path, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    console.log(`[sync-fathom] ${res.status} ${path} — ${text.slice(0, 300)}`);
    if (!res.ok) throw new Error(`Fathom ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTranscript(recordingId, apiKey) {
  try {
    const data = await fathomGet(`/recordings/${recordingId}/transcript`, apiKey);
    const segments = Array.isArray(data.transcript) ? data.transcript : [];
    if (!segments.length) return null;
    return segments.map((s) => {
      const name = s.speaker?.display_name ?? "Unknown";
      const ts = s.timestamp ? `[${s.timestamp}] ` : "";
      return `${ts}${name}: ${s.text ?? ""}`;
    }).join("\n");
  } catch (err) {
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

    // Load existing IDs so we skip already-imported meetings
    const { data: existing } = await supabase
      .from("call_analyses")
      .select("fathom_meeting_id")
      .eq("closer_id", closerId)
      .not("fathom_meeting_id", "is", null);

    const seen = new Set((existing ?? []).map((r) => String(r.fathom_meeting_id)));
    console.log(`[sync-fathom] ${seen.size} already in DB`);

    let imported = 0;
    const errors = [];
    let cursor = null;
    let page = 0;
    let totalSeen = 0;

    outer: do {
      const path = cursor ? `/meetings?limit=50&cursor=${encodeURIComponent(cursor)}` : "/meetings?limit=50";
      const res = await fathomGet(path, apiKey);
      const meetings = Array.isArray(res.items) ? res.items : [];
      totalSeen += meetings.length;

      for (const m of meetings) {
        const id = String(m.recording_id ?? m.id ?? "");
        if (!id) continue;

        // Fathom returns newest-first: first known ID → everything after is already imported
        if (seen.has(id)) {
          console.log(`[sync-fathom] reached known meeting ${id} — stopping`);
          break outer;
        }

        const title = (m.meeting_title || m.title || null);
        const dateRaw = m.created_at || m.scheduled_start_time || null;
        const callDate = dateRaw ? String(dateRaw).split("T")[0] : null;

        let duration = null;
        if (m.scheduled_start_time && m.scheduled_end_time) {
          const diff = new Date(m.scheduled_end_time) - new Date(m.scheduled_start_time);
          if (diff > 0) duration = Math.round(diff / 1000);
        }

        const transcript = await fetchTranscript(id, apiKey);

        const { error: insertErr } = await supabase.from("call_analyses").insert({
          closer_id: closerId,
          fathom_meeting_id: id,
          call_title: title,
          call_date: callDate,
          duration_seconds: duration,
          transcript,
          status: transcript ? "synced" : "pending",
          updated_at: new Date().toISOString(),
        });

        if (insertErr) {
          errors.push(`${id}: ${insertErr.message}`);
        } else {
          imported++;
          seen.add(id);
        }
      }

      cursor = res.next_cursor || null;
      page++;
      if (page >= 20) break;
    } while (cursor);

    console.log(`[sync-fathom] done — seen=${totalSeen} imported=${imported}`);
    return respond({ ok: true, imported, total_seen: totalSeen, errors });

  } catch (err) {
    console.error("[sync-fathom] error:", err);
    return respond({ ok: false, error: String(err) }, 500);
  }
});
