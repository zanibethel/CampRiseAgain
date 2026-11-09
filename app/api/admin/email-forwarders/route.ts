import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CAMP_INBOXES, parseAddress } from "@/lib/camp-email-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMINS = new Set(["schofieldtierra@gmail.com", "zanibethel@gmail.com"]);
const ALLOWED_INBOXES = Object.keys(CAMP_INBOXES);
const HEADERS = { "Cache-Control": "private, no-store" };

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: HEADERS });
}

async function admin(request: Request) {
  const token = request.headers.get("authorization") || "";
  if (!token.startsWith("Bearer ") || token.length > 4096) return null;
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.getUser(token.slice(7));
  return !error && data.user && ADMINS.has(data.user.email?.toLowerCase() || "")
    ? client : null;
}

function selectForwarders() {
  return "id,email,display_name,title,inboxes,enabled,verified_at,created_at";
}

function validInboxes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 ||
      value.some(item => typeof item !== "string" || !ALLOWED_INBOXES.includes(item))) return null;
  return [...new Set(value as string[])];
}

function textField(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(req: Request) {
  const db = await admin(req);
  if (!db) return respond({ error: "Unauthorized" }, 403);
  const { data, error } = await db.from("camp_rise_again_email_forwarders")
    .select(selectForwarders()).order("created_at", { ascending: true });
  if (error) return respond({ error: "Unable to load mail forwarding" }, 500);
  return respond({ forwarders: data });
}

export async function POST(req: Request) {
  const db = await admin(req);
  if (!db) return respond({ error: "Unauthorized" }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond({ error: "Invalid request" }, 400); }
  const email = parseAddress(body.email);
  const displayName = textField(body.display_name, 100);
  const title = textField(body.title, 120);
  const inboxes = validInboxes(body.inboxes);
  if (!email || !displayName || !inboxes || email.endsWith("@campriseagain.org")) {
    return respond({ error: "Enter a valid external email, name, and inbox selection." }, 400);
  }
  const { data: previous } = await db.from("camp_rise_again_email_forwarders")
    .select("id,verified_at").eq("email", email).maybeSingle();
  if (previous?.verified_at) return respond({ error: "That forwarding address is already verified." }, 409);
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error: databaseError } = await db.from("camp_rise_again_email_forwarders").upsert({
    email, display_name: displayName, title, inboxes,
    enabled: false, verified_at: null, verification_token_hash: tokenHash,
    verification_expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });
  if (databaseError) return respond({ error: "Unable to save forwarding address." }, 500);
  const clientKey = process.env.CAMP_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!clientKey) return respond({ error: "Mail sending is not configured." }, 503);
  const resend = new Resend(clientKey);
  const link = "https://campriseagain.org/api/email-forwarding/verify?token=" + encodeURIComponent(token);
  const { error } = await resend.emails.send({
    from: "Camp Rise Again <info@campriseagain.org>",
    to: [email],
    subject: "Verify your Camp Rise Again email forwarding address",
    text: [
      "You have been invited to receive and reply to Camp Rise Again messages.",
      "Your name and title in replies will appear as:",
      displayName, title,
      "",
      "Confirm this forwarding address within 24 hours:",
      link,
      "",
      "If you did not expect this invitation, ignore this message.",
    ].join("\n"),
  });
  if (error) return respond({ error: "Address saved, but verification could not be sent. Try adding it again." }, 502);
  return respond({ ok: true, message: "Verification email sent. Forwarding remains disabled until the recipient confirms." }, 201);
}

export async function PATCH(req: Request) {
  const db = await admin(req);
  if (!db) return respond({ error: "Unauthorized" }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond({ error: "Invalid request" }, 400); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return respond({ error: "Invalid forwarding address." }, 400);
  const { data: existing } = await db.from("camp_rise_again_email_forwarders")
    .select("verified_at").eq("id", id).maybeSingle();
  if (!existing) return respond({ error: "Forwarding address not found." }, 404);
  const change: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("display_name" in body) {
    const name = textField(body.display_name, 100);
    if (!name) return respond({ error: "Name is required." }, 400);
    change.display_name = name;
  }
  if ("title" in body) change.title = textField(body.title, 120);
  if ("inboxes" in body) {
    const inboxes = validInboxes(body.inboxes);
    if (!inboxes) return respond({ error: "Choose at least one inbox." }, 400);
    change.inboxes = inboxes;
  }
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") return respond({ error: "Invalid enabled setting." }, 400);
    if (body.enabled && !existing.verified_at) return respond({ error: "The recipient must verify their address first." }, 400);
    change.enabled = body.enabled;
  }
  const { error } = await db.from("camp_rise_again_email_forwarders").update(change).eq("id", id);
  return error ? respond({ error: "Unable to save mail forwarding settings." }, 500) : respond({ ok: true });
}

export async function DELETE(req: Request) {
  const db = await admin(req);
  if (!db) return respond({ error: "Unauthorized" }, 403);
  let body: { id?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid request" }, 400); }
  if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) return respond({ error: "Invalid forwarding address." }, 400);
  const { error } = await db.from("camp_rise_again_email_forwarders").delete().eq("id", body.id);
  return error ? respond({ error: "Unable to remove forwarding address." }, 500) : respond({ ok: true });
}
