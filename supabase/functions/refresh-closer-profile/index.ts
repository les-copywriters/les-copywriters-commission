import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshCloserProfile } from "../_shared/closerProfile.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "Missing Authorization header" }, 401);

  let body: { closer_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

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

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", callerUserData.user.id)
    .single();

  if (profileError || !callerProfile) return json({ ok: false, error: "Profile not found" }, 404);

  const targetCloserId = callerProfile.role === "admin" && body.closer_id
    ? body.closer_id
    : callerProfile.id;

  if (callerProfile.role !== "admin" && targetCloserId !== callerProfile.id) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  try {
    const profile = await refreshCloserProfile(adminClient, targetCloserId);
    return json({ ok: true, profile });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
});
