/**
 * invite-user — creates a new team member and sends them an invitation email.
 *
 * The user receives an email with a secure link. Clicking it takes them to
 * /password-reset where they set their own password. No temporary password
 * is ever generated or communicated by the admin.
 *
 * Requires SITE_URL secret so the invite email redirects to the correct domain:
 *   supabase secrets set SITE_URL=https://your-app.vercel.app
 *
 * Also add https://your-app.vercel.app/password-reset to Supabase Auth →
 * URL Configuration → Redirect URLs.
 */
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    // ── Verify caller is an authenticated admin ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Missing required environment variables" }, 500);
    }

    const callerClient = createClient(
      supabaseUrl,
      anonKey,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ ok: false, error: "Unauthorized" }, 401);

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profileError) return json({ ok: false, error: profileError.message }, 403);
    if (callerProfile?.role !== "admin") return json({ ok: false, error: "Admin access required" }, 403);

    // ── Parse and validate request body ─────────────────────────────────────
    const { name, email, role } = await req.json() as {
      name: string;
      email: string;
      role: "closer" | "setter" | "admin";
    };

    const normalizedName  = name?.trim() ?? "";
    const normalizedEmail = email?.trim().toLowerCase() ?? "";

    if (!normalizedName)                       return json({ ok: false, error: "Name is required" }, 400);
    if (!EMAIL_REGEX.test(normalizedEmail))    return json({ ok: false, error: "Invalid email address" }, 400);
    if (!role || !VALID_ROLES.has(role))       return json({ ok: false, error: "Invalid role" }, 400);

    const adminClient = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── Send invitation email with a secure set-password link ───────────────
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8080";
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo: `${siteUrl}/password-reset` },
    );

    if (inviteError) return json({ ok: false, error: inviteError.message }, 422);

    // ── Create the profile row so the role is available immediately ─────────
    const { error: insertError } = await adminClient
      .from("profiles")
      .insert({ id: inviteData.user.id, name: normalizedName, role });

    if (insertError) {
      // Roll back the auth user so the invite can be retried cleanly
      await adminClient.auth.admin.deleteUser(inviteData.user.id);
      return json({ ok: false, error: insertError.message }, 500);
    }

    return json({ ok: true, id: inviteData.user.id });

  } catch (err) {
    console.error("[invite-user]", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
