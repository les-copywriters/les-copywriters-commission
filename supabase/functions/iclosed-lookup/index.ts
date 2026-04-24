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
    iclosed_api_base_url: Deno.env.get("ICLOSED_API_BASE_URL") || "https://api.iclosed.io/v1",
  };
  
  if (!error && data) {
    for (const s of data) {
      if (s.value) settings[s.key] = s.value;
    }
  }
  return settings;
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
  const apiKey = body.apiKey || global.iclosed_api_key;
  const baseUrl = body.baseUrl || global.iclosed_api_base_url;

  if (!apiKey || !baseUrl) return json({ error: "iClosed API key not configured (Global or Profile)" }, 400);

  const base = baseUrl.replace(/\/$/, "");

  try {
    const res = await fetch(`${base}/users?limit=100`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    if (!res.ok) return json({ error: `iClosed API error: ${res.status} ${text.slice(0, 200)}` }, 502);

    const parsed = JSON.parse(text) as Record<string, unknown>;

    // iClosed wraps users in { data: { users: [...] } }
    const inner = parsed.data as Record<string, unknown> | undefined;
    const users = Array.isArray(inner?.users)
      ? inner!.users
      : Array.isArray(parsed.users)
      ? parsed.users
      : [];

    return json({ users });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
