import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function getGlobalSettings(supabase: any): Promise<Record<string, string | null>> {
  const { data, error } = await supabase.from("global_settings").select("key, value");
  const settings: Record<string, string | null> = {
    iclosed_api_key: Deno.env.get("ICLOSED_API_KEY") || null,
    iclosed_api_base_url: Deno.env.get("ICLOSED_API_BASE_URL") || "https://public.api.iclosed.io/v1",
  };

  if (!error && data) {
    for (const s of data) {
      if (s.value) settings[s.key] = s.value;
    }
  }
  return settings;
}

async function safeFetch(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    const errStr = String(err);
    const isDns = errStr.includes("dns error") || errStr.includes("Name or service not known") || errStr.includes("failed to lookup");
    const isTimeout = errStr.includes("abort") || errStr.includes("timed out");
    if (isDns) throw new Error(`Cannot reach "${new URL(url).hostname}" — domain not found in DNS. Check the iClosed API Base URL in Settings → API Keys → Global Integrations.`);
    if (isTimeout) throw new Error(`Request to ${url} timed out.`);
    throw err;
  }
}

// Try to extract unique setter records from an eventCalls response.
// SettedClaim is the object linking a call to a setter in iClosed.
function extractSettersFromEventCalls(payload: Record<string, unknown>): Array<{ id: number; name: string; email: string | null }> {
  const dataWrapper = (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data))
    ? payload.data as Record<string, unknown>
    : payload;

  const items: unknown[] = Array.isArray(dataWrapper.eventCalls)
    ? dataWrapper.eventCalls
    : Array.isArray(payload.eventCalls)
    ? payload.eventCalls
    : Array.isArray(payload.data)
    ? payload.data as unknown[]
    : [];

  const seen = new Map<number, { id: number; name: string; email: string | null }>();

  for (const raw of items) {
    const item = raw as Record<string, unknown>;

    // iClosed attaches setter info under SettedClaim or settedClaim
    const claim = (item.SettedClaim ?? item.settedClaim ?? item.setter ?? item.Setter) as Record<string, unknown> | null | undefined;
    if (!claim) continue;

    // Try various field names for the setter's user ID
    const id = Number(claim.setterId ?? claim.setter_id ?? claim.userId ?? claim.user_id ?? claim.id ?? 0);
    if (!id) continue;

    // Try various field names for name and email
    const firstName = String(claim.firstName ?? claim.first_name ?? claim.name ?? "").trim();
    const lastName = String(claim.lastName ?? claim.last_name ?? "").trim();
    const name = [firstName, lastName].filter(Boolean).join(" ") || `Setter ${id}`;
    const email = String(claim.email ?? claim.Email ?? "").trim() || null;

    if (!seen.has(id)) seen.set(id, { id, name, email });
  }

  return [...seen.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { apiKey?: string; baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const global = await getGlobalSettings(supabase);

  // /v1/users requires admin-level permissions — always prefer the global key.
  const apiKey = global.iclosed_api_key || body.apiKey;
  const baseUrl = body.baseUrl || global.iclosed_api_base_url;

  if (!apiKey) {
    return json({ error: "iClosed API key is missing. Ask your admin to configure the Global iClosed API Key in Settings → API Keys → Global Integrations." }, 400);
  }
  if (!baseUrl) {
    return json({ error: "iClosed API Base URL is not configured. The correct default is https://public.api.iclosed.io/v1" }, 400);
  }

  const base = baseUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${apiKey}` };

  // ── Step 1: try /v1/users ────────────────────────────────────────────────────
  try {
    const r = await safeFetch(`${base}/users?limit=100`, { headers });

    if (r.ok) {
      const parsed = JSON.parse(r.body) as Record<string, unknown>;
      const inner = parsed.data as Record<string, unknown> | undefined;
      const users = Array.isArray(inner?.users)
        ? inner!.users
        : Array.isArray(parsed.users)
        ? parsed.users
        : [];

      if (users.length > 0) {
        return json({
          users: (users as any[]).map((u) => ({
            id: u.id,
            name: `${u.firstName ?? u.first_name ?? ""} ${u.lastName ?? u.last_name ?? ""}`.trim() || u.name || `User ${u.id}`,
            email: u.email ?? null,
          })),
          source: "users",
        });
      }
    }

    // /v1/users returned 403 or empty — fall through to eventCalls strategy
    console.log(`[iclosed-lookup] /v1/users returned ${r.status}, falling back to eventCalls`);
  } catch (err) {
    console.log(`[iclosed-lookup] /v1/users threw: ${err}`);
  }

  // ── Step 2: extract setters from recent eventCalls ───────────────────────────
  try {
    const params = new URLSearchParams({ eventType: "ALL", limit: "100" });
    const r = await safeFetch(`${base}/eventCalls?${params}`, { headers });

    if (!r.ok) {
      if (r.status === 401) {
        return json({ error: "iClosed returned 401 Unauthorized. The API key is invalid or expired. Update it in Settings → API Keys → Global Integrations." }, 401);
      }
      if (r.status === 403) {
        return json({ error: "iClosed returned 403 Forbidden on both /v1/users and /v1/eventCalls. The API key does not have sufficient permissions. Please enter your iClosed User ID manually — you can find it in your iClosed account under Settings → Integrations → API." }, 403);
      }
      return json({ error: `iClosed API returned ${r.status}: ${r.body.slice(0, 300)}` }, 502);
    }

    const parsed = JSON.parse(r.body) as Record<string, unknown>;
    const setters = extractSettersFromEventCalls(parsed);

    if (setters.length > 0) {
      return json({ users: setters, source: "eventCalls" });
    }

    // eventCalls returned data but no SettedClaim setter info — return raw structure hint
    const dataWrapper = (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data))
      ? parsed.data as Record<string, unknown>
      : parsed;
    const items: unknown[] = Array.isArray(dataWrapper.eventCalls)
      ? dataWrapper.eventCalls
      : Array.isArray(parsed.data) ? parsed.data as unknown[] : [];

    const firstItem = items[0] as Record<string, unknown> | undefined;
    const hint = firstItem
      ? `eventCalls returned ${items.length} items but no setter ID could be extracted. First item keys: [${Object.keys(firstItem).join(", ")}]. SettedClaim keys: [${firstItem.SettedClaim ? Object.keys(firstItem.SettedClaim as object).join(", ") : "none"}].`
      : "No event calls found for this account in the default date range.";

    return json({
      users: [],
      hint,
      message: "Could not auto-detect your iClosed User ID. Please enter it manually — find it in iClosed under Settings → Integrations → API, or ask your iClosed account manager.",
    });
  } catch (err) {
    return json({ error: `Failed to contact iClosed API: ${String(err)}` }, 500);
  }
});
