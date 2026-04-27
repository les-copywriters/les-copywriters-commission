import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const settings = [
  { key: "jotform_api_key", value: "1acd9e9568d84de30a4a5290fbd413e1", description: "Global Jotform API Key", is_secret: true },
  { key: "jotform_form_id", value: "241032303097344", description: "Global Jotform Form ID", is_secret: false },
];

for (const setting of settings) {
  const { error } = await supabase
    .from("global_settings")
    .upsert(setting, { onConflict: "key" });
    
  if (error) {
    console.error(`Error updating ${setting.key}:`, error.message);
  } else {
    console.log(`Successfully updated ${setting.key}`);
  }
}
