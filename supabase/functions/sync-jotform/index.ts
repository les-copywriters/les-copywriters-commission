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

// ─── Fuzzy name matching ───────────────────────────────────────────────────────
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
  // 1. Exact (case + accent insensitive)
  const exact = profiles.find(p => p.role === role && norm(p.name) === n);
  if (exact) return exact;
  // 2. First-name only (handles "Céline Dupont" matching profile "Céline")
  const first = n.split(/\s+/)[0];
  return profiles.find(p => p.role === role && norm(p.name).split(/\s+/)[0] === first);
}

// ─── JotForm answer extractor ─────────────────────────────────────────────────
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

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  console.log("[sync-jotform] request received");

  if (!JOTFORM_API_KEY || !JOTFORM_FORM_ID) {
    console.error("[sync-jotform] missing secrets");
    return json({ error: "JOTFORM_API_KEY and JOTFORM_FORM_ID secrets are not set" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Caller profile
    const { data: callerProfile } = await supabase
      .from("profiles").select("id, name, role").eq("id", user.id).single();
    const callerRole = callerProfile?.role ?? "";
    console.log("[sync-jotform] caller:", callerProfile?.name, callerRole);

    if (callerRole === "setter") return json({ ok: true, total: 0, imported: 0, errors: [] });

    // All profiles for fuzzy lookup
    const { data: allProfiles } = await supabase.from("profiles").select("id, name, role");
    const profiles: Profile[] = allProfiles ?? [];
    console.log("[sync-jotform] profiles loaded:", profiles.map(p => `${p.name}(${p.role})`).join(", "));

    // Existing submission IDs (to skip already-imported, but we'll also check null-setter ones)
    const { data: existingRows } = await supabase
      .from("sales")
      .select("id, jotform_submission_id, setter_id")
      .not("jotform_submission_id", "is", null);

    // Two sets: already fully imported (has setter or legitimately no setter) vs needs setter update
    const existingIds    = new Set<string>();
    const nullSetterIds  = new Map<string, string>(); // submissionId → sale row id

    for (const row of existingRows ?? []) {
      if (row.setter_id !== null) {
        existingIds.add(row.jotform_submission_id);  // complete — skip
      } else {
        nullSetterIds.set(row.jotform_submission_id, row.id); // may need setter filled in
      }
    }

    console.log("[sync-jotform] existing complete:", existingIds.size, "| null-setter to retry:", nullSetterIds.size);

    // Paginate JotForm
    const allSubs: Record<string, unknown>[] = [];
    let offset = 0;
    while (offset < 1000) {
      const url =
        `https://api.jotform.com/form/${JOTFORM_FORM_ID}/submissions` +
        `?apiKey=${JOTFORM_API_KEY}&limit=100&offset=${offset}&orderby=created_at,DESC`;
      const res  = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        console.error("[sync-jotform] JotForm API error:", res.status, text.slice(0, 200));
        return json({ error: `JotForm API ${res.status}: ${text.slice(0, 200)}` }, 500);
      }
      const page: Record<string, unknown>[] = JSON.parse(text).content ?? [];
      allSubs.push(...page);
      if (page.length < 100) break;
      offset += 100;
    }
    console.log("[sync-jotform] fetched from JotForm:", allSubs.length);

    let imported = 0, updated = 0;
    const errors: string[] = [];

    for (const sub of allSubs) {
      if (sub.status !== "ACTIVE") continue;

      const subId   = String(sub.id ?? "");
      if (!subId) continue;

      const isNew         = !existingIds.has(subId) && !nullSetterIds.has(subId);
      const needsUpdate   = nullSetterIds.has(subId);
      if (!isNew && !needsUpdate) continue; // already complete

      const answers    = (sub.answers ?? {}) as Record<string, unknown>;
      const get        = (f: keyof typeof FIELD_MAP) => getAnswer(answers, FIELD_MAP[f]);
      const closerName = get("closer");
      const setterName = get("setter");

      console.log(`[sync-jotform] sub ${subId} — closer: "${closerName}" setter: "${setterName}"`);

      if (!closerName || norm(closerName) === "autre") continue;

      // Scope: closers only process their own submissions
      if (callerRole === "closer" && norm(closerName) !== norm(callerProfile?.name ?? "")) continue;

      const product = get("product");
      if (!product) continue;

      const totalRaw = parseFloat(get("totalAmount"));
      const nowRaw   = parseFloat(get("amountNow"));
      const amountHT = !isNaN(totalRaw) && totalRaw > 0 ? totalRaw
                     : !isNaN(nowRaw)   && nowRaw   > 0 ? nowRaw : NaN;
      if (isNaN(amountHT) || amountHT <= 0) continue;

      const ptRaw = get("paymentType").toLowerCase();
      const paymentType: "pif" | "installments" =
        ptRaw.includes("sequra") || ptRaw.includes("séqura") ? "installments" : "pif";

      const closerProfile = findProfile(closerName, "closer", profiles);
      if (!closerProfile) { errors.push(`Closer not found: "${closerName}"`); continue; }

      const noSetter = !setterName ||
        norm(setterName) === "aucun" || norm(setterName) === "autre" || setterName === "";
      const setterProfile = noSetter ? null : findProfile(setterName, "setter", profiles);

      if (!noSetter && !setterProfile) {
        console.warn(`[sync-jotform] setter not matched: "${setterName}"`);
        errors.push(`Setter not matched: "${setterName}"`);
      }

      const createdAt  = typeof sub.created_at === "string" ? sub.created_at : "";
      const dateOfSale = createdAt ? createdAt.split(" ")[0] : new Date().toISOString().split("T")[0];

      if (needsUpdate && setterProfile) {
        // Fill in the missing setter on an existing record
        const saleRowId = nullSetterIds.get(subId)!;
        const { error: updErr } = await supabase
          .from("sales")
          .update({
            setter_id:          setterProfile.id,
            setter_commission:  Math.round(amountHT * SETTER_RATE * 100) / 100,
          })
          .eq("id", saleRowId);
        if (updErr) {
          errors.push(`Update ${subId}: ${updErr.message}`);
        } else {
          updated++;
          existingIds.add(subId);
        }
        continue;
      }

      if (!isNew) continue;

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
        setter_commission:  setterProfile ? Math.round(amountHT * SETTER_RATE * 100) / 100 : 0,
        refunded:           false,
        impaye:             false,
        payment_platform:   get("paymentPlatform") || null,
        payment_type:       paymentType,
      });

      if (insertError) {
        errors.push(`Insert ${subId}: ${insertError.message}`);
      } else {
        imported++;
        existingIds.add(subId);
      }
    }

    console.log(`[sync-jotform] done — imported: ${imported}, updated: ${updated}, errors: ${errors.length}`);
    return json({ ok: true, total: allSubs.length, imported, updated, errors });

  } catch (err) {
    console.error("[sync-jotform] uncaught:", err);
    return json({ error: String(err) }, 500);
  }
});
