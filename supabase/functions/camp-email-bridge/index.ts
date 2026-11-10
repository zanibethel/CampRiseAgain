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

    // Website submissions: validate on the server, throttle by irreversible
    // HMAC fingerprint, and save only to private RLS-protected tables.
    if (action === "submit_form") {
      const kind = str(params.kind, 20);
      const requestId = str(params.requestId, 64);
      const fingerprint = str(params.fingerprint, 64);
      const fields = params.fields && typeof params.fields === "object" && !Array.isArray(params.fields)
        ? params.fields as Json : {};
      if (!["camper", "volunteer", "contact"].includes(kind) ||
          !UUID.test(requestId) || !SHA256.test(fingerprint)) return respond({ error: "Invalid submission" }, 400);
      const v = (key: string, max = 200) => str(fields[key], max);
      const mail = email(fields.email);
      const consent = fields.consent === true;
      if (!mail || !consent) return respond({ error: "Valid email and consent are required" }, 400);
      const table = kind === "camper" ? "camp_rise_again_camper_applications"
        : kind === "volunteer" ? "camp_rise_again_volunteer_applications"
        : "camp_rise_again_contact_messages";

      let record: Json = { id: requestId };
      if (kind === "contact") {
        const topics = new Set(["Camper application", "Volunteering", "Camp dates or location",
          "Donations or sponsorships", "Accessibility or accommodations", "General question"]);
        if (!v("name", 120) || !topics.has(v("topic", 120)) || v("message", 4001).length < 3
            || v("message", 4001).length > 4000) return respond({ error: "Complete the contact form." }, 400);
        record = { ...record, name: v("name", 120), email: mail,
          phone: v("phone", 40) || null, topic: v("topic", 120), message: v("message", 4000) };
      } else {
        const firstName = v("firstName", 100);
        const lastName = v("lastName", 100);
        const phone = v("phone", 40);
        const season = v("season", 20);
        const validSeason = kind === "camper" ? ["fall","spring","either"] : ["fall","spring","both"];
        if (!firstName || !lastName || !phone || !validSeason.includes(season)) {
          return respond({ error: "Complete the required fields." }, 400);
        }
        record = { ...record, first_name: firstName, last_name: lastName,
          email: mail, phone, season_preference: season, notes: v("notes", 2000) || null };
        if (kind === "volunteer") {
          const validRoles = new Set(["food_beverage","camp_mentor_support","activity_coordinator",
            "transportation","setup","take_down"]);
          const roles = fields.roles;
          if (!Array.isArray(roles) || roles.length === 0 ||
            roles.length > validRoles.size || roles.some(x => !validRoles.has(String(x)))) {
            return respond({ error: "Select valid volunteer interests." }, 400);
          }
          record.volunteer_roles = [...new Set(roles)];
        } else {
          const shirt = v("shirtSize", 12);
          const dob = v("dateOfBirth", 12);
          const earliestAdult = new Date();
          earliestAdult.setUTCFullYear(earliestAdult.getUTCFullYear() - 18);
          if (!v("address1", 250) || !v("city", 100) || !v("state", 60) ||
              !v("postalCode", 20) || !["XS","S","M","L","XL","2XL","3XL","4XL"].includes(shirt) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
              !Number.isFinite(Date.parse(dob)) || dob > earliestAdult.toISOString().slice(0,10)) {
            return respond({ error: "Complete the camper details; participants must be adults." }, 400);
          }
          record = { ...record,
            address_1: v("address1", 250), address_2: v("address2", 120) || null,
            city: v("city", 100), state: v("state", 60),
            postal_code: v("postalCode", 20), date_of_birth: dob, shirt_size: shirt };
        }
      }

      // Do not send a website notification if a duplicate retry was already saved.
      const { data: exists, error: lookupError } = await db.from(table)
        .select("id").eq("id", requestId).maybeSingle();
      if (lookupError) return respond({ error: "Submission lookup failed" }, 503);
      if (exists) return respond({ ok: true, id: exists.id, duplicate: true });
      const { data: permitted, error: limitError } = await db.rpc("camp_rise_again_claim_form_rate", {
        p_fingerprint: fingerprint, p_limit: 5, p_window_seconds: 900,
      });
      if (limitError) return respond({ error: "Unable to verify submission limit" }, 503);
      if (!permitted) return respond({ error: "Too many submissions. Please try later." }, 429);
      const { data: added, error: saveError } = await db.from(table)
        .insert(record).select("id").single();
      if (saveError || !added) return respond({ error: "Could not save submission" }, 503);
      return respond({ ok: true, id: added.id, duplicate: false });
    }
    if (action === "admin_list_submissions") {
      const kinds = [
        ["camper", "camp_rise_again_camper_applications",
          "id,created_at,first_name,last_name,email,season_preference"],
        ["volunteer", "camp_rise_again_volunteer_applications",
          "id,created_at,first_name,last_name,email,season_preference"],
        ["contact", "camp_rise_again_contact_messages",
          "id,created_at,name,email,topic"],
      ];
      const records: Json[] = [];
      for (const [kind, table, selected] of kinds) {
        const { data, error } = await db.from(table).select(selected).order("created_at", {ascending: false}).limit(50);
        if (error) return respond({ error: "Unable to load submissions" }, 503);
        for (const item of data || []) records.push({ ...(item as Json), kind });
      }
      records.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
      return respond({ submissions: records.slice(0,100) });
    }
    if (action === "admin_get_submission") {
      const kind = str(params.kind, 20);
      const id = str(params.id, 64);
      if (!UUID.test(id) || !["camper","volunteer","contact"].includes(kind)) return respond({ error: "Invalid submission" }, 400);
      const table = kind === "camper" ? "camp_rise_again_camper_applications"
        : kind === "volunteer" ? "camp_rise_again_volunteer_applications" : "camp_rise_again_contact_messages";
      const { data, error } = await db.from(table).select("*").eq("id",id).maybeSingle();
      if (error) return respond({ error: "Could not load submission" }, 503);
      return data ? respond({ submission: data }) : respond({ error: "Not found" }, 404);
    }

    return respond({ error: "Unsupported action" }, 400);
  } catch {
    return respond({ error: "Private database operation failed" }, 503);
  }
});
