/**
 * Seed script — creates auth users + profiles for all team members.
 *
 * Usage (pass service role key inline so it never touches .env):
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-users.ts
 *
 * SUPABASE_URL is read from .env (already there from the app).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── TEAM ─────────────────────────────────────────────────────────────────────
// email        : used to log in
// password     : initial password — share with each person, ask them to change it
// name         : must match JotForm option text EXACTLY (including accents)
// role         : closer | setter | admin
const TEAM = [
  // Closers
  { email: "yoann@lescopywriters.fr",      password: "Closer@Yoann1",    name: "Yoann",     role: "closer" },
  { email: "rachid@lescopywriters.fr",     password: "Closer@Rachid1",   name: "Rachid",    role: "closer" },
  { email: "jremy@lescopywriters.fr",      password: "Closer@JRemy1",    name: "Jean-Rémy", role: "closer" },

  // Setters
  { email: "celine@lescopywriters.fr",     password: "Setter@Celine1",   name: "Céline",    role: "setter" },
  { email: "jessica@lescopywriters.fr",    password: "Setter@Jessica1",  name: "Jessica",   role: "setter" },
  { email: "philippe@lescopywriters.fr",   password: "Setter@Philippe1", name: "Philippe",  role: "setter" },
  { email: "andy@lescopywriters.fr",       password: "Setter@Andy1",     name: "Andy",      role: "setter" },

  // Admins
  { email: "joseph@lescopywriters.fr",     password: "Admin@Joseph1",    name: "Joseph",    role: "admin" },
  { email: "benoit@lescopywriters.fr",     password: "Admin@Benoit1",    name: "Benoît",    role: "admin" },
  { email: "helene@lescopywriters.fr",     password: "Admin@Helene1",    name: "Hélène",    role: "admin" },
  { email: "charbel@lescopywriters.fr",    password: "Admin@Charbel1",   name: "Charbel",   role: "admin" },
] as const;

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding ${TEAM.length} users into ${SUPABASE_URL}...\n`);

  for (const member of TEAM) {
    process.stdout.write(`  [${member.role.padEnd(6)}] ${member.name.padEnd(12)} `);

    // 1. Create auth user
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email: member.email,
      password: member.password,
      email_confirm: true,
    });

    if (authError) {
      console.log(`✗ auth: ${authError.message}`);
      continue;
    }

    const userId = data.user.id;

    // 2. Upsert profile (safe to re-run)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, name: member.name, role: member.role });

    if (profileError) {
      console.log(`✗ profile: ${profileError.message}`);
      continue;
    }

    console.log(`✓  ${member.email}`);
  }

  console.log("\n─── Credentials summary ───────────────────────────────────");
  console.log("Role    Name          Email                           Password");
  console.log("─────────────────────────────────────────────────────────────");
  for (const m of TEAM) {
    console.log(
      `${m.role.padEnd(7)} ${m.name.padEnd(13)} ${m.email.padEnd(35)} ${m.password}`
    );
  }
  console.log("\nShare each person their email + password and ask them to change it on first login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
