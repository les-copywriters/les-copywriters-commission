import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function checkSales() {
  const { count, error } = await supabase
    .from("sales")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error fetching sales count:", error.message);
    return;
  }

  console.log(`Total sales in database: ${count}`);

  if (count && count > 0) {
    const { data: samples } = await supabase
      .from("sales")
      .select("client_name, date, amount, closer_id, setter_id")
      .limit(5);
    
    console.log("Sample sales:", JSON.stringify(samples, null, 2));
  }
}

checkSales();
