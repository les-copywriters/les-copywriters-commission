import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyemVpaWFteHdjY2p3YmpxbnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE1MzA4MywiZXhwIjoyMDkwNzI5MDgzfQ.FidegwaUvaXYyOVA3O_oVxKTVnaCP7cHqInaRWXIlA4";

// ⚠️ PASTE YOUR JOTFORM CREDENTIALS HERE OR ADD THEM TO .env
const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY || "1acd9e9568d84de30a4a5290fbd413e1";
const JOTFORM_FORM_ID = process.env.JOTFORM_FORM_ID || "241032303097344";

const FIELD_MAP = {
  closer: "typeDe36",
  setter: "setterLie",
};

async function runDiagnostic() {
  if (!JOTFORM_API_KEY || JOTFORM_API_KEY === "YOUR_JOTFORM_API_KEY") {
    console.error("❌ Error: JOTFORM_API_KEY is missing. Please add it to .env or edit the script.");
    process.exit(1);
  }

  console.log("🔍 Starting JotForm Diagnostic...");

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
  const { data: profiles } = await supabase.from('profiles').select('name, role');
  const profileNames = new Set(profiles?.map(p => p.name.toLowerCase()) || []);

  let offset = 0;
  let allSubmissions: any[] = [];

  try {
    while (true) {
      console.log(`📡 Fetching submissions (offset: ${offset})...`);
      const res = await fetch(`https://api.jotform.com/form/${JOTFORM_FORM_ID}/submissions?apiKey=${JOTFORM_API_KEY}&limit=100&offset=${offset}`);
      const data = await res.json();

      if (!data.content || data.content.length === 0) break;
      allSubmissions.push(...data.content);
      if (data.content.length < 100) break;
      offset += 100;
    }
  } catch (err) {
    console.error("❌ API Error:", err);
  }

  console.log(`\n📊 Total Submissions Found: ${allSubmissions.length}`);

  const closerStats: Record<string, number> = {};
  const setterStats: Record<string, number> = {};
  let inactiveCount = 0;
  let missingCloserCount = 0;

  allSubmissions.forEach(sub => {
    if (sub.status !== 'ACTIVE') {
      inactiveCount++;
      return;
    }

    const answers = sub.answers || {};
    const closerAnswer = Object.values(answers).find((a: any) => a.name === FIELD_MAP.closer) as any;
    const setterAnswer = Object.values(answers).find((a: any) => a.name === FIELD_MAP.setter) as any;

    const closerName = closerAnswer?.answer || "Unknown";
    const setterName = setterAnswer?.answer || "None";

    if (closerName === "Unknown") missingCloserCount++;

    closerStats[closerName] = (closerStats[closerName] || 0) + 1;
    if (setterName !== "None") {
      setterStats[setterName] = (setterStats[setterName] || 0) + 1;
    }
  });

  console.log("\n❌ UNMATCHED CLOSERS (In JotForm but NOT in Dashboard):");
  Object.keys(closerStats).sort((a, b) => closerStats[b] - closerStats[a]).forEach(name => {
    if (!profileNames.has(name.toLowerCase()) && name !== "Unknown") {
      console.log(`- ${name}: ${closerStats[name]} submissions`);
    }
  });

  console.log("\n❌ UNMATCHED SETTERS (In JotForm but NOT in Dashboard):");
  Object.keys(setterStats).sort((a, b) => setterStats[b] - setterStats[a]).forEach(name => {
    if (!profileNames.has(name.toLowerCase()) && name !== "None") {
      console.log(`- ${name}: ${setterStats[name]} submissions`);
    }
  });

  console.log("\n📈 Summary:");
  console.log(`- Active Submissions: ${allSubmissions.length - inactiveCount}`);
  console.log(`- Inactive/Deleted: ${inactiveCount}`);
  console.log(`- Missing Closer Field: ${missingCloserCount}`);
}

runDiagnostic();
