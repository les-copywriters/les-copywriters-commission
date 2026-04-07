import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string ?? "https://irzeiiamxwccjwbjqnza.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyemVpaWFteHdjY2p3YmpxbnphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTMwODMsImV4cCI6MjA5MDcyOTA4M30.EicQFJCxna1KIoGhO9ABfItajMaNfpih5MPbcm2yDRY";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
