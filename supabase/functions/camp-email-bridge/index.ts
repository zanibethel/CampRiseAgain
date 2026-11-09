import { createClient } from "npm:@supabase/supabase-js@2.95.0";

/**
 * Camp Rise Again private database bridge.
 *
 * The Vercel app holds a random bearer token. Only its SHA-256 digest is
 * embedded here. The Supabase service credential stays in Supabase's own
 * built-in Edge Function environment and is never copied into Vercel.
 *
 * This function has no general SQL interface; actions are strictly scoped
 * to the three Camp mail tables.
 */
const TOKEN_SHA256 = "2e955776ef1159eabd20500751634710fa560dc1f9bae7b4dfb5d549479ac803";
const ADMIN_EMAILS = new Set(["schofieldtierra@gmail.com", "zanibethel@gmail.com"]);
const INBOXES = new Set(["info", "volunteer", "forms"]);
const ORGANIZATION_ADDRESSES = new Set([
  "info@campriseagain.org", "volunteer@campriseagain.org", "forms@campriseagain.org",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
type Json = Record<string, unknown>;

function respond(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function str(value: unknown, max = 250): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function email(value: unknown): string {
  const s = str(value, 255).toLowerCase();
  return EMAIL.test(s) && s.length <= 254 ? s : "";
}
function inboxes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3) return null;
  if (value.some(x => typeof x !== "string" || !INBOXES.has(x))) return null;
  return [...new Set(value as string[])];
}
function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function authorized(request: Request): Promise<boolean> {
  const bearer = request.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) return false;
  const token = bearer.slice(7);
  if (token.length < 48 || token.length > 256) return false;
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return equalConstantTime(hex, TOKEN_SHA256);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  if (!(await authorized(request))) return respond({ error: "Unauthorized" }, 401);
  const raw = await request.text();
  if (raw.length > 32768) return respond({ error: "Request too large" }, 413);
  let input: { action?: unknown; params?: Json; userToken?: unknown };
  try { input = JSON.parse(raw); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const params: Json = input.params && typeof input.params === "object" && !Array.isArray(input.params)
    ? input.params : {};
  const action = str(input.action, 64);
  const url = Deno.env.get("SUPABASE_URL");
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const newKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key: string | undefined = legacyKey || newKeys.default;
  if (!url || !key) return respond({ error: "Private database connection unavailable" }, 503);

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const needsAdmin = action.startsWith("admin_");
  if (needsAdmin) {
    const userToken = str(input.userToken, 4096);
    if (!userToken) return respond({ error: "Admin authentication required" }, 403);
    const { data, error } = await db.auth.getUser(userToken);
    const user = data?.user;
    if (error || !user || !user.email_confirmed_at ||
        !ADMIN_EMAILS.has(user.email?.toLowerCase() || "")) {
      return respond({ error: "Admin access denied" }, 403);
    }
  }

  try {
    if (action === "ping") {
      const { error } = await db.from("camp_rise_again_email_forwarders").select("id").limit(1);
      return error ? respond({ error: "Data query failed" }, 503) : respond({ ok: true });
    }
    if (action === "get_forwarders") {
      const { data, error } = await db.from("camp_rise_again_email_forwarders")
        .select("id,email,display_name,title,inboxes,enabled,verified_at")
        .eq("enabled", true).not("verified_at", "is", null);
      return error ? respond({ error: "Forwarder query failed" }, 503) : respond({ forwarders: data || [] });
    }
    if (action === "upsert_route") {
      const sender = email(params.original_sender);
      const address = str(params.inbox_address).toLowerCase();
      const forwarderId = str(params.forwarder_id, 64);
      const emailId = str(params.inbound_email_id, 250);
      if (!sender || !ORGANIZATION_ADDRESSES.has(address) ||
          !UUID.test(forwarderId) || !emailId) return respond({ error: "Invalid route" }, 400);
      const inboxName = address.split("@")[0];
      const { data: staff } = await db.from("camp_rise_again_email_forwarders")
        .select("id,enabled,verified_at,inboxes").eq("id", forwarderId).maybeSingle();
      if (!staff || !staff.enabled || !staff.verified_at ||
          !staff.inboxes.includes(inboxName)) return respond({ error: "Forwarder not allowed" }, 403);
      const { data, error } = await db.from("camp_rise_again_mail_reply_routes")
        .upsert({
          inbound_email_id: emailId,
          forwarder_id: forwarderId,
          inbox_address: address,
          original_sender: sender,
          original_subject: str(params.original_subject, 160),
          original_message_id: str(params.original_message_id, 250) || null,
        }, { onConflict: "inbound_email_id,forwarder_id,inbox_address" })
        .select("id").single();
      return error || !data
        ? respond({ error: "Unable to save reply route" }, 503)
        : respond({ routeId: data.id });
    }
    if (action === "lookup_reply") {
      const routeId = str(params.routeId, 64);
      const sender = email(params.staffSender);
      if (!UUID.test(routeId) || !sender) return respond({ result: null });
      const { data: route, error } = await db.from("camp_rise_again_mail_reply_routes")
        .select("id,inbox_address,original_sender,original_subject,original_message_id,expires_at,forwarder_id")
        .eq("id", routeId).maybeSingle();
      if (error) return respond({ error: "Route query failed" }, 503);
      if (!route || new Date(route.expires_at).getTime() < Date.now()) return respond({ result: null });
      const { data: staff, error: staffError } = await db.from("camp_rise_again_email_forwarders")
        .select("id,email,display_name,title,inboxes,enabled,verified_at")
        .eq("id", route.forwarder_id).maybeSingle();
      if (staffError) return respond({ error: "Forwarder query failed" }, 503);
      const inboxName = route.inbox_address.split("@")[0];
      if (!staff || !staff.enabled || !staff.verified_at ||
          staff.email !== sender || !staff.inboxes.includes(inboxName) ||
          !ORGANIZATION_ADDRESSES.has(route.inbox_address)) return respond({ result: null });
      return respond({ result: { route, staff } });
    }
    if (action === "verify_email") {
      const hash = str(params.hash, 64);
      if (!SHA256.test(hash)) return respond({ verified: false });
      const { data, error } = await db.from("camp_rise_again_email_forwarders")
        .update({
          enabled: true,
          verified_at: new Date().toISOString(),
          verification_token_hash: null,
          verification_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("verification_token_hash", hash)
        .is("verified_at", null)
        .gt("verification_expires_at", new Date().toISOString())
        .select("id").maybeSingle();
      return error ? respond({ error: "Could not verify recipient" }, 503) : respond({ verified: !!data });
    }
    if (action === "admin_list") {
      const { data, error } = await db.from("camp_rise_again_email_forwarders")
        .select("id,email,display_name,title,inboxes,enabled,verified_at,created_at")
        .order("created_at", { ascending: true });
      return error ? respond({ error: "Could not list forwarding recipients" }, 503)
        : respond({ forwarders: data || [] });
    }
    if (action === "admin_create") {
      const address = email(params.email);
      const name = str(params.display_name, 100);
      const title = str(params.title, 120);
      const selected = inboxes(params.inboxes);
      const hash = str(params.tokenHash, 64);
      if (!address || !name || !selected || !SHA256.test(hash) ||
          address.endsWith("@campriseagain.org")) return respond({ error: "Invalid recipient" }, 400);
      const { data: existing } = await db.from("camp_rise_again_email_forwarders")
        .select("verified_at").eq("email", address).maybeSingle();
      if (existing?.verified_at) return respond({ error: "Recipient already verified" }, 409);
      const { error } = await db.from("camp_rise_again_email_forwarders").upsert({
        email: address, display_name: name, title, inboxes: selected,
        enabled: false, verified_at: null,
        verification_token_hash: hash,
        verification_expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });
      return error ? respond({ error: "Could not create recipient" }, 503) : respond({ ok: true });
    }
    if (action === "admin_patch") {
      const id = str(params.id, 64);
      if (!UUID.test(id)) return respond({ error: "Invalid recipient ID" }, 400);
      const { data: existing } = await db.from("camp_rise_again_email_forwarders")
        .select("verified_at").eq("id", id).maybeSingle();
      if (!existing) return respond({ error: "Recipient not found" }, 404);
      const change: Json = { updated_at: new Date().toISOString() };
      if ("display_name" in params) {
        const name = str(params.display_name, 100);
        if (!name) return respond({ error: "Name required" }, 400);
        change.display_name = name;
      }
      if ("title" in params) change.title = str(params.title, 120);
      if ("inboxes" in params) {
        const selected = inboxes(params.inboxes);
        if (!selected) return respond({ error: "Choose valid inboxes" }, 400);
        change.inboxes = selected;
      }
      if ("enabled" in params) {
        if (typeof params.enabled !== "boolean" || (params.enabled && !existing.verified_at))
          return respond({ error: "Recipient must verify before forwarding" }, 400);
        change.enabled = params.enabled;
      }
      const { error } = await db.from("camp_rise_again_email_forwarders").update(change).eq("id", id);
      return error ? respond({ error: "Could not update recipient" }, 503) : respond({ ok: true });
    }
    if (action === "admin_delete") {
      const id = str(params.id, 64);
      if (!UUID.test(id)) return respond({ error: "Invalid recipient ID" }, 400);
      const { error } = await db.from("camp_rise_again_email_forwarders").delete().eq("id", id);
      return error ? respond({ error: "Could not remove recipient" }, 503) : respond({ ok: true });
    }
    return respond({ error: "Unsupported action" }, 400);
  } catch {
    return respond({ error: "Private database operation failed" }, 503);
  }
});
