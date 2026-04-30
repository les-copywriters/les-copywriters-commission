import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Missing authorization header" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ ok: false, error: "Unauthorized" }, 401);

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "admin") return json({ ok: false, error: "Admin access required" }, 403);

    const { userId } = await req.json() as { userId: string };
    if (!userId) return json({ ok: false, error: "userId is required" }, 400);
    if (userId === caller.id) return json({ ok: false, error: "You cannot remove your own account" }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Delete the auth user so they can no longer log in.
    // The profile row is intentionally kept so historical commission data remains intact.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) return json({ ok: false, error: deleteError.message }, 422);

    return json({ ok: true });
  } catch (err) {
    console.error("[deactivate-user]", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
