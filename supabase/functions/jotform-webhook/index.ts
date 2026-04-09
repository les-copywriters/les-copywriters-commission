import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── FIELD MAP ────────────────────────────────────────────────────────────────
const FIELD_MAP = {
  fullName:          "fullName3",
  clientEmail:       "email6",
  product:           "produit",
  amountNow:         "montantFacture",
  totalAmount:       "prixDe",
  paymentPlatform:   "plateformeUtilisee",
  paymentType:       "typeDe42",
  closer:            "typeDe36",
  setter:            "setterLie",
} as const;

// ─── COMMISSION RATES ─────────────────────────────────────────────────────────
const CLOSER_RATE = 0.088;
const SETTER_RATE = 0.01;

// ─── FUZZY NAME MATCHING ──────────────────────────────────────────────────────
/** Lowercase + strip accents */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

type Profile = { id: string; name: string; role: string };

/**
 * Match a name from JotForm against profiles in the DB.
 * Tries (in order): exact → accent-insensitive → first-name only.
 */
function findProfile(name: string, role: string, profiles: Profile[]): Profile | undefined {
  const n = norm(name);
  const exact = profiles.find(p => p.role === role && norm(p.name) === n);
  if (exact) return exact;
  const first = n.split(/\s+/)[0];
  return profiles.find(p => p.role === role && norm(p.name).split(/\s+/)[0] === first);
}

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

    const clientName  = parseName(form);
    const clientEmail = get("clientEmail").toLowerCase();
    const product     = get("product");

    if (!product) {
      return new Response("Missing product", { status: 422 });
    }

    const dateOfSale = new Date().toISOString().split("T")[0];
    const paymentPlatform = get("paymentPlatform") || null;

    const totalAmountRaw = parseFloat(get("totalAmount"));
    const amountNowRaw   = parseFloat(get("amountNow"));
    const amountHT       = !isNaN(totalAmountRaw) && totalAmountRaw > 0
      ? totalAmountRaw
      : !isNaN(amountNowRaw) && amountNowRaw > 0
      ? amountNowRaw
      : NaN;

    if (isNaN(amountHT) || amountHT <= 0) {
      return new Response("Invalid or missing amount", { status: 400 });
    }

    const amountTTC = amountHT;
    const taxAmount = 0;

    const paymentTypeRaw = get("paymentType").toLowerCase();
    const paymentType: "pif" | "installments" =
      paymentTypeRaw.includes("sequra") || paymentTypeRaw.includes("séqura")
        ? "installments"
        : "pif";

    const closerCommission = Math.round(amountHT * CLOSER_RATE * 100) / 100;
    const setterCommission = Math.round(amountHT * SETTER_RATE * 100) / 100;

    const closerName = get("closer");
    const setterName = get("setter");
    const noSetter   = !setterName ||
      norm(setterName) === "aucun" ||
      norm(setterName) === "autre" ||
      setterName === "";

    if (!closerName || norm(closerName) === "autre") {
      return new Response(`Closer name is missing or unrecognised: "${closerName}"`, { status: 422 });
    }

    console.log(`[jotform-webhook] sub ${submissionId} — closer: "${closerName}" setter: "${setterName}"`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load all profiles for fuzzy matching
    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, role");

    if (profilesError) {
      throw new Error(`Profiles lookup failed: ${profilesError.message}`);
    }

    const profiles: Profile[] = allProfiles ?? [];
    console.log("[jotform-webhook] profiles:", profiles.map(p => `${p.name}(${p.role})`).join(", "));

    const closerProfile = findProfile(closerName, "closer", profiles);
    const setterProfile = noSetter ? null : findProfile(setterName, "setter", profiles);

    if (!closerProfile) {
      console.error(`[jotform-webhook] closer not found: "${closerName}"`);
      return new Response(`Closer not found in profiles: "${closerName}"`, { status: 422 });
    }
    if (!noSetter && !setterProfile) {
      console.warn(`[jotform-webhook] setter not matched: "${setterName}" — inserting without setter`);
    }

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

    console.log(`[jotform-webhook] ok — closer: ${closerProfile.name}, setter: ${setterProfile?.name ?? "none"}`);

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
