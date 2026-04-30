/**
 * auto-sync — lightweight scheduled sync orchestrator
 *
 * Called by the GitHub Actions cron workflow (or pg_cron) on a schedule.
 * It delegates heavy work to separate Edge Functions instead of doing it
 * inline, which keeps this function under the Edge runtime resource limits.
 *
 * Auth: X-Cron-Secret header must match the SETTER_DASHBOARD_CRON_SECRET secret.
 */
import { CORS, json } from "../_shared/setterDashboard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function invokeCronFunction(name: string, cronSecret: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    parsed = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  // Verify cron secret
  const cronSecret = Deno.env.get("SETTER_DASHBOARD_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || !provided || provided !== cronSecret) {
    return json({ ok: false, error: "Invalid or missing cron secret" }, 401);
  }

  const startedAt = new Date().toISOString();
  const results: Record<string, unknown> = {};

  // ── 1. JotForm sync ────────────────────────────────────────────────────────
  try {
    console.log("[auto-sync] starting JotForm sync");
    const jotformRes = await invokeCronFunction("sync-jotform", cronSecret);
    const jotformData = jotformRes.data;
    results.jotform = {
      ok: jotformRes.ok,
      status: jotformRes.status,
      imported: jotformData.imported ?? 0,
      updated: jotformData.updated ?? 0,
      skipped: jotformData.skipped ?? 0,
      errors: jotformData.errors?.slice(0, 5) ?? [],
    };
    console.log("[auto-sync] JotForm done:", results.jotform);
  } catch (err) {
    results.jotform = { ok: false, error: String(err) };
    console.error("[auto-sync] JotForm error:", err);
  }

  // ── 2. Aircall + iClosed sync (all setters) ───────────────────────────────
  try {
    console.log("[auto-sync] starting Aircall + iClosed sync");
    const setterRes = await invokeCronFunction("schedule-setter-dashboard-sync", cronSecret);
    results.setter = {
      ok: setterRes.ok,
      status: setterRes.status,
      ...(setterRes.data ?? {}),
    };
    console.log("[auto-sync] setter sync done:", JSON.stringify(results.setter).slice(0, 200));
  } catch (err) {
    results.setter = { ok: false, error: String(err) };
    console.error("[auto-sync] setter sync error:", err);
  }

  const finishedAt = new Date().toISOString();
  const allOk = Object.values(results).every((r) => (r as { ok?: boolean }).ok !== false);

  // ── Sync failure alerting ───────────────────────────────────────────────────
  // After each run, check if any source has failed 3+ consecutive times and
  // fire an email alert to all admins via the notify function.
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    for (const source of ["jotform", "aircall", "iclosed"]) {
      const { data: recentRuns } = await sb
        .from("integration_sync_runs")
        .select("status, errors")
        .eq("source", source)
        .order("started_at", { ascending: false })
        .limit(3);

      if (!recentRuns || recentRuns.length < 3) continue;
      const allFailed = recentRuns.every(r => r.status === "error");
      if (!allFailed) continue;

      const lastError = (recentRuns[0]?.errors as string[] | null)?.[0] ?? "Unknown error";
      await invokeCronFunction("notify", cronSecret, {
        event: "sync_failure",
        payload: { source, consecutiveFails: 3, lastError },
      });
      console.log(`[auto-sync] sent sync_failure alert for ${source}`);
    }
  } catch (alertErr) {
    console.warn("[auto-sync] failed to send sync failure alert:", alertErr);
  }

  return json({ ok: allOk, startedAt, finishedAt, results });
});
