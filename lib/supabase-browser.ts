import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yufptpfiwdbzzrvhkvux.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JpayDIqb8Gy-hnGSL99fdg_jmKQQNJh";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    const base = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const originalFrom = base.from.bind(base);
    base.from = ((table: string) => {
      const mapped = table === "site_settings"
        ? "camp_rise_again_site_settings"
        : table === "schedule_items"
          ? "camp_rise_again_schedule"
          : table;
      return originalFrom(mapped);
    }) as typeof base.from;
    client = base;
  }
  return client;
}
