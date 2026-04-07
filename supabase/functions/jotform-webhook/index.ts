import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── FIELD MAP ────────────────────────────────────────────────────────────────
// Unique names from form https://form.jotform.com/241032303097344
// Verified via JotForm webhook rawRequest inspection on 2025-04-07
const FIELD_MAP = {
  fullName:          "fullName3",          // Full Name → { first, last }
  clientEmail:       "email6",             // E-mail
  product:           "produit",            // Produit (radio)
  amountNow:         "montantFacture",     // Montant facturé maintenant
  totalAmount:       "prixDe",             // Prix de vente total
  paymentPlatform:   "plateformeUtilisee", // Plateforme utilisée (radio)
  paymentType:       "typeDe42",           // Type de paiement (radio)
  closer:            "typeDe36",           // Closé par (radio)
  setter:            "setterLie",          // Setter lié (radio)
} as const;

// ─── COMMISSION RATES ─────────────────────────────────────────────────────────
const CLOSER_RATE = 0.088; // 8.8% of HT
const SETTER_RATE = 0.01;  // 1.0% of HT

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getString(form: Record<string, unknown>, key: string): string {
  const val = form[key];
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") return JSON.stringify(val).trim();
  return String(val).trim();
}

function parseName(form: Record<string, unknown>): string {
  const val = form[FIELD_MAP.fullName];
  if (val && typeof val === "object") {
    const n = val as Record<string, string>;
    return `${n.first ?? ""} ${n.last ?? ""}`.trim();
  }
  return String(val ?? "").trim();
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // JotForm sends application/x-www-form-urlencoded with a rawRequest JSON field
    const body = await req.text();
    const params = new URLSearchParams(body);

    const submissionId = params.get("submissionID") ?? "";
    const rawRequest = params.get("rawRequest");

    if (!rawRequest) {
      return new Response("Missing rawRequest", { status: 400 });
    }

    const form: Record<string, unknown> = JSON.parse(rawRequest);
    const get = (key: keyof typeof FIELD_MAP): string =>
      getString(form, FIELD_MAP[key]);

    // ── Client info ─────────────────────────────────────────────────────────
    const clientName  = parseName(form);
    const clientEmail = get("clientEmail").toLowerCase();
    const product     = get("product");

    if (!product) {
      return new Response("Missing product", { status: 422 });
    }

    // ── Date: form has no date field — use today ─────────────────────────────
    const dateOfSale = new Date().toISOString().split("T")[0];

    // ── Platform ─────────────────────────────────────────────────────────────
    const paymentPlatform = get("paymentPlatform") || null;

    // ── Amount ───────────────────────────────────────────────────────────────
    // Use "Prix de vente total" for commissions; fall back to "Montant facturé maintenant"
    const totalAmountRaw  = parseFloat(get("totalAmount"));
    const amountNowRaw    = parseFloat(get("amountNow"));
    const amountHT        = !isNaN(totalAmountRaw) && totalAmountRaw > 0
      ? totalAmountRaw
      : !isNaN(amountNowRaw) && amountNowRaw > 0
      ? amountNowRaw
      : NaN;

    if (isNaN(amountHT) || amountHT <= 0) {
      return new Response("Invalid or missing amount", { status: 400 });
    }

    // Amounts are treated as HT (ex-tax) — the form does not collect tax info
    const amountTTC  = amountHT;
    const taxAmount  = 0;

    // ── Payment type ─────────────────────────────────────────────────────────
    // SeQura is a BNPL / instalment service
    const paymentTypeRaw = get("paymentType").toLowerCase();
    const paymentType: "pif" | "installments" =
      paymentTypeRaw.includes("sequra") || paymentTypeRaw.includes("séqura")
        ? "installments"
        : "pif";

    // ── Commissions ──────────────────────────────────────────────────────────
    const closerCommission = Math.round(amountHT * CLOSER_RATE * 100) / 100;
    const setterCommission = Math.round(amountHT * SETTER_RATE * 100) / 100;

    // ── Team attribution ─────────────────────────────────────────────────────
    const closerName = get("closer");
    const setterName = get("setter");
    const noSetter   = !setterName ||
      setterName.toLowerCase() === "aucun" ||
      setterName.toLowerCase() === "autre";

    if (!closerName || closerName.toLowerCase() === "autre") {
      return new Response(`Closer name is missing or unrecognised: "${closerName}"`, { status: 422 });
    }

    // ── Supabase client (service role — bypasses RLS) ────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Look up profiles ─────────────────────────────────────────────────────
    const namesToLookup = noSetter ? [closerName] : [closerName, setterName];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("name", namesToLookup);

    if (profilesError) {
      throw new Error(`Profiles lookup failed: ${profilesError.message}`);
    }

    const closerProfile = profiles?.find(p => p.name === closerName && p.role === "closer");
    const setterProfile = noSetter ? null : profiles?.find(p => p.name === setterName && p.role === "setter");

    if (!closerProfile) {
      return new Response(`Closer not found in profiles: "${closerName}"`, { status: 422 });
    }
    if (!noSetter && !setterProfile) {
      return new Response(`Setter not found in profiles: "${setterName}"`, { status: 422 });
    }

    // ── Upsert sale (idempotent on submission ID) ────────────────────────────
    const { error: insertError } = await supabase.from("sales").upsert(
      {
        jotform_submission_id: submissionId || null,
        date:               dateOfSale,
        client_name:        clientName,
        client_email:       clientEmail || null,
        product,
        closer_id:          closerProfile.id,
        setter_id:          setterProfile?.id ?? null,
        amount:             amountHT,
        amount_ttc:         amountTTC,
        tax_amount:         taxAmount,
        closer_commission:  closerCommission,
        setter_commission:  noSetter ? 0 : setterCommission,
        refunded:           false,
        impaye:             false,
        payment_platform:   paymentPlatform,
        payment_type:       paymentType,
        num_installments:   null,
        installment_amount: null,
        first_payment_date: null,
        call_recording_link: null,
        notes:              null,
      },
      { onConflict: "jotform_submission_id" }
    );

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[jotform-webhook]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
