import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function checkLogs() {
  const { data, error } = await supabase
    .from("integration_sync_runs")
    .select("source, status, records_seen, rows_written, errors, metadata, started_at")
    .order("started_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkLogs();
