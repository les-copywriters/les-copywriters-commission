// After any change to _shared/setterDashboard.ts, redeploy this function:
//   supabase functions deploy sync-setter-dashboard
// And apply DB migrations before testing:
//   20260502_iclosed_event_records.sql
//   20260502_setter_performance_rpc.sql
import { CORS, getAdminClient, getGlobalSettings, json, normalizeIClosedBaseUrl, resolveCaller, runSetterDashboardSync } from "../_shared/setterDashboard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const supabase = getAdminClient();
  const caller = await resolveCaller(req, supabase);
  if (!caller.userId) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: {
    source?: string;
    start_date?: string;
    end_date?: string;
    profile_id?: string;
    mode?: "manual" | "scheduled";
    validate_only?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Non-admins can only sync their own profile
  const profileId = caller.role === "admin" ? body.profile_id : caller.userId;

  if (body.validate_only) {
    if (caller.role !== "admin") return json({ ok: false, error: "Only admins can validate global keys" }, 403);
    const global = await getGlobalSettings(supabase);
    const results: Record<string, { ok: boolean; status?: number; error?: string }> = {};

    // Test Aircall
    try {
      const id = global.aircall_api_id;
      const token = global.aircall_api_token;
      if (!id || !token) throw new Error("Missing credentials");
      const res = await fetch("https://api.aircall.io/v1/users", {
        headers: { Authorization: `Basic ${btoa(`${id}:${token}`)}` },
      });
      results.aircall = { ok: res.ok, status: res.status };
    } catch (e) {
      results.aircall = { ok: false, error: e.message };
    }

    // Test iClosed
    try {
      const key = global.iclosed_api_key;
      const rawBase = global.iclosed_api_base_url || "https://public.api.iclosed.io/v1";
      if (!key) throw new Error("iClosed Global API Key not set in database");
      const base = normalizeIClosedBaseUrl(rawBase);
      const res = await fetch(`${base}/users?limit=1`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      results.iclosed = { ok: res.ok, status: res.status };
    } catch (e) {
      results.iclosed = { ok: false, error: e.message };
    }

    // Test Jotform
    try {
      const key = global.jotform_api_key;
      const formId = global.jotform_form_id;
      if (!key || !formId) throw new Error("Missing Jotform credentials in database");
      const res = await fetch(`https://api.jotform.com/form/${formId}?apiKey=${key}`);
      results.jotform = { ok: res.ok, status: res.status };
    } catch (e) {
      results.jotform = { ok: false, error: e.message };
    }

    return json({ ok: true, results });
  }

  try {
    const result = await runSetterDashboardSync({
      supabase,
      source: body.source ?? "all",
      mode: body.mode ?? (caller.viaCron ? "scheduled" : "manual"),
      startDate: body.start_date,
      endDate: body.end_date,
      triggeredBy: caller.userId,
      profileId,
    });
    return json(result, result.ok ? 200 : 207);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
