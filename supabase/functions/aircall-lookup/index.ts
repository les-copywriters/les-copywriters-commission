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
    aircall_api_id: Deno.env.get("AIRCALL_API_ID") || null,
    aircall_api_token: Deno.env.get("AIRCALL_API_TOKEN") || null,
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const global = await getGlobalSettings(supabase);
  const apiId = global.aircall_api_id;
  const apiToken = global.aircall_api_token;

  if (!apiId || !apiToken) {
    return json({ error: "Aircall API credentials not configured. Set them in Settings → Global Integrations." }, 400);
  }

  const auth = btoa(`${apiId}:${apiToken}`);

  try {
    const res = await fetch("https://api.aircall.io/v1/users?per_page=100", {
      headers: { Authorization: `Basic ${auth}` },
    });
    const text = await res.text();
    if (!res.ok) return json({ error: `Aircall API error: ${res.status} ${text.slice(0, 200)}` }, 502);

    const parsed = JSON.parse(text) as Record<string, unknown>;
    const users = Array.isArray(parsed.users) ? parsed.users : [];

    return json({
      users: users.map((u: any) => ({
        id: u.id,
        name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.name || `User ${u.id}`,
        email: u.email ?? null,
      })),
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
