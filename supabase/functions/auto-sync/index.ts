/**
 * auto-sync — unified scheduled sync orchestrator
 *
 * Called by the GitHub Actions cron workflow (or pg_cron) on a schedule.
 * Sequentially syncs all three data sources: JotForm → Aircall → iClosed.
 *
 * Auth: X-Cron-Secret header must match the SETTER_DASHBOARD_CRON_SECRET secret.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runSetterDashboardSync, CORS, json } from "../_shared/setterDashboard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JOTFORM_API_KEY = Deno.env.get("JOTFORM_API_KEY") ?? "";
const JOTFORM_FORM_ID = Deno.env.get("JOTFORM_FORM_ID") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  // Verify cron secret
  const cronSecret = Deno.env.get("SETTER_DASHBOARD_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || !provided || provided !== cronSecret) {
    return json({ ok: false, error: "Invalid or missing cron secret" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = new Date().toISOString();
  const results: Record<string, unknown> = {};

  // ── 1. JotForm sync ────────────────────────────────────────────────────────
  try {
    console.log("[auto-sync] starting JotForm sync");
    const jotformRes = await fetch(`${SUPABASE_URL}/functions/v1/sync-jotform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({}),
    });
    const jotformData = await jotformRes.json();
    results.jotform = {
      ok: jotformRes.ok,
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
    const setterResult = await runSetterDashboardSync({
      supabase,
      source: "all",
      mode: "scheduled",
      triggeredBy: null,
    });
    results.setter = setterResult;
    console.log("[auto-sync] setter sync done:", JSON.stringify(setterResult).slice(0, 200));
  } catch (err) {
    results.setter = { ok: false, error: String(err) };
    console.error("[auto-sync] setter sync error:", err);
  }

  const finishedAt = new Date().toISOString();
  const allOk = Object.values(results).every((r: any) => r.ok !== false);

  return json({ ok: allOk, startedAt, finishedAt, results });
});
