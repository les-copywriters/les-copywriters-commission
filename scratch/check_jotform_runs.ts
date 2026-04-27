import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const { data, error } = await supabase
  .from("integration_sync_runs")
  .select("*")
  .eq("source", "jotform")
  .order("started_at", { ascending: false })
  .limit(5);

if (error) {
  console.error(error);
} else {
  console.log(JSON.stringify(data, null, 2));
}
