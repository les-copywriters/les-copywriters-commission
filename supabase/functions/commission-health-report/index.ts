import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type SaleRow = {
  id: string;
  client_name: string;
  client_email: string | null;
  amount: number;
  closer_id: string;
  setter_id: string | null;
  payment_type: "pif" | "installments";
  num_installments: number | null;
  installment_amount: number | null;
  jotform_submission_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Missing Supabase environment variables." }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerUserData, error: callerUserError } = await callerClient.auth.getUser();
    if (callerUserError || !callerUserData.user) return json({ ok: false, error: "Unauthorized" }, 401);

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUserData.user.id)
      .single();
    if (callerProfileError || callerProfile?.role !== "admin") {
      return json({ ok: false, error: "Admin access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const notifySlack = Boolean((body as { notifySlack?: boolean }).notifySlack);

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().slice(0, 10);

    const [refundsResult, impayesResult, salesResult, profilesResult] = await Promise.all([
      adminClient.from("refunds").select("id, date"),
      adminClient.from("impayes").select("id, date"),
      adminClient
        .from("sales")
        .select("id, client_name, client_email, amount, closer_id, setter_id, payment_type, num_installments, installment_amount, jotform_submission_id"),
      adminClient.from("profiles").select("id, role"),
    ]);

    if (refundsResult.error) return json({ ok: false, error: refundsResult.error.message }, 500);
    if (impayesResult.error) return json({ ok: false, error: impayesResult.error.message }, 500);
    if (salesResult.error) return json({ ok: false, error: salesResult.error.message }, 500);
    if (profilesResult.error) return json({ ok: false, error: profilesResult.error.message }, 500);

    const sales = (salesResult.data ?? []) as SaleRow[];
    const profileRows = profilesResult.data ?? [];

    const closerIds = new Set(profileRows.filter((p) => p.role === "closer").map((p) => p.id));
    const setterIds = new Set(profileRows.filter((p) => p.role === "setter").map((p) => p.id));

    const discrepancyCounts: Record<string, number> = {
      missing_jotform_submission_id: 0,
      missing_client_email: 0,
      invalid_amount: 0,
      closer_profile_mismatch: 0,
      setter_profile_mismatch: 0,
      incomplete_installment_fields: 0,
    };

    for (const sale of sales) {
      if (!sale.jotform_submission_id) discrepancyCounts.missing_jotform_submission_id += 1;
      if (!sale.client_email) discrepancyCounts.missing_client_email += 1;
      if (sale.amount <= 0) discrepancyCounts.invalid_amount += 1;
      if (!closerIds.has(sale.closer_id)) discrepancyCounts.closer_profile_mismatch += 1;
      if (sale.setter_id && !setterIds.has(sale.setter_id)) discrepancyCounts.setter_profile_mismatch += 1;
      if (sale.payment_type === "installments" && (!sale.num_installments || !sale.installment_amount)) {
        discrepancyCounts.incomplete_installment_fields += 1;
      }
    }

    const monthlyRefunds = (refundsResult.data ?? []).filter((r) => (r.date ?? "").startsWith(monthKey)).length;
    const weeklyImpayes = (impayesResult.data ?? []).filter((i) => (i.date ?? "") >= weekKey).length;
    const totalDiscrepancies = Object.values(discrepancyCounts).reduce((sum, n) => sum + n, 0);

    let slackNotified = false;
    if (notifySlack) {
      const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
      if (!slackWebhook) {
        return json({ ok: false, error: "SLACK_WEBHOOK_URL is not set." }, 500);
      }

      const lines = Object.entries(discrepancyCounts).map(([key, count]) => `- ${key}: ${count}`);
      const message = [
        "*Commission Health Report*",
        `Monthly refunds: ${monthlyRefunds}`,
        `Weekly impayes: ${weeklyImpayes}`,
        `Total discrepancies: ${totalDiscrepancies}`,
        ...lines,
      ].join("\n");

      const slackRes = await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!slackRes.ok) {
        return json({ ok: false, error: `Slack notification failed: ${slackRes.status}` }, 502);
      }
      slackNotified = true;
    }

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      monthlyRefunds,
      weeklyImpayes,
      discrepancyCounts,
      totalDiscrepancies,
      slackNotified,
    });
  } catch (error) {
    console.error("[commission-health-report]", error);
    return json({ ok: false, error: String(error) }, 500);
  }
});
