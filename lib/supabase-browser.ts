import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yufptpfiwdbzzrvhkvux.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JpayDIqb8Gy-hnGSL99fdg_jmKQQNJh";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return client;
}
