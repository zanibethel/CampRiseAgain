import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { campMailFallbackLogo } from "@/lib/camp-admin-email-html";

/**
 * Uses the SAME published logo as the website, not a second hard-coded brand.
 * Public-only Supabase site_settings read; safe to call from the admin API and
 * the Gmail forwarding relay. Falls back to the bundled original PNG.
 */
export async function currentCampLogoUrl(): Promise<string> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("site_settings")
      .select("logo_path").eq("id", 1).maybeSingle();
    if (!error && typeof data?.logo_path === "string" &&
        /^[a-z\d\/_-]+\.(?:png|jpe?g|webp)$/i.test(data.logo_path)) {
      const url = supabase.storage.from("camp-rise-again-branding")
        .getPublicUrl(data.logo_path).data.publicUrl;
      if (url.startsWith("https://")) return url;
    }
  } catch {
    // Never block delivery if the public logo setting is temporarily unavailable.
  }
  return campMailFallbackLogo();
}
