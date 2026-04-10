import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(["closer", "setter", "admin"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    // ── Verify caller is an authenticated admin ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Missing authorization header" }, 401);
    }

    // Use the caller's JWT to look up their profile
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profileError) {
      return json({ ok: false, error: profileError.message }, 403);
    }

    if (callerProfile?.role !== "admin") {
      return json({ ok: false, error: "Admin access required" }, 403);
    }

    // ── Parse and validate request body ─────────────────────────────────────
    const { name, email, password, role } = await req.json() as {
      name: string;
      email: string;
      password: string;
      role: "closer" | "setter" | "admin";
    };

    const normalizedName = name?.trim() ?? "";
    const normalizedEmail = email?.trim().toLowerCase() ?? "";
    const normalizedPassword = password ?? "";

    if (!normalizedName || !normalizedEmail || !normalizedPassword || !role) {
      return json({ ok: false, error: "name, email, password and role are required" }, 400);
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return json({ ok: false, error: "Invalid email" }, 400);
    }
    if (normalizedPassword.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
    }
    if (!VALID_ROLES.has(role)) {
      return json({ ok: false, error: "Invalid role" }, 400);
    }

    // ── Create auth user + profile (service role) ────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedPassword,
      email_confirm: true,
    });

    if (createError) {
      return json({ ok: false, error: createError.message }, 422);
    }

    const { error: insertError } = await adminClient
      .from("profiles")
      .insert({ id: newUser.user.id, name: normalizedName, role });

    if (insertError) {
      // Roll back auth user if profile insert fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return json({ ok: false, error: insertError.message }, 500);
    }

    return json({ ok: true, id: newUser.user.id });

  } catch (err) {
    console.error("[invite-user]", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
