import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use the key you added to the .sh file if it's not in .env yet
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyemVpaWFteHdjY2p3YmpxbnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE1MzA4MywiZXhwIjoyMDkwNzI5MDgzfQ.FidegwaUvaXYyOVA3O_oVxKTVnaCP7cHqInaRWXIlA4";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  { email: "BenoitMichaud63@gmail.com", role: "admin", name: "Benoit", password: "Admin@Benoit1" },
  { email: "joseph.atallah3@gmail.com", role: "admin", name: "Joseph", password: "Admin@Joseph1" },
  { email: "support@les-copywriters.com", role: "admin", name: "Support", password: "Admin@Support1" },
  { email: "jr@les-copywriters.com", role: "closer", name: "JR", password: "Closer@Jr1" },
  { email: "yoann@les-copywriters.com", role: "closer", name: "Yoann", password: "Closer@Yoann1" },
  { email: "rachid@les-copywriters.com", role: "closer", name: "Rachid", password: "Closer@Rachid1" },
  { email: "philippechatre67@gmail.com", role: "setter", name: "Philippe", password: "Setter@Philippe1" },
  { email: "celine.scotton@gmail.com", role: "setter", name: "Celine", password: "Setter@Celine1" },
  { email: "andy@les-copywriters.com", role: "setter", name: "Andy", password: "Setter@Andy1" },
  { email: "jessica.oustry.copywriter@gmail.com", role: "setter", name: "Jessica", password: "Setter@Jessica1" }
];

async function createUsers() {
  console.log(`🚀 Starting bulk user creation for ${users.length} users...\n`);

  for (const user of users) {
    process.stdout.write(`Creating ${user.email}... `);
    
    try {
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          console.log("⏭️ Already exists in Auth.");
          // Try to backfill profile if user exists but profile might be missing
          const { data: existingUser } = await supabase.auth.admin.listUsers();
          const target = existingUser?.users.find(u => u.email === user.email);
          if (target) {
            await createProfile(target.id, user.name, user.role);
          }
        } else {
          console.log(`❌ Auth Error: ${authError.message}`);
        }
        continue;
      }

      // 2. Create Profile
      await createProfile(authData.user.id, user.name, user.role);
      console.log("✅ Success");

    } catch (err) {
      console.log(`💥 Critical Error: ${String(err)}`);
    }
  }

  console.log("\n✨ Bulk creation process finished.");
}

async function createProfile(id: string, name: string, role: string) {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id, name, role }, { onConflict: 'id' });

  if (profileError) {
    console.log(`⚠️ Profile Error: ${profileError.message}`);
  }
}

createUsers();
