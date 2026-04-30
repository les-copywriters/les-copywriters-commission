/**
 * bulk-analyze — runs AI analysis on all "synced" calls for a closer.
 *
 * Calls the existing analyze-call function for each call within a time budget
 * so it never exceeds Supabase's edge function timeout. Each invocation
 * processes as many calls as possible; the user can click again to continue
 * until all calls are analyzed.
 *
 * Body: { closer_id?: string }   (closer_id required for admin, ignored for closers)
 * Returns: { ok, analyzed, remaining, errors }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, json } from "../_shared/setterDashboard.ts";

const TIME_BUDGET_MS = 110_000; // 110 s — well within Supabase's 150 s limit
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "Missing Authorization header" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await adminClient
      .from("profiles").select("id, role").eq("id", user.id).single();
    if (!callerProfile) return json({ ok: false, error: "Profile not found" }, 404);

    // Determine which closer to analyze
    let body: { closer_id?: string } = {};
    try { body = await req.json(); } catch { /* no body */ }

    let closerId = callerProfile.id;
    if (callerProfile.role === "admin") {
      if (!body.closer_id) return json({ ok: false, error: "Admin must provide closer_id" }, 400);
      closerId = body.closer_id;
    } else if (callerProfile.role !== "closer") {
      return json({ ok: false, error: "Only closers and admins can bulk analyze" }, 403);
    }

    // Fetch all calls that are ready to analyze (have transcript, not yet done)
    const { data: readyCalls, error: fetchError } = await adminClient
      .from("call_analyses")
      .select("id")
      .eq("closer_id", closerId)
      .eq("status", "synced")
      .not("transcript", "is", null)
      .order("call_date", { ascending: false });

    if (fetchError) return json({ ok: false, error: fetchError.message }, 500);
    if (!readyCalls?.length) return json({ ok: true, analyzed: 0, remaining: 0, errors: [] });

    console.log(`[bulk-analyze] ${readyCalls.length} calls ready for ${closerId}`);

    const startMs  = Date.now();
    let analyzed   = 0;
    const errors: string[] = [];

    for (const call of readyCalls) {
      // Stop before timeout — remaining calls will be handled on the next invocation
      if (Date.now() - startMs > TIME_BUDGET_MS) {
        console.log(`[bulk-analyze] time budget reached — ${readyCalls.length - analyzed} calls remain`);
        break;
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({ call_id: call.id }),
        });

        if (res.ok) {
          analyzed++;
          console.log(`[bulk-analyze] analyzed ${call.id} (${analyzed}/${readyCalls.length})`);
        } else {
          const text = await res.text().catch(() => res.statusText);
          errors.push(`${call.id}: ${text.slice(0, 120)}`);
        }
      } catch (err) {
        errors.push(`${call.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const remaining = Math.max(0, readyCalls.length - analyzed);
    console.log(`[bulk-analyze] done — analyzed: ${analyzed}, remaining: ${remaining}, errors: ${errors.length}`);

    return json({ ok: true, analyzed, remaining, errors });

  } catch (err) {
    console.error("[bulk-analyze]", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
