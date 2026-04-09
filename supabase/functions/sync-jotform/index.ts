import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOTFORM_API_KEY = Deno.env.get("JOTFORM_API_KEY") ?? "";
const JOTFORM_FORM_ID = Deno.env.get("JOTFORM_FORM_ID") ?? "";

const FIELD_MAP = {
  fullName:        "fullName3",
  clientEmail:     "email6",
  product:         "produit",
  amountNow:       "montantFacture",
  totalAmount:     "prixDe",
  paymentPlatform: "plateformeUtilisee",
  paymentType:     "typeDe42",
  closer:          "typeDe36",
  setter:          "setterLie",
} as const;

const CLOSER_RATE = 0.088;
const SETTER_RATE = 0.01;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getAnswer(answers: Record<string, unknown>, fieldName: string): string {
  const entry = Object.values(answers).find(
    (a) => a !== null && typeof a === "object" && (a as Record<string, unknown>).name === fieldName,
  ) as Record<string, unknown> | undefined;
  if (!entry?.answer) return "";
  const ans = entry.answer;
  if (typeof ans === "object" && ans !== null) {
    const n = ans as Record<string, string>;
    if ("first" in n || "last" in n) return `${n.first ?? ""} ${n.last ?? ""}`.trim();
  }
  return String(ans).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  console.log("[sync-jotform] request received, method:", req.method);

  // ── Check secrets are configured ──────────────────────────────────────────
  if (!JOTFORM_API_KEY || !JOTFORM_FORM_ID) {
    console.error("[sync-jotform] missing secrets — JOTFORM_API_KEY or JOTFORM_FORM_ID not set");
    return json({ error: "JOTFORM_API_KEY and JOTFORM_FORM_ID secrets are not set" }, 500);
  }
  console.log("[sync-jotform] secrets OK, form ID:", JOTFORM_FORM_ID);

  // ── Auth header ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[sync-jotform] no Authorization header");
    return json({ error: "Missing Authorization header" }, 401);
  }
  console.log("[sync-jotform] auth header present");

  try {
    // ── Service role client ──────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify JWT ───────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      console.error("[sync-jotform] JWT verification failed:", authError?.message);
      return json({ error: `Unauthorized: ${authError?.message ?? "invalid token"}` }, 401);
    }
    console.log("[sync-jotform] user verified:", user.id);

    // ── Caller profile ────────────────────────────────────────────────────────
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", user.id)
      .single();

    const callerRole = callerProfile?.role ?? "";
    console.log("[sync-jotform] caller role:", callerRole, "name:", callerProfile?.name);

    if (callerRole === "setter") {
      return json({ ok: true, total: 0, imported: 0, errors: [] });
    }

    // ── Load all profiles ─────────────────────────────────────────────────────
    const { data: allProfiles } = await supabase.from("profiles").select("id, name, role");
    const profileMap = new Map(
      (allProfiles ?? []).map((p) => [`${p.name}:${p.role}`, p]),
    );
    console.log("[sync-jotform] loaded", allProfiles?.length, "profiles");

    // ── Existing submission IDs ───────────────────────────────────────────────
    const { data: existingRows } = await supabase
      .from("sales")
      .select("jotform_submission_id")
      .not("jotform_submission_id", "is", null);
    const existingIds = new Set((existingRows ?? []).map((r) => r.jotform_submission_id));
    console.log("[sync-jotform] existing submission IDs in DB:", existingIds.size);

    // ── Fetch from JotForm API ────────────────────────────────────────────────
    const allSubs: Record<string, unknown>[] = [];
    let offset = 0;
    const pageSize = 100;

    while (offset < 1000) {
      const url =
        `https://api.jotform.com/form/${JOTFORM_FORM_ID}/submissions` +
        `?apiKey=${JOTFORM_API_KEY}&limit=${pageSize}&offset=${offset}&orderby=created_at,DESC`;

      console.log("[sync-jotform] fetching page offset:", offset);
      const res = await fetch(url);
      const responseText = await res.text();

      if (!res.ok) {
        console.error("[sync-jotform] JotForm API error:", res.status, responseText.slice(0, 300));
        return json({ error: `JotForm API returned ${res.status}: ${responseText.slice(0, 200)}` }, 500);
      }

      const jfData = JSON.parse(responseText);
      const page: Record<string, unknown>[] = jfData.content ?? [];
      console.log("[sync-jotform] page returned", page.length, "submissions");
      allSubs.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    console.log("[sync-jotform] total submissions from JotForm:", allSubs.length);

    // ── Process each submission ───────────────────────────────────────────────
    let imported = 0;
    const errors: string[] = [];

    for (const sub of allSubs) {
      if (sub.status !== "ACTIVE") continue;

      const subId = String(sub.id ?? "");
      if (!subId || existingIds.has(subId)) continue;

      const answers  = (sub.answers ?? {}) as Record<string, unknown>;
      const get      = (f: keyof typeof FIELD_MAP) => getAnswer(answers, FIELD_MAP[f]);
      const closerName = get("closer");

      if (!closerName || closerName.toLowerCase() === "autre") continue;
      if (callerRole === "closer" && closerName !== callerProfile?.name) continue;

      const product = get("product");
      if (!product) continue;

      const totalRaw = parseFloat(get("totalAmount"));
      const nowRaw   = parseFloat(get("amountNow"));
      const amountHT = !isNaN(totalRaw) && totalRaw > 0 ? totalRaw
                     : !isNaN(nowRaw)   && nowRaw   > 0 ? nowRaw
                     : NaN;
      if (isNaN(amountHT) || amountHT <= 0) continue;

      const ptRaw = get("paymentType").toLowerCase();
      const paymentType: "pif" | "installments" =
        ptRaw.includes("sequra") || ptRaw.includes("séqura") ? "installments" : "pif";

      const closerProfile = profileMap.get(`${closerName}:closer`);
      if (!closerProfile) { errors.push(`Closer not found: "${closerName}"`); continue; }

      const setterName   = get("setter");
      const noSetter     = !setterName ||
        setterName.toLowerCase() === "aucun" ||
        setterName.toLowerCase() === "autre";
      const setterProfile = noSetter ? null : profileMap.get(`${setterName}:setter`);

      const createdAt  = typeof sub.created_at === "string" ? sub.created_at : "";
      const dateOfSale = createdAt
        ? createdAt.split(" ")[0]
        : new Date().toISOString().split("T")[0];

      const { error: insertError } = await supabase.from("sales").insert({
        jotform_submission_id: subId,
        date:               dateOfSale,
        client_name:        get("fullName"),
        client_email:       get("clientEmail").toLowerCase() || null,
        product,
        closer_id:          closerProfile.id,
        setter_id:          setterProfile?.id ?? null,
        amount:             amountHT,
        amount_ttc:         amountHT,
        tax_amount:         0,
        closer_commission:  Math.round(amountHT * CLOSER_RATE * 100) / 100,
        setter_commission:  noSetter ? 0 : Math.round(amountHT * SETTER_RATE * 100) / 100,
        refunded:           false,
        impaye:             false,
        payment_platform:   get("paymentPlatform") || null,
        payment_type:       paymentType,
      });

      if (insertError) {
        errors.push(`Sub ${subId}: ${insertError.message}`);
        console.error("[sync-jotform] insert error for sub", subId, ":", insertError.message);
      } else {
        imported++;
        existingIds.add(subId);
      }
    }

    console.log(`[sync-jotform] done — total: ${allSubs.length}, imported: ${imported}, errors: ${errors.length}`);
    return json({ ok: true, total: allSubs.length, imported, errors });

  } catch (err) {
    console.error("[sync-jotform] uncaught error:", err);
    return json({ error: String(err) }, 500);
  }
});
