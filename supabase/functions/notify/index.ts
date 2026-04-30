/**
 * notify — platform email notification dispatcher
 *
 * Sends transactional emails for three events:
 *   1. refund_approved  — closer whose commission is being clawed back
 *   2. bonus_milestone  — closer who crossed a new tier threshold
 *   3. sync_failure     — admin alert when a sync has failed 3+ consecutive runs
 *
 * Uses Resend (resend.com) — free tier is 3,000 emails/month, more than enough
 * for this platform. Setup:
 *   1. Create a free account at resend.com
 *   2. Get your API key from the dashboard
 *   3. Run: supabase secrets set RESEND_API_KEY=re_xxxx FROM_EMAIL=you@yourdomain.com
 *   4. Deploy: supabase functions deploy notify
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, json } from "../_shared/setterDashboard.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "noreply@lescopwriters.com";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[notify] RESEND_API_KEY not set — email skipped. Set it with: supabase secrets set RESEND_API_KEY=re_xxxx");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
  }

  console.log(`[notify] email sent to ${to} — subject: "${subject}"`);
}

// ─── Email templates ──────────────────────────────────────────────────────────

const base = (content: string) => `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;color:#111">
    ${content}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="color:#9ca3af;font-size:12px;margin:0">Les CopyWriters — Commission Dashboard</p>
  </div>`;

function refundApprovedHtml(closerName: string, clientName: string, amount: string): string {
  return base(`
    <h2 style="margin:0 0 16px;font-size:20px">Commission Update</h2>
    <p style="margin:0 0 12px">Hi ${closerName},</p>
    <p style="margin:0 0 12px">A refund has been approved for <strong>${clientName}</strong>.</p>
    <p style="margin:0 0 24px">The commission of
      <strong style="color:#ef4444">${amount}</strong>
      has been removed from your validated total for this period.
    </p>
    <p style="margin:0;color:#6b7280;font-size:14px">Questions? Contact your admin.</p>`);
}

function bonusMilestoneHtml(closerName: string, tierSales: number, bonusAmount: string): string {
  return base(`
    <h2 style="margin:0 0 16px;font-size:20px">🎉 Bonus Milestone Reached!</h2>
    <p style="margin:0 0 12px">Hi ${closerName},</p>
    <p style="margin:0 0 12px">You've hit <strong>${tierSales} validated sales</strong> this month.</p>
    <p style="margin:0 0 24px">You've unlocked a bonus of
      <strong style="color:#10b981;font-size:18px">${bonusAmount}</strong>.
    </p>
    <p style="margin:0;color:#6b7280;font-size:14px">Check your dashboard for the full breakdown.</p>`);
}

function syncFailureHtml(source: string, consecutiveFails: number, lastError: string): string {
  return base(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#ef4444">⚠️ Sync Failure Alert</h2>
    <p style="margin:0 0 12px">The <strong>${source}</strong> integration has failed
      <strong>${consecutiveFails} consecutive times</strong>.
    </p>
    <p style="margin:0 0 8px"><strong>Last error:</strong></p>
    <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:12px;overflow:auto;margin:0 0 24px">${lastError}</pre>
    <p style="margin:0;color:#6b7280;font-size:14px">
      Go to <strong>Settings → API Keys → Global Integrations</strong> to check credentials and run a manual sync.
    </p>`);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    // Accept cron secret or admin JWT
    const cronSecret   = Deno.env.get("SETTER_DASHBOARD_CRON_SECRET");
    const providedCron = req.headers.get("x-cron-secret");
    const viaCron      = !!(cronSecret && providedCron && providedCron === cronSecret);

    if (!viaCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ ok: false, error: "Missing authorization" }, 401);
      const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error } = await callerClient.auth.getUser();
      if (error || !user) return json({ ok: false, error: "Unauthorized" }, 401);
      const { data: profile } = await callerClient
        .from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") return json({ ok: false, error: "Admin access required" }, 403);
    }

    const body = await req.json() as {
      event: "refund_approved" | "bonus_milestone" | "sync_failure";
      payload: Record<string, unknown>;
    };

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    switch (body.event) {

      case "refund_approved": {
        const { closerId, clientName, commissionAmount } = body.payload as {
          closerId: string; clientName: string; commissionAmount: string;
        };
        const { data: authUser } = await admin.auth.admin.getUserById(closerId);
        const email = authUser.user?.email;
        if (!email) return json({ ok: false, error: "Closer has no email address" }, 400);
        const { data: profile } = await admin.from("profiles").select("name").eq("id", closerId).single();
        await sendEmail(
          email,
          "Commission Update — Refund Approved",
          refundApprovedHtml(profile?.name ?? "there", String(clientName), String(commissionAmount)),
        );
        return json({ ok: true, sent: 1 });
      }

      case "bonus_milestone": {
        const { closerId, tierSales, bonusAmount } = body.payload as {
          closerId: string; tierSales: number; bonusAmount: string;
        };
        const { data: authUser } = await admin.auth.admin.getUserById(closerId);
        const email = authUser.user?.email;
        if (!email) return json({ ok: false, error: "Closer has no email address" }, 400);
        const { data: profile } = await admin.from("profiles").select("name").eq("id", closerId).single();
        await sendEmail(
          email,
          `🎉 Bonus Milestone: ${tierSales} Sales This Month!`,
          bonusMilestoneHtml(profile?.name ?? "there", tierSales, String(bonusAmount)),
        );
        return json({ ok: true, sent: 1 });
      }

      case "sync_failure": {
        const { source, consecutiveFails, lastError } = body.payload as {
          source: string; consecutiveFails: number; lastError: string;
        };
        const { data: admins } = await admin
          .from("profiles").select("id").eq("role", "admin");
        let sent = 0;
        for (const a of admins ?? []) {
          const { data: authUser } = await admin.auth.admin.getUserById(a.id);
          const email = authUser.user?.email;
          if (!email) continue;
          await sendEmail(
            email,
            `⚠️ Sync Failure: ${source} (${consecutiveFails} consecutive fails)`,
            syncFailureHtml(source, consecutiveFails, String(lastError)),
          );
          sent++;
        }
        return json({ ok: true, sent });
      }

      default:
        return json({ ok: false, error: "Unknown event type" }, 400);
    }

  } catch (err) {
    console.error("[notify]", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
