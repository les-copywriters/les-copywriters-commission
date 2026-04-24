import { CORS, getAdminClient, json, resolveCaller, runSetterDashboardSync } from "../_shared/setterDashboard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const supabase = getAdminClient();
  const caller = await resolveCaller(req, supabase);
  if (!caller.role || !caller.viaCron) {
    return json({ ok: false, error: "Cron secret required" }, 401);
  }

  let body: { start_date?: string; end_date?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await runSetterDashboardSync({
      supabase,
      source: "all",
      mode: "scheduled",
      startDate: body.start_date,
      endDate: body.end_date,
      triggeredBy: null,
    });
    return json(result, result.ok ? 200 : 207);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
