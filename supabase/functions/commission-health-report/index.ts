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
  date: string;
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

type SyncRunRow = {
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_written: number | null;
  records_seen: number | null;
  errors: string[] | null;
};

type CallAnalysisRow = {
  id: string;
  fathom_meeting_id: string | null;
  transcript: string | null;
  status: string;
  created_at: string;
};

type CountRow = { count: number };

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

    const [refundsResult, impayesResult, salesResult, profilesResult, syncRunsResult, callAnalysesResult, callRecordCountResult, funnelMetricCountResult] = await Promise.all([
      adminClient.from("refunds").select("id, date"),
      adminClient.from("impayes").select("id, date"),
      adminClient
        .from("sales")
        .select("id, date, client_name, client_email, amount, closer_id, setter_id, payment_type, num_installments, installment_amount, jotform_submission_id"),
      adminClient.from("profiles").select("id, role"),
      adminClient
        .from("integration_sync_runs")
        .select("source, status, started_at, finished_at, rows_written, records_seen, errors")
        .order("started_at", { ascending: false })
        .limit(30),
      adminClient
        .from("call_analyses")
        .select("id, fathom_meeting_id, transcript, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      adminClient
        .from("setter_call_records")
        .select("*", { count: "exact", head: true }),
      adminClient
        .from("setter_funnel_metrics_daily")
        .select("*", { count: "exact", head: true }),
    ]);

    if (refundsResult.error) return json({ ok: false, error: refundsResult.error.message }, 500);
    if (impayesResult.error) return json({ ok: false, error: impayesResult.error.message }, 500);
    if (salesResult.error) return json({ ok: false, error: salesResult.error.message }, 500);
    if (profilesResult.error) return json({ ok: false, error: profilesResult.error.message }, 500);
    if (syncRunsResult.error) return json({ ok: false, error: syncRunsResult.error.message }, 500);
    if (callAnalysesResult.error) return json({ ok: false, error: callAnalysesResult.error.message }, 500);
    if (callRecordCountResult.error) return json({ ok: false, error: callRecordCountResult.error.message }, 500);
    if (funnelMetricCountResult.error) return json({ ok: false, error: funnelMetricCountResult.error.message }, 500);

    const sales = (salesResult.data ?? []) as SaleRow[];
    const profileRows = profilesResult.data ?? [];
    const callAnalyses = (callAnalysesResult.data ?? []) as CallAnalysisRow[];

    const closerIds = new Set(profileRows.filter((p) => p.role === "closer" || p.role === "admin").map((p) => p.id));
    const profileIds = new Set(profileRows.map((p) => p.id));

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
      if (sale.setter_id && !profileIds.has(sale.setter_id)) discrepancyCounts.setter_profile_mismatch += 1;
      if (sale.payment_type === "installments" && (!sale.num_installments || !sale.installment_amount)) {
        discrepancyCounts.incomplete_installment_fields += 1;
      }
    }

    const monthlyRefunds = (refundsResult.data ?? []).filter((r) => (r.date ?? "").startsWith(monthKey)).length;
    const weeklyImpayes = (impayesResult.data ?? []).filter((i) => (i.date ?? "") >= weekKey).length;
    const totalDiscrepancies = Object.values(discrepancyCounts).reduce((sum, n) => sum + n, 0);
    const latestSyncBySource: Record<string, SyncRunRow> = {};
    for (const run of (syncRunsResult.data ?? []) as SyncRunRow[]) {
      if (!latestSyncBySource[run.source]) latestSyncBySource[run.source] = run;
    }

    const syncHealth = Object.fromEntries(
      ["jotform", "aircall", "iclosed"].map((source) => {
        const run = latestSyncBySource[source];
        const startedAt = run?.started_at ?? null;
        const ageMinutes = startedAt
          ? Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
          : null;
        const freshness = ageMinutes === null
          ? "missing"
          : ageMinutes <= 90
          ? "fresh"
          : ageMinutes <= 360
          ? "aging"
          : "stale";

        return [source, {
          status: run?.status ?? "missing",
          freshness,
          startedAt,
          finishedAt: run?.finished_at ?? null,
          rowsWritten: run?.rows_written ?? 0,
          recordsSeen: run?.records_seen ?? 0,
          ageMinutes,
          errorCount: run?.errors?.length ?? 0,
          lastError: run?.errors?.[0] ?? null,
        }];
      }),
    );

    const submissionIds = sales
      .map((sale) => sale.jotform_submission_id)
      .filter((id): id is string => Boolean(id));
    const uniqueSubmissionIds = new Set(submissionIds);
    const duplicateSubmissionCount = submissionIds.length - uniqueSubmissionIds.size;
    const latestJotformSaleAt = sales
      .map((sale) => sale.date)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

    const fathomImported = callAnalyses.filter((call) => call.fathom_meeting_id).length;
    const fathomWithTranscript = callAnalyses.filter((call) => call.transcript && call.transcript.trim().length > 0).length;
    const fathomPendingTranscript = callAnalyses.filter((call) => call.status === "pending").length;
    const latestFathomImportedAt = callAnalyses[0]?.created_at ?? null;

    const reconciliation = {
      jotform: {
        importedSales: submissionIds.length,
        uniqueSubmissionIds: uniqueSubmissionIds.size,
        duplicateSubmissionCount,
        missingSubmissionIdCount: discrepancyCounts.missing_jotform_submission_id,
        latestImportedSaleDate: latestJotformSaleAt,
      },
      aircall: {
        storedCallRecords: callRecordCountResult.count ?? 0,
        latestRunRecordsSeen: syncHealth.aircall?.recordsSeen ?? 0,
        latestRunRowsWritten: syncHealth.aircall?.rowsWritten ?? 0,
        latestRunStatus: syncHealth.aircall?.status ?? "missing",
      },
      iclosed: {
        storedFunnelMetricRows: funnelMetricCountResult.count ?? 0,
        latestRunRecordsSeen: syncHealth.iclosed?.recordsSeen ?? 0,
        latestRunRowsWritten: syncHealth.iclosed?.rowsWritten ?? 0,
        latestRunStatus: syncHealth.iclosed?.status ?? "missing",
      },
      fathom: {
        importedMeetings: fathomImported,
        meetingsWithTranscript: fathomWithTranscript,
        pendingTranscriptCount: fathomPendingTranscript,
        latestImportedAt: latestFathomImportedAt,
      },
    };

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
        `Platform sync health:`,
        ...Object.entries(syncHealth).map(([source, info]) => `- ${source}: ${info.status} / ${info.freshness}`),
        `Reconciliation snapshot:`,
        `- jotform imported sales: ${reconciliation.jotform.importedSales}`,
        `- aircall stored call records: ${reconciliation.aircall.storedCallRecords}`,
        `- iclosed stored metric rows: ${reconciliation.iclosed.storedFunnelMetricRows}`,
        `- fathom imported meetings: ${reconciliation.fathom.importedMeetings}`,
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
      syncHealth,
      reconciliation,
      slackNotified,
    });
  } catch (error) {
    console.error("[commission-health-report]", error);
    return json({ ok: false, error: String(error) }, 500);
  }
});
