import { randomUUID } from "node:crypto";
import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { CAMP_INBOXES, parseAddress, safeSubject } from "@/lib/camp-email-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;
type Forwarder = { email: string; display_name: string; title: string; enabled: boolean; verified_at: string | null };
type Inbox = keyof typeof CAMP_INBOXES;
const FOLDERS = new Set(["inbox", "sent", "archive"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
function accessToken(request: Request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.length < 4096 ? auth.slice(7) : "";
}
function inboxId(input: unknown): string {
  return typeof input === "string" && Object.hasOwn(CAMP_INBOXES, input)
    ? CAMP_INBOXES[input as Inbox] : "";
}
function id(input: unknown) {
  return typeof input === "string" && UUID.test(input) ? input : "";
}
function bodyText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}
function emailFromVerifiedJwt(token: string) {
  // The bridge verifies this exact JWT against Supabase Auth and the live Camp admin directory FIRST.
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { email?: unknown };
    return parseAddress(payload.email);
  } catch { return ""; }
}
async function authorize(req: Request) {
  const token = accessToken(req);
  if (!token) throw new CampBridgeError("Sign in to manage the Camp Rise Again inbox.", 401);
  const result = await campBridge<{ forwarders: Forwarder[] }>("admin_list", {}, token);
  const email = emailFromVerifiedJwt(token);
  const own = (result.forwarders || []).find(f => f.email.toLowerCase() === email && f.enabled && f.verified_at);
  return {
    sender: email,
    signature: own?.display_name
      ? [own.display_name.trim(), own.title?.trim()].filter(Boolean).join("\n")
      : "Camp Rise Again Team",
  };
}
function providerKey() {
  const key = process.env.CAMP_RESEND_API_KEY;
  if (!key) throw new Error("Camp Resend configuration is missing.");
  return key;
}
async function resend(path: string, method = "GET", data?: Json, idempotencyKey?: string): Promise<Json> {
  const result = await fetch("https://api.resend.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + providerKey(),
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const parsed = await result.json().catch(() => ({})) as Json;
  if (!result.ok) {
    console.error("[camp-admin-inbox] provider operation failed", method, result.status);
    throw new CampBridgeError(
      result.status === 401 || result.status === 403
        ? "Camp's Resend key requires full inbox access; verify the dedicated Camp API key."
        : result.status === 429 ? "Mail provider rate limit reached. Try again shortly."
        : "The mail provider could not complete this request.",
      result.status === 429 ? 429 : 502,
    );
  }
  return parsed;
}
function pathFor(inbox: string, thread?: string, message?: string) {
  return "/inboxes/" + encodeURIComponent(inbox)
    + (thread ? "/threads/" + thread : "")
    + (message ? "/emails/" + message : "");
}
function errorResponse(error: unknown) {
  if (error instanceof CampBridgeError) return response({ error: error.message }, error.status);
  console.error("[camp-admin-inbox] internal error", error instanceof Error ? error.name : "unknown");
  return response({ error: "Camp email is temporarily unavailable." }, 503);
}

export async function GET(req: Request) {
  try {
    const admin = await authorize(req);
    const url = new URL(req.url);
    const inbox = inboxId(url.searchParams.get("inbox") || "info");
    if (!inbox) return response({ error: "Unknown Camp mailbox." }, 400);
    const view = url.searchParams.get("view") || "threads";
    const base = pathFor(inbox);
    if (view === "threads") {
      const folder = url.searchParams.get("folder") || "inbox";
      if (!FOLDERS.has(folder)) return response({ error: "Unknown folder." }, 400);
      const cursor = url.searchParams.get("after");
      if (cursor && !id(cursor)) return response({ error: "Invalid cursor." }, 400);
      const contact = url.searchParams.get("contact");
      if (contact && (!parseAddress(contact) || contact.length > 254))
        return response({ error: "Invalid contact email filter." }, 400);
      const query = new URLSearchParams({ folders: contact ? "inbox,archive,sent" : folder, limit: "30" });
      if (contact) query.set("query", contact);
      if (cursor) query.set("after", cursor);
      const result = await resend(base + (contact ? "/threads/search?" : "/threads?") + query.toString());
      return response({ ...result, signature: admin.signature, sender: admin.sender });
    }
    const thread = id(url.searchParams.get("thread"));
    if (!thread) return response({ error: "Choose a valid conversation." }, 400);
    if (view === "thread") {
      const [summary, messages] = await Promise.all([
        resend(pathFor(inbox, thread)), resend(pathFor(inbox, thread) + "/emails?limit=100"),
      ]);
      return response({ thread: summary, emails: Array.isArray(messages.data) ? messages.data : [] });
    }
    if (view === "message") {
      const message = id(url.searchParams.get("message"));
      if (!message) return response({ error: "Choose a valid message." }, 400);
      const m = await resend(pathFor(inbox, thread, message));
      // Display plain text only. Untrusted inbound HTML is NEVER inserted into the admin DOM.
      return response({
        id: m.id, from: m.from, to: m.to, reply_to: m.reply_to, subject: m.subject, direction: m.direction,
        received_at: m.received_at, text: typeof m.text === "string" ? m.text.slice(0, 50000) : "",
        attachments: Array.isArray(m.attachments) ? m.attachments.map((a: unknown) => {
          const value = a && typeof a === "object" ? a as Json : {};
          return { filename: value.filename, size: value.size };
        }) : [],
      });
    }
    return response({ error: "Unknown view." }, 400);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: Request) {
  try {
    await authorize(req);
    const input = await req.json() as Json;
    const inbox = inboxId(input.inbox);
    const thread = id(input.thread);
    if (!inbox || !thread) return response({ error: "Choose a valid conversation." }, 400);
    const changes: Json = {};
    if (typeof input.read === "boolean") changes.read = input.read;
    if (typeof input.folder === "string" && ["inbox", "archive"].includes(input.folder)) changes.folder = input.folder;
    if (!Object.keys(changes).length) return response({ error: "No supported changes." }, 400);
    return response(await resend(pathFor(inbox, thread), "PATCH", changes));
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const admin = await authorize(req);
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
      return response({ error: "JSON required." }, 415);
    const raw = await req.text();
    if (raw.length > 25000) return response({ error: "Message too long." }, 413);
    const input = JSON.parse(raw) as Json;
    if (!input || typeof input !== "object" || Array.isArray(input))
      return response({ error: "Invalid message." }, 400);
    const inbox = inboxId(input.inbox);
    const text = bodyText(input.text);
    const requestId = id(input.requestId);
    if (!inbox || !text || text.length > 12000 || !requestId)
      return response({ error: "A message and request ID are required." }, 400);
    // A real user confirmation in the admin UI precedes every send.
    const signed = text + "\n\n" + admin.signature;
    const action = input.action;
    if (action === "reply") {
      const thread = id(input.thread);
      const message = id(input.message);
      if (!thread || !message) return response({ error: "Choose the received message to reply to." }, 400);
      const original = await resend(pathFor(inbox, thread, message));
      if (original.direction !== "inbound" || !parseAddress(original.from))
        return response({ error: "Reply to an incoming message, not an outgoing message." }, 400);
      return response(await resend(pathFor(inbox, thread, message) + "/reply", "POST",
        { text: signed, reply_all: false }, "camp-admin-reply:" + requestId));
    }
    if (action === "new") {
      const recipient = parseAddress(input.to);
      const subject = bodyText(input.subject);
      if (!recipient || recipient.endsWith("@campriseagain.org") || subject.length < 3 || subject.length > 160 ||
          /[\r\n]/.test(subject)) return response({ error: "Enter a valid external recipient and subject." }, 400);
      // Create an inbox draft first, then send: this keeps the outgoing email in Resend's
      // Sent folder so later responses appear in the same thread.
      const created = await resend(pathFor(inbox) + "/drafts", "POST",
        { to: [recipient], subject: safeSubject(subject), text: signed }, "camp-admin-draft:" + requestId);
      const draft = id(created.id);
      if (!draft) throw new Error("Provider did not return a draft identifier");
      try {
        return response(await resend(pathFor(inbox) + "/drafts/" + draft + "/send", "POST",
          {}, "camp-admin-send:" + requestId));
      } catch (error) {
        // Preserve the original draft for a manual resend; never silently compose a duplicate.
        console.error("[camp-admin-inbox] unsent draft", draft);
        return response({ error: "Send not confirmed. Draft was saved in Resend; do not repeat this send until reviewed.",
          draft_id: draft }, 502);
      }
    }
    return response({ error: "Unknown action." }, 400);
  } catch (error) { return errorResponse(error); }
}
