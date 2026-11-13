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
  let adminEmail: string | null = null;
  if (needsAdmin) {
    const userToken = str(input.userToken, 4096);
    if (!userToken) return respond({ error: "Admin authentication required" }, 403);
    const { data, error } = await db.auth.getUser(userToken);
    const user = data?.user;
    if (error || !user || !user.email_confirmed_at ||
        !ADMIN_EMAILS.has(user.email?.toLowerCase() || "")) {
      return respond({ error: "Admin access denied" }, 403);
    }
    adminEmail = user.email?.toLowerCase() || null;
  }

  try {
    if (action === "generate_camp_recovery_link") {
      // This route is accessible only via the server-only, hashed bridge bearer.
      // It NEVER accepts a caller-selected redirect, arbitrary account, or
      // returns anything to public browsers: Vercel sends the link via Resend.
      const recipient = email(params.email);
      const ipFingerprint = str(params.ipFingerprint, 64);
      const emailFingerprint = str(params.emailFingerprint, 64);
      if (!recipient || !ADMIN_EMAILS.has(recipient) ||
          !SHA256.test(ipFingerprint) || !SHA256.test(emailFingerprint)) {
        return respond({ error: "Recovery request not authorized" }, 403);
      }
      const { data: ipAllowed, error: ipError } = await db.rpc("camp_rise_again_claim_form_rate", {
        p_fingerprint: ipFingerprint, p_limit: 3, p_window_seconds: 900,
      });
      if (ipError) return respond({ error: "Recovery service unavailable" }, 503);
      if (!ipAllowed) return respond({ error: "Too many requests" }, 429);
      const { data: emailAllowed, error: emailError } = await db.rpc("camp_rise_again_claim_form_rate", {
        p_fingerprint: emailFingerprint, p_limit: 5, p_window_seconds: 3600,
      });
      if (emailError) return respond({ error: "Recovery service unavailable" }, 503);
      if (!emailAllowed) return respond({ error: "Too many requests" }, 429);
      const { data, error } = await db.auth.admin.generateLink({
        type: "recovery",
        email: recipient,
        options: { redirectTo: "https://campriseagain.org/admin/reset-password" },
      });
      if (error || typeof data?.properties?.action_link !== "string") {
        return respond({ error: "Unable to generate recovery link" }, 503);
      }
      return respond({ actionLink: data.properties.action_link });
    }
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


    // Form field definitions are private; the public endpoint exposes only
    // active questions, never submission records or staff configuration.
    if (action === "get_form_fields") {
      const kind = str(params.kind, 20);
      if (!["camper","volunteer"].includes(kind)) return respond({ error:"Unknown form" },400);
      const { data, error } = await db.from("camp_rise_again_form_fields")
        .select("field_key,label,input_type,choices,required,sort_order,after_field")
        .eq("form_kind",kind).eq("active",true)
        .order("sort_order",{ascending:true}).order("created_at",{ascending:true}).limit(30);
      return error ? respond({error:"Questions unavailable"},503) : respond({fields:data || []});
    }
    if (action === "admin_field_list") {
      const { data, error } = await db.from("camp_rise_again_form_fields")
        .select("id,form_kind,field_key,label,input_type,choices,required,active,sort_order,after_field,updated_at")
        .order("form_kind").order("sort_order").order("created_at");
      return error ? respond({error:"Unable to load questions"},503) : respond({fields:data || []});
    }
    if (action === "admin_field_create" || action === "admin_field_update") {
      const kind = str(params.form_kind,20);
      const label = str(params.label,160);
      const inputType = str(params.input_type,24);
      const types = ["short_text","long_text","select","multi_select","checkbox"];
      const selectable = inputType === "select" || inputType === "multi_select";
      const rawChoices = params.choices;
      const choices = Array.isArray(rawChoices) ? rawChoices.map(x=>str(x,100)).filter(Boolean) : [];
      const isRequired = params.required === true;
      const active = params.active !== false;
      const order = Number.isInteger(params.sort_order) ? Number(params.sort_order) : 100;
      if (!["camper","volunteer"].includes(kind) || label.length < 3 ||
          !types.includes(inputType) || choices.length > 20 ||
          new Set(choices).size !== choices.length ||
          (selectable && choices.length < 2) || (!selectable && choices.length > 0) ||
          order < 0 || order > 100000) return respond({error:"Invalid question configuration"},400);
      const change = { form_kind:kind, label, input_type:inputType,
        choices, required:isRequired, active, sort_order:order, updated_at:new Date().toISOString() };
      if (action === "admin_field_create") {
        const key = str(params.field_key,48);
        const anchor = str(params.after_field,48);
        if (!/^[a-z][a-z0-9_]{1,47}$/.test(key)) return respond({error:"Question key must be lowercase letters, digits or underscores"},400);
        const fixed = kind === "camper"
          ? ["firstName","lastName","email","phone","address1","address2","city","state",
            "postalCode","dateOfBirth","shirtSize","season","notes"]
          : ["firstName","lastName","email","phone","season","roles","notes"];
        if (!anchor || anchor === key) return respond({error:"Choose where the question should appear"},400);
        if (!fixed.includes(anchor)) {
          const {data:parent,error:parentError} = await db.from("camp_rise_again_form_fields")
            .select("id").eq("form_kind",kind).eq("field_key",anchor).maybeSingle();
          if (parentError || !parent) return respond({error:"Position not found. Refresh the form editor."},409);
        }
        const {count,error:countError} = await db.from("camp_rise_again_form_fields")
          .select("id",{head:true,count:"exact"}).eq("form_kind",kind);
        if (countError) return respond({error:"Cannot verify question limit"},503);
        if ((count || 0) >= 25) return respond({error:"Maximum 25 questions per form"},400);
        const { data, error } = await db.from("camp_rise_again_form_fields")
          .insert({...change,field_key:key,after_field:anchor}).select("*").single();
        return error ? respond({error:error.code === "23505" ? "Question key already exists" : "Unable to create question"},error.code === "23505" ? 409:503)
          : respond({field:data});
      }
      const id = str(params.id,64);
      const updatedAt = str(params.updated_at,80);
      if (!UUID.test(id) || !updatedAt) return respond({error:"Question reference required"},400);
      const { data, error } = await db.from("camp_rise_again_form_fields")
        .update(change).eq("id",id).eq("form_kind",kind).eq("updated_at",updatedAt)
        .select("*").maybeSingle();
      return error ? respond({error:"Unable to update question"},503)
        : data ? respond({field:data})
        : respond({error:"Question changed elsewhere; refresh to avoid overwriting edits"},409);
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


      // Validate optional, admin-defined answers against current active
      // questions. Unknown keys are ignored to support forms open during edits.
      if (kind !== "contact") {
        const { data: questions, error: questionError } = await db
          .from("camp_rise_again_form_fields")
          .select("field_key,input_type,choices,required").eq("form_kind",kind)
          .eq("active",true).limit(30);
        if (questionError) return respond({error:"Questions unavailable"},503);
        const supplied = fields.extraAnswers && typeof fields.extraAnswers === "object" &&
          !Array.isArray(fields.extraAnswers) ? fields.extraAnswers as Json : {};
        const answers: Json = {};
        for (const q of questions || []) {
          const value = supplied[q.field_key];
          const blank = value === null || value === undefined || value === "" ||
            (Array.isArray(value) && value.length === 0);
          if (blank) {
            if (q.required) return respond({error:"Please complete all required questions"},400);
            continue;
          }
          if (q.input_type === "checkbox") {
            if (typeof value !== "boolean" || (q.required && value !== true)) return respond({error:"Invalid checkbox answer"},400);
            answers[q.field_key] = value;
          } else if (q.input_type === "select") {
            if (typeof value !== "string" || !(q.choices as string[]).includes(value))
              return respond({error:"Invalid selected answer"},400);
            answers[q.field_key] = value;
          } else if (q.input_type === "multi_select") {
            if (!Array.isArray(value) || value.length > 20 ||
                value.some(x=>typeof x !== "string" || !(q.choices as string[]).includes(x)))
              return respond({error:"Invalid multiple-choice answer"},400);
            answers[q.field_key] = [...new Set(value)];
          } else if (q.input_type === "short_text" || q.input_type === "long_text") {
            const max = q.input_type === "short_text" ? 200 : 1000;
            if (typeof value !== "string" || value.trim().length > max)
              return respond({error:"Question answer exceeds length limit"},400);
            if (value.trim()) answers[q.field_key] = value.trim();
          }
        }
        record.extra_answers = answers;
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

    if (action === "admin_form_report") {
      const day30 = new Date(Date.now()-30*86400000).toISOString();
      const definitions = [
        ["camper","camp_rise_again_camper_applications"],
        ["volunteer","camp_rise_again_volunteer_applications"],
        ["contact","camp_rise_again_contact_messages"],
      ];
      const counts: Json = {};
      for (const [kind,table] of definitions) {
        const [all,recent] = await Promise.all([
          db.from(table).select("id",{head:true,count:"exact"}),
          db.from(table).select("id",{head:true,count:"exact"}).gte("created_at",day30),
        ]);
        if (all.error || recent.error) return respond({error:"Unable to summarize engagement"},503);
        counts[kind] = {total:all.count || 0,last30Days:recent.count || 0};
      }
      const {data: volunteers,error:roleError} = await db.from("camp_rise_again_volunteer_applications")
        .select("volunteer_roles,season_preference,extra_answers").order("created_at",{ascending:false}).limit(1000);
      const {data: campers,error:seasonError} = await db.from("camp_rise_again_camper_applications")
        .select("season_preference,extra_answers").order("created_at",{ascending:false}).limit(1000);
      if (roleError || seasonError) return respond({error:"Unable to summarize preferences"},503);
      const roleCounts: Record<string,number> = {};
      const seasonCounts: Record<string,number> = {};
      const sourceCounts: Record<string,number> = {};
      const trackSource = (row: {extra_answers?:{how_heard?:unknown}}) => {
        const source = row.extra_answers?.how_heard;
        if (typeof source === "string" && source.length <= 100) sourceCounts[source] = (sourceCounts[source] || 0)+1;
      };
      for (const row of volunteers || []) {
        trackSource(row);
        for (const role of row.volunteer_roles || []) roleCounts[role] = (roleCounts[role] || 0)+1;
        const key = "volunteer:" + row.season_preference;
        seasonCounts[key] = (seasonCounts[key] || 0)+1;
      }
      for (const row of campers || []) {
        trackSource(row);
        const key = "camper:" + row.season_preference;
        seasonCounts[key] = (seasonCounts[key] || 0)+1;
      }
      return respond({counts,roleCounts,seasonCounts,sourceCounts,
        preferencesSampled:(counts.camper as Json).total !== (campers || []).length ||
          (counts.volunteer as Json).total !== (volunteers || []).length});
    }
    if (action === "admin_export_submissions") {
      const kind = str(params.kind,20);
      if (!["all","camper","volunteer","contact"].includes(kind))
        return respond({error:"Unknown export filter"},400);
      const defs = [
        ["camper","camp_rise_again_camper_applications"],
        ["volunteer","camp_rise_again_volunteer_applications"],
        ["contact","camp_rise_again_contact_messages"],
      ].filter(([k])=>kind==="all" || k===kind);
      const submissions: Json[] = [];
      let truncated = false;
      for (const [k,table] of defs) {
        const {data,error,count} = await db.from(table).select("*",{count:"exact"})
          .order("created_at",{ascending:false}).range(0,999);
        if (error) return respond({error:"Unable to export records"},503);
        if ((count || 0)>1000) truncated = true;
        for (const row of data || []) submissions.push({...row,kind:k});
      }
      submissions.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
      return respond({submissions,truncated});
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

    // FAQ content. The Vercel server may read published items; all writes and
    // draft reads require the verified Camp Rise Again admin JWT above.
    if (action === "get_public_faqs") {
      const section = str(params.section, 20);
      if (!["general","campers","volunteers"].includes(section))
        return respond({ error: "Unknown FAQ section" }, 400);
      const { data, error } = await db.from("camp_rise_again_faq_items")
        .select("id,question,answer")
        .eq("section",section).eq("is_published",true)
        .order("sort_order",{ascending:true}).order("created_at",{ascending:true});
      return error ? respond({ error: "FAQs unavailable" }, 503)
        : respond({ faqs: data || [] });
    }
    if (action === "admin_faq_list") {
      const { data, error } = await db.from("camp_rise_again_faq_items")
        .select("id,section,question,answer,is_published,sort_order,updated_at,updated_by")
        .order("section",{ascending:true}).order("sort_order",{ascending:true})
        .order("created_at",{ascending:true});
      return error ? respond({ error: "Unable to list FAQs" }, 503)
        : respond({ faqs:data || [] });
    }
    if (action === "admin_faq_create") {
      const section = str(params.section,20);
      const question = str(params.question,240);
      const answer = str(params.answer,3000);
      if (!["general","campers","volunteers"].includes(section) ||
          question.length < 5 || !answer)
        return respond({ error: "Choose a page, question, and answer" }, 400);
      // Newly created items remain drafts until someone deliberately publishes.
      const { data: last, error: orderError } = await db.from("camp_rise_again_faq_items")
        .select("sort_order").eq("section",section)
        .order("sort_order",{ascending:false}).limit(1).maybeSingle();
      if (orderError) return respond({ error: "Cannot calculate FAQ order" }, 503);
      const { data, error } = await db.from("camp_rise_again_faq_items")
        .insert({ section, question, answer,
          is_published:false, sort_order:(last?.sort_order || 0)+10,
          updated_by:adminEmail })
        .select("id,section,question,answer,is_published,sort_order,updated_at,updated_by").single();
      if (error) return respond({ error:error.code === "23505" ?
        "This question already exists on that page." : "Unable to create FAQ" }, error.code === "23505" ? 409 : 503);
      return respond({ item:data });
    }
    if (action === "admin_faq_update") {
      const id = str(params.id,64);
      const section = str(params.section,20);
      const question = str(params.question,240);
      const answer = str(params.answer,3000);
      const updatedAt = str(params.updated_at,80);
      if (!UUID.test(id) || !["general","campers","volunteers"].includes(section) ||
          question.length < 5 || !answer || typeof params.is_published !== "boolean" ||
          !updatedAt) return respond({ error: "Complete the FAQ fields" }, 400);
      // Prevent an older admin tab from overwriting a newer change.
      const { data, error } = await db.from("camp_rise_again_faq_items")
        .update({ question, answer, is_published:params.is_published,
          updated_at:new Date().toISOString(), updated_by:adminEmail })
        .eq("id",id).eq("section",section).eq("updated_at",updatedAt)
        .select("id,section,question,answer,is_published,sort_order,updated_at,updated_by")
        .maybeSingle();
      if (error) return respond({ error:error.code === "23505" ?
        "A matching question already exists on this page." : "Unable to update FAQ" },error.code === "23505" ? 409:503);
      return data ? respond({ item:data })
        : respond({ error:"This FAQ changed elsewhere. Refresh before editing." },409);
    }
    if (action === "admin_faq_delete") {
      const id = str(params.id,64);
      const section = str(params.section,20);
      if (!UUID.test(id) || !["general","campers","volunteers"].includes(section))
        return respond({ error:"Invalid FAQ" },400);
      const { data, error } = await db.from("camp_rise_again_faq_items")
        .delete().eq("id",id).eq("section",section).select("id").maybeSingle();
      if (error) return respond({ error:"Unable to delete FAQ" },503);
      return data ? respond({ ok:true }) : respond({ error:"FAQ not found" },404);
    }
    if (action === "admin_faq_reorder") {
      const section = str(params.section,20);
      const ids = params.ids;
      if (!["general","campers","volunteers"].includes(section) ||
          !Array.isArray(ids) || ids.length > 100 ||
          ids.some(id => typeof id !== "string" || !UUID.test(id)) ||
          new Set(ids).size !== ids.length)
        return respond({ error:"Invalid FAQ order" },400);
      const { data, error } = await db.rpc("camp_rise_again_reorder_faqs",
        { p_section:section, p_ids:ids });
      if (error) return respond({ error:"Unable to reorder FAQs" },503);
      return data === true ? respond({ ok:true })
        : respond({ error:"FAQ list changed. Refresh before reordering." },409);
    }


    // Past Camps galleries: media is always private in Storage and requires
    // album publication, individual approval, complete upload and consent.
    const GALLERY_BUCKET = "camp-rise-again-past-camps";
    const ALBUMS_TABLE = "camp_rise_again_albums";
    const MEDIA_TABLE = "camp_rise_again_album_media";
    const ALBUM_FIELDS = "id,title,camp_date,location,description,sort_order,is_published,created_at,updated_at";
    const MEDIA_FIELDS = "id,album_id,storage_path,media_type,mime_type,bytes,caption,alt_text,sort_order,upload_complete,consent_confirmed,is_published,created_at,updated_at";
    const ALLOWED_MIME: Record<string,string> = {
      "image/jpeg":"jpg","image/png":"png","image/webp":"webp",
      "video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov",
    };
    async function decorateMedia(rows: Json[], ttl: number) {
      if (!rows.length) return [];
      const paths = rows.map(row => String(row.storage_path));
      const urls = new Map<string,string>();
      for (let i=0; i<paths.length; i+=100) {
        const batch=paths.slice(i,i+100);
        const { data, error } = await db.storage.from(GALLERY_BUCKET)
          .createSignedUrls(batch, ttl);
        if (error) throw new Error("Could not sign gallery media");
        (data || []).forEach((result,i) => {
          // The batched signing result is aligned with the input paths.
          if (result.signedUrl) urls.set(batch[i],result.signedUrl);
        });
      }
      return rows.map(({storage_path, ...row}) => ({
        ...row,
        // Do not reveal raw storage paths or drafts to visitors.
        media_url:urls.get(String(storage_path)) || null,
      }));
    }
    if (action === "get_public_gallery") {
      const { data: albums, error: albumError } = await db.from(ALBUMS_TABLE)
        .select("id,title,camp_date,location,description,sort_order,created_at")
        .eq("is_published",true).order("sort_order",{ascending:true})
        .order("created_at",{ascending:false}).limit(60);
      if (albumError) return respond({ error:"Gallery temporarily unavailable" },503);
      const ids=(albums || []).map(x=>x.id);
      if (!ids.length) return respond({ albums:[], media:[] });
      const { data: media, error: mediaError } = await db.from(MEDIA_TABLE)
        .select("id,album_id,storage_path,media_type,caption,alt_text,sort_order")
        .in("album_id",ids)
        .eq("upload_complete",true).eq("consent_confirmed",true)
        .eq("is_published",true)
        .order("sort_order",{ascending:true}).order("created_at",{ascending:true})
        .limit(600);
      if (mediaError) return respond({ error:"Gallery temporarily unavailable" },503);
      const signed = await decorateMedia((media || []) as Json[],900);
      return respond({ albums:albums || [], media:signed });
    }
    if (action === "admin_gallery_list") {
      const [albumsResult,mediaResult] = await Promise.all([
        db.from(ALBUMS_TABLE).select(ALBUM_FIELDS).order("sort_order").order("created_at"),
        db.from(MEDIA_TABLE).select(MEDIA_FIELDS).order("sort_order").order("created_at").limit(600),
      ]);
      if (albumsResult.error || mediaResult.error)
        return respond({ error:"Unable to load albums" },503);
      const media=await decorateMedia((mediaResult.data || []).filter(
        x => x.upload_complete) as Json[],900);
      const previews=new Map(media.map(x=>[x.id,x.media_url]));
      return respond({
        albums:albumsResult.data || [],
        media:(mediaResult.data || []).map(({storage_path, ...row})=>({
          ...row, media_url:previews.get(row.id) || null,
        })),
      });
    }
    if (action === "admin_gallery_create_album") {
      const title=str(params.title,150), location=str(params.location,160),
        description=str(params.description,1200), date=str(params.camp_date,10);
      if (title.length<3 || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)))
        return respond({ error:"Enter an album name and valid date" },400);
      const { data: last } = await db.from(ALBUMS_TABLE)
        .select("sort_order").order("sort_order",{ascending:false}).limit(1).maybeSingle();
      const {data,error}=await db.from(ALBUMS_TABLE).insert({
        title,location,description,camp_date:date || null,
        sort_order:(last?.sort_order || 0)+10,is_published:false,
      }).select(ALBUM_FIELDS).single();
      return error?respond({ error:"Unable to create album" },503):respond({ album:data });
    }
    if (action === "admin_gallery_update_album") {
      const id=str(params.id,64),title=str(params.title,150),
        location=str(params.location,160),description=str(params.description,1200),
        date=str(params.camp_date,10);
      if (!UUID.test(id) || title.length<3 ||
          (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) ||
          typeof params.is_published!=="boolean")
        return respond({ error:"Invalid album details" },400);
      const {data,error}=await db.from(ALBUMS_TABLE).update({
        title,location,description,camp_date:date || null,
        is_published:params.is_published,updated_at:new Date().toISOString(),
      }).eq("id",id).select(ALBUM_FIELDS).maybeSingle();
      return error?respond({ error:"Unable to update album" },503):
        data?respond({ album:data }):respond({ error:"Album not found" },404);
    }
    if (action === "admin_gallery_delete_album") {
      const id=str(params.id,64);
      if (!UUID.test(id)) return respond({ error:"Invalid album" },400);
      const {count,error:countError}=await db.from(MEDIA_TABLE)
        .select("id",{count:"exact",head:true}).eq("album_id",id);
      if (countError) return respond({ error:"Unable to verify album contents" },503);
      if (count) return respond({ error:"Remove album media before deleting the album." },409);
      const {data,error}=await db.from(ALBUMS_TABLE)
        .delete().eq("id",id).select("id").maybeSingle();
      return error?respond({ error:"Could not delete album" },503):
        data?respond({ ok:true }):respond({ error:"Album not found" },404);
    }
    if (action === "admin_gallery_prepare_upload") {
      const albumId=str(params.album_id,64), mime=str(params.mime_type,60),
        size=Number(params.bytes), mediaType = mime.startsWith("image/")?"photo":"video";
      if (!UUID.test(albumId) || !ALLOWED_MIME[mime] || !Number.isInteger(size) ||
          size<1 || size>47185920 || (mediaType==="photo" && size>10485760)) {
        return respond({ error:"Unsupported file type or file is too large (photos 10 MB, videos 45 MB)." },400);
      }
      const {data:album}=await db.from(ALBUMS_TABLE).select("id")
        .eq("id",albumId).maybeSingle();
      if (!album) return respond({ error:"Album not found" },404);
      const mediaId=crypto.randomUUID();
      const path="albums/"+albumId+"/"+mediaId+"."+ALLOWED_MIME[mime];
      const {data:last}=await db.from(MEDIA_TABLE).select("sort_order")
        .eq("album_id",albumId).order("sort_order",{ascending:false}).limit(1).maybeSingle();
      const {error:insertError}=await db.from(MEDIA_TABLE).insert({
        id:mediaId,album_id:albumId,storage_path:path,media_type:mediaType,
        mime_type:mime,bytes:size,sort_order:(last?.sort_order || 0)+10,
        upload_complete:false,is_published:false,consent_confirmed:false,
      });
      if (insertError) return respond({ error:"Could not prepare media upload" },503);
      const {data:token,error:signError}=await db.storage.from(GALLERY_BUCKET)
        .createSignedUploadUrl(path);
      if (signError || !token) {
        await db.from(MEDIA_TABLE).delete().eq("id",mediaId);
        return respond({ error:"Unable to authorize media upload" },503);
      }
      return respond({ mediaId, path, uploadToken:token.token,
        bucket:GALLERY_BUCKET, expiresInSeconds:7200 });
    }
    if (action === "admin_gallery_finalize_upload") {
      const id=str(params.id,64);
      if (!UUID.test(id)) return respond({ error:"Invalid media item" },400);
      const {data:row,error:readError}=await db.from(MEDIA_TABLE)
        .select("id,storage_path,mime_type,bytes,upload_complete")
        .eq("id",id).maybeSingle();
      if (readError || !row) return respond({ error:"Media item not found" },404);
      if (row.upload_complete) return respond({ ok:true });
      const {data:details,error:infoError}=await db.storage.from(GALLERY_BUCKET)
        .info(row.storage_path);
      if (infoError || !details) return respond({ error:"Upload not found. Try uploading again." },409);
      // Do not trust a browser-submitted MIME or file size after upload.
      const actualSize=Number(details.size);
      const actualMime=str(details.contentType || details.mimeType,60);
      if (!Number.isFinite(actualSize) || actualSize<1 ||
          actualSize>47185920 || actualSize>row.bytes ||
          actualMime!==row.mime_type) {
        await db.storage.from(GALLERY_BUCKET).remove([row.storage_path]);
        return respond({ error:"Uploaded file did not match the authorized type or size." },409);
      }
      const {error}=await db.from(MEDIA_TABLE).update({
        upload_complete:true,updated_at:new Date().toISOString(),
      }).eq("id",id);
      return error?respond({ error:"Unable to finish upload" },503):respond({ ok:true });
    }
    if (action === "admin_gallery_update_media") {
      const id=str(params.id,64),caption=str(params.caption,700),
        alt=str(params.alt_text,200), consent=params.consent_confirmed,
        publish=params.is_published;
      if (!UUID.test(id) || typeof consent!=="boolean" ||
          typeof publish!=="boolean" ||
          (publish && (!consent || alt.length<5 && params.media_type==="photo")))
        return respond({ error:"Confirm consent and add a description before publishing a photo." },400);
      const {data:old}=await db.from(MEDIA_TABLE).select("upload_complete,media_type")
        .eq("id",id).maybeSingle();
      if (!old) return respond({ error:"Media not found" },404);
      if (publish && (!old.upload_complete || !consent ||
          (old.media_type==="photo" && alt.length<5))) {
        return respond({ error:"Finish uploading, confirm publication permission, and describe the photo first." },400);
      }
      const {data,error}=await db.from(MEDIA_TABLE)
        .update({caption,alt_text:alt,consent_confirmed:consent,
          is_published:publish,updated_at:new Date().toISOString()})
        .eq("id",id).select(MEDIA_FIELDS).maybeSingle();
      return error?respond({ error:"Could not save media" },503):
        data?respond({ media:data }):respond({ error:"Media not found" },404);
    }
    if (action === "admin_gallery_delete_media") {
      const id=str(params.id,64);
      if (!UUID.test(id)) return respond({ error:"Invalid media" },400);
      const {data:row}=await db.from(MEDIA_TABLE).select("id,storage_path")
        .eq("id",id).maybeSingle();
      if (!row) return respond({ error:"Media not found" },404);
      const {error:removeError}=await db.storage.from(GALLERY_BUCKET)
        .remove([row.storage_path]);
      if (removeError) return respond({ error:"Could not delete the stored file. Try again." },503);
      const {error}=await db.from(MEDIA_TABLE).delete().eq("id",id);
      return error?respond({ error:"Could not remove media record" },503):respond({ ok:true });
    }
    if (action === "admin_gallery_move") {
      const kind=str(params.kind,10),id=str(params.id,64),
        direction=Number(params.direction);
      if (!UUID.test(id) || !["album","media"].includes(kind) ||
          ![-1,1].includes(direction)) return respond({ error:"Invalid reorder request" },400);
      const table=kind==="album"?ALBUMS_TABLE:MEDIA_TABLE;
      const {data:source}=await db.from(table)
        .select(kind==="album"?"id,sort_order":"id,sort_order,album_id")
        .eq("id",id).maybeSingle();
      if (!source) return respond({ error:"Item not found" },404);
      let q=db.from(table).select("id,sort_order");
      if (kind==="media") q=q.eq("album_id",source.album_id);
      const {data:rows,error:lookupError}=await q.order("sort_order")
        .order("created_at").limit(600);
      if (lookupError) return respond({ error:"Could not load media order" },503);
      const index=(rows || []).findIndex(r=>r.id===id),adjacent=(rows || [])[index+direction];
      if (index<0 || !adjacent) return respond({ ok:true });
      // Normalize group order after swapping neighboring items.
      const ordered=[...(rows||[])];
      [ordered[index],ordered[index+direction]]=
        [ordered[index+direction],ordered[index]];
      for(const [i,item] of ordered.entries()){
        const {error}=await db.from(table).update({sort_order:(i+1)*10})
          .eq("id",item.id);
        if(error)return respond({ error:"Could not save order; refresh and retry" },503);
      }
      return respond({ ok:true });
    }


    // CRM and outreach are strictly separated from private form answers.
    if (action === "mailing_request") {
      const addr=email(params.email), name=str(params.name,120);
      const hash=str(params.verification_hash,64), fingerprint=str(params.fingerprint,64),
        emailFingerprint=str(params.email_fingerprint,64);
      if (!addr || !SHA256.test(hash) || !SHA256.test(fingerprint) || !SHA256.test(emailFingerprint))
        return respond({error:"Invalid subscription request"},400);
      const {data:allowed,error:rateError}=await db.rpc("camp_rise_again_claim_form_rate",{
        p_fingerprint:fingerprint,p_limit:3,p_window_seconds:3600,
      });
      if (rateError) return respond({error:"Subscription service unavailable"},503);
      if (!allowed) return respond({error:"Please try again later"},429);
      const {data:allowedEmail,error:emailRateError}=await db.rpc("camp_rise_again_claim_form_rate",{
        p_fingerprint:emailFingerprint,p_limit:2,p_window_seconds:3600,
      });
      if(emailRateError)return respond({error:"Subscription service unavailable"},503);
      if(!allowedEmail)return respond({error:"Please try again later"},429);
      const {data:existing,error:readError}=await db.from("camp_rise_again_mailing_subscribers")
        .select("status").eq("email",addr).maybeSingle();
      if (readError) return respond({error:"Subscription service unavailable"},503);
      if (existing?.status==="subscribed") return respond({ok:true,send:false});
      const {error:contactError}=await db.from("camp_rise_again_crm_contacts")
        .upsert({email:addr,display_name:name},{onConflict:"email",ignoreDuplicates:true});
      if (contactError) return respond({error:"Subscription service unavailable"},503);
      const {error:saveError}=await db.from("camp_rise_again_mailing_subscribers")
        .upsert({email:addr,status:"pending",verification_hash:hash,
          verification_sent_at:new Date().toISOString(),source:"newsletter",
          updated_at:new Date().toISOString()},{onConflict:"email"});
      return saveError?respond({error:"Subscription service unavailable"},503)
        :respond({ok:true,send:true});
    }
    if (action === "mailing_confirm") {
      const addr=email(params.email),hash=str(params.verification_hash,64);
      if (!addr || !SHA256.test(hash)) return respond({error:"Invalid confirmation link"},400);
      const {data,error}=await db.from("camp_rise_again_mailing_subscribers")
        .update({status:"subscribed",verification_hash:null,consent_at:new Date().toISOString(),
          unsubscribed_at:null,updated_at:new Date().toISOString()})
        .eq("email",addr).eq("status","pending").eq("verification_hash",hash)
        .gte("verification_sent_at",new Date(Date.now()-48*3600000).toISOString())
        .select("email").maybeSingle();
      if (error) return respond({error:"Confirmation unavailable"},503);
      return data?respond({ok:true}):respond({error:"Link expired or already used. Subscribe again."},410);
    }
    if (action === "mailing_unsubscribe") {
      // The Vercel route checks a recipient-specific HMAC link before this action.
      const addr=email(params.email);
      if (!addr) return respond({error:"Invalid email"},400);
      const {error}=await db.from("camp_rise_again_mailing_subscribers")
        .update({status:"unsubscribed",verification_hash:null,
          unsubscribed_at:new Date().toISOString(),updated_at:new Date().toISOString()})
        .eq("email",addr);
      return error?respond({error:"Unable to unsubscribe"},503):respond({ok:true});
    }
    if (action === "admin_crm_list") {
      const {data,error}=await db.from("camp_rise_again_crm_contacts")
        .select("email,display_name,phone,source_kinds,stage,tags,notes,last_engaged_at,created_at,updated_at")
        .order("last_engaged_at",{ascending:false,nullsFirst:false}).limit(500);
      if(error)return respond({error:"Unable to load contacts"},503);
      const emails=(data||[]).map(c=>c.email);
      let subscriptionRows:Json[]=[];
      if(emails.length){
        const subscription=await db.from("camp_rise_again_mailing_subscribers")
          .select("email,status,consent_at").in("email",emails);
        if(subscription.error)return respond({error:"Unable to load mailing preferences"},503);
        subscriptionRows=subscription.data||[];
      }
      const preferences=new Map(subscriptionRows.map(x=>[x.email,x]));
      const contacts=(data||[]).map(c=>({...c,
        mailing_status:preferences.get(c.email)?.status || "not_subscribed",
      }));
      const {count,error:countError}=await db.from("camp_rise_again_crm_contacts")
        .select("email",{head:true,count:"exact"});
      if(countError)return respond({error:"Unable to count contacts"},503);
      return respond({contacts,total:count||0,truncated:(count||0)>500});
    }
    if (action === "admin_crm_add") {
      const addr=email(params.email), name=str(params.display_name,160),phone=str(params.phone,40);
      if(!addr || !name)return respond({error:"Name and valid email required"},400);
      const {data,error}=await db.from("camp_rise_again_crm_contacts")
        .insert({email:addr,display_name:name,phone,source_kinds:["manual"],stage:"new"})
        .select("email").single();
      return error?respond({error:error.code==="23505"?"Contact already exists":"Unable to add contact"},
        error.code==="23505"?409:503):respond({contact:data});
    }
    if (action === "admin_crm_update") {
      const addr=email(params.email),name=str(params.display_name,160),phone=str(params.phone,40),
        stage=str(params.stage,20),notes=str(params.notes,1000);
      const tags=params.tags;
      if(!addr || !name || !["new","follow_up","active","alumni","archived"].includes(stage) ||
        !Array.isArray(tags) || tags.length>12 ||
        tags.some(x=>typeof x!=="string" || x.trim().length<1 || x.trim().length>30))
        return respond({error:"Invalid contact details"},400);
      const {data,error}=await db.from("camp_rise_again_crm_contacts").update({
        display_name:name,phone,stage,notes,tags:[...new Set(tags.map(x=>x.trim()))],
        updated_at:new Date().toISOString(),
      }).eq("email",addr).select("email").maybeSingle();
      return error?respond({error:"Unable to update contact"},503):
        data?respond({ok:true}):respond({error:"Contact not found"},404);
    }
    if (action === "admin_mailing_settings_update") {
      // Staff edit the mailing address in /admin, not environment variables.
      const rawAddress=params.postal_address;
      const address=typeof rawAddress==="string" ? rawAddress.trim() : "";
      const confirmed=params.address_confirmed===true;
      if(typeof rawAddress!=="string" || rawAddress.length>500 ||
        (address && (address.length<10 || address.length>500)) ||
        (confirmed && !address) ||
        typeof params.address_confirmed!=="boolean") {
        return respond({error:"Enter a valid organization mailing address or PO Box and confirm it."},400);
      }
      const {data,error}=await db.from("camp_rise_again_mailing_settings")
        .update({postal_address:address,address_confirmed:confirmed,
          updated_at:new Date().toISOString(),updated_by:adminEmail})
        .eq("id",1)
        .select("postal_address,address_confirmed,updated_at,updated_by").maybeSingle();
      return error?respond({error:"Unable to save mailing settings"},503):
        data?respond({settings:data,ready:data.address_confirmed && data.postal_address.length>=10}):
          respond({error:"Mailing settings not initialized. Apply the database migration."},503);
    }

    if (action === "admin_campaign_list") {
      const [campaigns,mailing,settings]=await Promise.all([
        db.from("camp_rise_again_campaigns")
          .select("id,kind,subject,body,status,created_at,updated_at,created_by,completed_at")
          .order("created_at",{ascending:false}).limit(100),
        db.from("camp_rise_again_mailing_subscribers")
          .select("email",{head:true,count:"exact"}).eq("status","subscribed"),
        db.from("camp_rise_again_mailing_settings")
          .select("postal_address,address_confirmed,updated_at,updated_by")
          .eq("id",1).maybeSingle(),
      ]);
      if(campaigns.error || mailing.error || settings.error || !settings.data)
        return respond({error:"Unable to load mailing configuration"},503);
      const mailingReady=settings.data.address_confirmed===true &&
        settings.data.postal_address.trim().length>=10;
      return respond({campaigns:campaigns.data||[],subscribers:mailing.count||0,
        mailing_settings:settings.data,mailing_ready:mailingReady});
    }
    if (action === "admin_campaign_save") {
      const id=str(params.id,64),kind=str(params.kind,20),subject=str(params.subject,150),
        body=str(params.body,12000);
      if(!["announcement","newsletter"].includes(kind) || subject.length<3 ||
        body.length<10 || typeof params.body!=="string" || params.body.length>12000)return respond({error:"Complete the announcement"},400);
      if(id){
        if(!UUID.test(id))return respond({error:"Invalid campaign"},400);
        const {data,error}=await db.from("camp_rise_again_campaigns")
          .update({kind,subject,body,updated_at:new Date().toISOString()})
          .eq("id",id).eq("status","draft").select("id").maybeSingle();
        return error?respond({error:"Unable to save draft"},503):
          data?respond({id:data.id}):respond({error:"Only drafts can be edited"},409);
      }
      const {data,error}=await db.from("camp_rise_again_campaigns")
        .insert({kind,subject,body,status:"draft",created_by:adminEmail})
        .select("id").single();
      return error?respond({error:"Unable to save draft"},503):respond({id:data.id});
    }
    if (action === "admin_campaign_begin") {
      const id=str(params.id,64);
      if(!UUID.test(id))return respond({error:"Invalid campaign"},400);
      const {data:settings,error:settingsError}=await db.from("camp_rise_again_mailing_settings")
        .select("postal_address,address_confirmed").eq("id",1).maybeSingle();
      if(settingsError)return respond({error:"Unable to check mailing settings"},503);
      if(!settings?.address_confirmed || settings.postal_address.trim().length<10)
        return respond({error:"Complete and confirm the mailing address in the admin portal before sending."},409);
      const {data:recipients,error:mailError}=await db.from("camp_rise_again_mailing_subscribers")
        .select("email").eq("status","subscribed").order("email").limit(501);
      if(mailError)return respond({error:"Unable to verify subscribers"},503);
      if(!recipients?.length)return respond({error:"No confirmed subscribers yet"},409);
      if(recipients.length>500)return respond({error:"Campaigns currently support up to 500 confirmed subscribers"},409);
      const {data:campaign,error:statusError}=await db.from("camp_rise_again_campaigns")
        .update({status:"sending",updated_at:new Date().toISOString()})
        .eq("id",id).eq("status","draft").select("id").maybeSingle();
      if(statusError)return respond({error:"Unable to queue campaign"},503);
      if(!campaign)return respond({error:"Campaign was already started. Refresh first."},409);
      const {error:queueError}=await db.from("camp_rise_again_campaign_deliveries")
        .insert(recipients.map(x=>({campaign_id:id,email:x.email,status:"pending"})));
      if(queueError){
        await db.from("camp_rise_again_campaigns").update({status:"draft"}).eq("id",id).eq("status","sending");
        return respond({error:"Unable to create campaign delivery queue"},503);
      }
      return respond({ok:true,queued:recipients.length});
    }
    if (action === "admin_campaign_claim") {
      const id=str(params.id,64);
      if(!UUID.test(id))return respond({error:"Invalid campaign"},400);
      const {data:settings,error:settingsError}=await db.from("camp_rise_again_mailing_settings")
        .select("postal_address,address_confirmed").eq("id",1).maybeSingle();
      if(settingsError)return respond({error:"Unable to check mailing settings"},503);
      if(!settings?.address_confirmed || settings.postal_address.trim().length<10)
        return respond({error:"Complete and confirm the mailing address in the admin portal before sending."},409);
      const {data,error}=await db.rpc("camp_rise_again_claim_campaign_batch",{p_campaign_id:id,p_limit:10});
      return error?respond({error:"Unable to claim deliveries"},503):
        respond({emails:(data||[]).map((x:{recipient_email:string})=>x.recipient_email)});
    }

    if (action === "admin_campaign_eligible") {
      const addr=email(params.email);
      if(!addr)return respond({error:"Invalid recipient"},400);
      const {data,error}=await db.from("camp_rise_again_mailing_subscribers")
        .select("status").eq("email",addr).maybeSingle();
      if(error)return respond({error:"Unable to check subscriber consent"},503);
      return respond({eligible:data?.status==="subscribed"});
    }
    if (action === "admin_campaign_suppress") {
      const id=str(params.id,64),addr=email(params.email);
      if(!UUID.test(id)||!addr)return respond({error:"Invalid delivery"},400);
      const {error}=await db.from("camp_rise_again_campaign_deliveries")
        .update({status:"skipped",error_code:"subscriber_opted_out"})
        .eq("campaign_id",id).eq("email",addr).eq("status","sending");
      return error?respond({error:"Unable to suppress delivery"},503):respond({ok:true});
    }

    if (action === "admin_campaign_result") {
      const id=str(params.id,64),addr=email(params.email);
      const delivered=params.delivered===true;
      if(!UUID.test(id)||!addr || typeof params.delivered!=="boolean")
        return respond({error:"Invalid delivery"},400);
      const {data,error}=await db.from("camp_rise_again_campaign_deliveries")
        .update({status:delivered?"sent":"failed",
          sent_at:delivered?new Date().toISOString():null,
          provider_id:delivered?str(params.provider_id,160):null,
          error_code:delivered?null:str(params.error_code,120)})
        .eq("campaign_id",id).eq("email",addr).eq("status","sending")
        .select("email").maybeSingle();
      return error?respond({error:"Unable to record delivery"},503):
        data?respond({ok:true}):respond({error:"Delivery no longer claimed"},409);
    }
    if (action === "admin_campaign_progress") {
      const id=str(params.id,64);
      if(!UUID.test(id))return respond({error:"Invalid campaign"},400);
      const {data:rows,error}=await db.from("camp_rise_again_campaign_deliveries")
        .select("email,status").eq("campaign_id",id).limit(501);
      if(error)return respond({error:"Unable to read progress"},503);
      // A recipient can opt out while a campaign is queued.
      const pending=(rows||[]).filter(x=>x.status==="pending");
      if(pending.length){
        const {data:confirmed}=await db.from("camp_rise_again_mailing_subscribers")
          .select("email").eq("status","subscribed").in("email",pending.map(x=>x.email));
        const subscribed=new Set((confirmed||[]).map(x=>x.email));
        const skipped=pending.filter(x=>!subscribed.has(x.email)).map(x=>x.email);
        if(skipped.length)await db.from("camp_rise_again_campaign_deliveries")
          .update({status:"skipped"}).eq("campaign_id",id).eq("status","pending").in("email",skipped);
      }
      const counts:Json={pending:0,sending:0,sent:0,failed:0,skipped:0};
      const {data:updated}=await db.from("camp_rise_again_campaign_deliveries")
        .select("status").eq("campaign_id",id).limit(501);
      for(const item of updated||[])counts[item.status]=Number(counts[item.status]||0)+1;
      const outstanding=Number(counts.pending)+Number(counts.sending);
      if(outstanding===0 && (updated||[]).length>0)
        await db.from("camp_rise_again_campaigns").update({
          status:"sent",completed_at:new Date().toISOString(),
        }).eq("id",id).eq("status","sending");
      return respond({counts,remaining:outstanding,completed:outstanding===0});
    }

    return respond({ error: "Unsupported action" }, 400);
  } catch {
    return respond({ error: "Private database operation failed" }, 503);
  }
});
