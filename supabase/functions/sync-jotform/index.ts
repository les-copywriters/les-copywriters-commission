import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRun, finishRun, normalizeDate, getGlobalSettings } from "../_shared/setterDashboard.ts";


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

const PRODUCT_FIELD_ALIASES = ["produit", "product", "offer", "offre", "programme", "program", "formation", "service"] as const;
const PRODUCT_TEXT_ALIASES = ["produit", "product", "offer", "offre", "programme", "formation"] as const;

const CLOSER_RATE = 0.088;
const SETTER_RATE = 0.01;
const LEGACY_NAMES = new Set(["johanna", "pablo", "axel", "tommy", "pierre", "allessya", "leslie"].map(n => n.toLowerCase()));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOTFORM_PAGE_SIZE = 100;
const JOTFORM_MAX_PAGES = 100;
const JOTFORM_FETCH_TIMEOUT_MS = 15000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function fetchJotformPage(offset: number, apiKey: string, formId: string): Promise<Record<string, unknown>[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JOTFORM_FETCH_TIMEOUT_MS);

  try {
    const url =
      `https://api.jotform.com/form/${formId}/submissions` +
      `?apiKey=${apiKey}&limit=${JOTFORM_PAGE_SIZE}&offset=${offset}&orderby=created_at,DESC`;

    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();

    if (!res.ok) {
      console.error("[sync-jotform] JotForm API error:", res.status, text.slice(0, 200));
      throw new Error(`JotForm API ${res.status}: ${text.slice(0, 200)}`);
    }

    let parsed: { content?: unknown };
    try {
      parsed = JSON.parse(text) as { content?: unknown };
    } catch {
      throw new Error("JotForm returned invalid JSON.");
    }

    if (!Array.isArray(parsed.content)) {
      throw new Error("JotForm response missing content array.");
    }

    return parsed.content as Record<string, unknown>[];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("JotForm request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Fuzzy name matching ───────────────────────────────────────────────────────
/** Lowercase + strip accents */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

type Profile = { id: string; name: string; role: string };

function parseAliasMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
        .map(([key, value]) => [norm(key), value.trim()]),
    );
  } catch (error) {
    console.warn("[sync-jotform] invalid alias map JSON:", error);
    return {};
  }
}

const CLOSER_ALIASES = parseAliasMap(Deno.env.get("JOTFORM_CLOSER_ALIASES"));
const SETTER_ALIASES = parseAliasMap(Deno.env.get("JOTFORM_SETTER_ALIASES"));

function resolveAlias(name: string, aliases: Record<string, string>) {
  const normalized = norm(name);
  return aliases[normalized] ?? name.trim();
}

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
  const firstMatch = profiles.find(p => p.role === role && norm(p.name).split(/\s+/)[0] === first);
  if (firstMatch) return firstMatch;
  const compact = n.replace(/[^a-z0-9]/g, "");
  const partialMatches = profiles.filter((p) => {
    if (p.role !== role) return false;
    const candidate = norm(p.name).replace(/[^a-z0-9]/g, "");
    return candidate.includes(compact) || compact.includes(candidate);
  });
  return partialMatches.length === 1 ? partialMatches[0] : undefined;
}

function findProfileAnyRole(name: string, profiles: Profile[]): Profile | undefined {
  const n = norm(name);
  const exact = profiles.find(p => norm(p.name) === n);
  if (exact) return exact;
  const first = n.split(/\s+/)[0];
  return profiles.find(p => norm(p.name).split(/\s+/)[0] === first);
}

// ─── JotForm answer extractor ─────────────────────────────────────────────────
function getAnswer(answers: Record<string, unknown>, fieldName: string): string {
  const entry = Object.values(answers).find(
    (a) => a !== null && typeof a === "object" && (a as Record<string, unknown>).name === fieldName,
  ) as Record<string, any> | undefined;

  if (!entry?.answer) return "";
  const ans = entry.answer;

  if (typeof ans === "string") return ans.trim();
  if (Array.isArray(ans)) return String(ans[0] || "").trim();
  if (typeof ans === "object" && ans !== null) {
    // Handle { first: "...", last: "..." } or generic { 0: "...", 1: "..." }
    return Object.values(ans)
      .filter(v => typeof v === "string")
      .join(" ")
      .trim();
  }
  return String(ans).trim();
}

function getAnswerByAliases(
  answers: Record<string, unknown>,
  names: readonly string[],
  texts: readonly string[] = [],
): string {
  const normalizedNames = new Set(names.map(norm));
  const normalizedTexts = new Set(texts.map(norm));

  for (const raw of Object.values(answers)) {
    if (raw === null || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    
    const name = typeof entry.name === "string" ? norm(entry.name) : "";
    const text = typeof entry.text === "string" ? norm(entry.text) : "";
    
    // Check if the internal name OR the display text matches our aliases
    const isMatch = (name && normalizedNames.has(name)) || 
                    (text && Array.from(normalizedTexts).some(t => text.includes(t)));
    
    if (!isMatch) continue;

    const value = getAnswer(answers, String(entry.name ?? ""));
    if (value) return value;
  }

  return "";
}

function getProductValue(answers: Record<string, unknown>) {
  return getAnswer(answers, FIELD_MAP.product) || getAnswerByAliases(answers, PRODUCT_FIELD_ALIASES, PRODUCT_TEXT_ALIASES);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  console.log("[sync-jotform] request received");

  if (!JOTFORM_API_KEY || !JOTFORM_FORM_ID) {
    console.error("[sync-jotform] missing secrets");
    return json({ error: "JOTFORM_API_KEY and JOTFORM_FORM_ID secrets are not set" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Allow cron calls via shared secret (no JWT required)
  const cronSecret = Deno.env.get("SETTER_DASHBOARD_CRON_SECRET");
  const providedCronSecret = req.headers.get("x-cron-secret");
  const viaCron = !!(cronSecret && providedCronSecret && providedCronSecret === cronSecret);
  let callerProfile: Profile | null = null;
  let callerRole = "";

  if (!viaCron) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles").select("id, name, role").eq("id", user.id).single();
    callerProfile = profile ?? null;
    callerRole = callerProfile?.role ?? "";
    if (callerRole !== "admin" && callerRole !== "closer" && callerRole !== "setter") {
      return json({ ok: false, error: "Only admins, closers and setters can sync" }, 403);
    }
    console.log("[sync-jotform] caller:", callerProfile?.name, callerRole);
  } else {
    console.log("[sync-jotform] cron trigger");
  }

  const mode = viaCron ? "scheduled" : "manual";
  let runId: string | null = null;
  
  let imported = 0, updated = 0, skipped = 0, nonActive = 0;
  let totalSeen = 0;
  const errors: string[] = [];

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from environment");
    }

    // Initialize run record
    try {
      runId = await createRun(supabase, "jotform", mode, viaCron ? null : (callerProfile?.id ?? null));
    } catch (e) {
      console.warn("[sync-jotform] failed to create run record:", e.message);
      // We continue even if tracking fails, but we won't be able to finish the run.
    }

    // Load global settings to get the latest Jotform API key/form ID
    const global = await getGlobalSettings(supabase);
    const finalApiKey = global.jotform_api_key || JOTFORM_API_KEY;
    const finalFormId = global.jotform_form_id || JOTFORM_FORM_ID;

    if (!finalApiKey || !finalFormId) {
      console.error("[sync-jotform] missing credentials (check Global Settings)");
      await finishRun(supabase, runId, "error", 0, 0, ["JOTFORM_API_KEY and JOTFORM_FORM_ID are not set in database or environment"]);
      return json({ error: "Jotform credentials are not set" }, 500);
    }

    // All profiles for fuzzy lookup
    const { data: allProfiles, error: profilesError } = await supabase.from("profiles").select("id, name, role");
    if (profilesError) {
      return json({ ok: false, error: `Profiles lookup failed: ${profilesError.message}` }, 500);
    }
    const profiles: Profile[] = allProfiles ?? [];
    console.log("[sync-jotform] profiles loaded:", profiles.map(p => `${p.name}(${p.role})`).join(", "));

    // Existing submission IDs (to skip already-imported, but we'll also check null-setter ones)
    const { data: existingRows, error: existingRowsError } = await supabase
      .from("sales")
      .select("id, jotform_submission_id, setter_id")
      .not("jotform_submission_id", "is", null);
    if (existingRowsError) {
      return json({ ok: false, error: `Sales preload failed: ${existingRowsError.message}` }, 500);
    }

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
    let pageCount = 0;
    while (true) {
      const page = await fetchJotformPage(offset, finalApiKey, finalFormId);
      allSubs.push(...page);
      if (page.length < JOTFORM_PAGE_SIZE) break;
      offset += JOTFORM_PAGE_SIZE;
      pageCount += 1;
      if (pageCount > JOTFORM_MAX_PAGES) {
        return json({ ok: false, error: "JotForm pagination safety limit reached" }, 500);
      }
    }
    console.log("[sync-jotform] fetched from JotForm:", allSubs.length);
    totalSeen = allSubs.length;

    const unmatchedClosers = new Set<string>();
    const unmatchedSetters = new Set<string>();

    for (const sub of allSubs) {
      if (sub.status !== "ACTIVE") { nonActive++; continue; }

      const subId   = String(sub.id ?? "");
      if (!subId) continue;

      // FORCE REFRESH: We process everything to ensure names/products are updated

      const answers    = (sub.answers ?? {}) as Record<string, unknown>;
      const get        = (f: keyof typeof FIELD_MAP) => getAnswer(answers, FIELD_MAP[f]);
      const closerName = resolveAlias(get("closer") || getAnswerByAliases(answers, ["closer", "vendeur"], ["closer", "vendeur", "vendu par"]), CLOSER_ALIASES);
      const setterName = resolveAlias(get("setter") || getAnswerByAliases(answers, ["setter", "pris par"], ["setter", "pris par", "rendez-vous"]), SETTER_ALIASES);
      const product    = getProductValue(answers);

      // SILENT SKIP: If everything is missing, it's likely a test or abandoned submission
      if (!closerName && !setterName && !product) {
        nonActive++;
        continue;
      }

      console.log(`[sync-jotform] sub ${subId} — closer: "${closerName}" setter: "${setterName}" product: "${product}"`);

      if (!closerName || norm(closerName) === "autre") {
        skipped++;
        const foundLabels = Object.values(answers).map((a: any) => `${a?.name}: "${a?.text}"`).filter(Boolean).join(" | ");
        errors.push(`Submission ${subId}: missing closer. Labels: [${foundLabels}]`);
        continue;
      }

      if (callerRole === "closer" && norm(closerName) !== norm(callerProfile?.name ?? "")) continue;

      if (!product) {
        skipped++;
        const foundLabels = Object.values(answers).map((a: any) => `${a?.name}: "${a?.text}"`).filter(Boolean).join(" | ");
        errors.push(`Submission ${subId}: missing product. Labels: [${foundLabels}]`);
        continue;
      }

      const totalRaw = parseFloat(get("totalAmount"));
      const nowRaw   = parseFloat(get("amountNow"));
      const amountHT = !isNaN(totalRaw) && totalRaw > 0 ? totalRaw
                     : !isNaN(nowRaw)   && nowRaw   > 0 ? nowRaw : NaN;
      if (isNaN(amountHT) || amountHT <= 0) {
        skipped++;
        errors.push(`Submission ${subId}: invalid amount`);
        continue;
      }

      const ptRaw = get("paymentType").toLowerCase();
      const paymentType: "pif" | "installments" =
        ptRaw.includes("sequra") || ptRaw.includes("séqura") ? "installments" : "pif";

      // 1. Resolve Closer
      const closerProfile = findProfileAnyRole(closerName, profiles);
      if (!closerProfile) {
        if (LEGACY_NAMES.has(norm(closerName))) {
          nonActive++; // Treat as non-active/skipped quietly
          continue;
        }
        skipped++;
        errors.push(`Submission ${subId}: Closer "${closerName}" not found in team or legacy list`);
        unmatchedClosers.add(closerName);
        continue;
      }

      const noSetter = !setterName ||
        norm(setterName) === "aucun" || 
        norm(setterName) === "autre" || 
        norm(setterName) === "je trouve pas" || 
        norm(setterName) === "je sais pas" ||
        setterName === "";
      const matchedSetter = noSetter ? null : findProfile(setterName, "setter", profiles);
      const fallbackSetter = noSetter || matchedSetter ? null : findProfileAnyRole(setterName, profiles);
      const setterProfile = matchedSetter ?? fallbackSetter;

      if (fallbackSetter) {
        console.log(`[sync-jotform] setter matched via role fallback: "${setterName}" -> ${fallbackSetter.name}(${fallbackSetter.role})`);
      }

      if (!noSetter && !setterProfile) {
        if (LEGACY_NAMES.has(norm(setterName))) {
          // Ignore quietly
        } else {
          console.warn(`[sync-jotform] setter not matched: "${setterName}"`);
          unmatchedSetters.add(setterName);
        }
      }

      const createdAt  = typeof sub.created_at === "string" ? sub.created_at : "";
      const dateOfSale = createdAt ? createdAt.split(" ")[0] : new Date().toISOString().split("T")[0];

      // Process and upsert every valid submission

      const { error: insertError } = await supabase.from("sales").upsert({
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
      }, { onConflict: "jotform_submission_id" });

      if (insertError) {
        errors.push(`Insert ${subId}: ${insertError.message}`);
      } else {
        imported++;
        existingIds.add(subId);
      }
    }

    // Append deduplicated missing-name errors once instead of once per submission
    for (const name of unmatchedClosers) {
      errors.push(`Closer "${name}" not found — add them in Admin → Team Manage`);
    }
    for (const name of unmatchedSetters) {
      errors.push(`Setter "${name}" not found — add them in Admin → Team Manage`);
    }

    console.log(`[sync-jotform] done — imported: ${imported}, updated: ${updated}, skipped: ${skipped}, nonActive: ${nonActive}, errors: ${errors.length}`);
    
    if (runId) {
      const finalStatus = errors.length > 0 ? "partial" : "success";
      await finishRun(supabase, runId, finalStatus, totalSeen, imported + updated, errors, {
        skipped,
        nonActive,
        updated_count: updated,
        imported_count: imported
      });
    }

    return json({ ok: true, total: allSubs.length, imported, updated, skipped, nonActive, errors });

  } catch (err) {
    console.error("[sync-jotform] uncaught:", err);
    const message = String(err);
    if (runId) {
      await finishRun(supabase, runId, "error", totalSeen, imported + updated, [message]);
    }
    return json({ ok: false, error: message }, 500);
  }
});
