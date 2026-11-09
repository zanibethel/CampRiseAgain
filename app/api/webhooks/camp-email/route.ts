import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  CAMP_INBOXES, inboxFromId, isAutoResponse, mailReplyRoute,
  newReplyText, parseAddress, replySignature, safeSubject,
} from "@/lib/camp-email-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Forwarder = {
  id: string; email: string; display_name: string; title: string;
  inboxes: string[]; enabled: boolean; verified_at: string | null;
};
type ReplyRoute = {
  id: string; inbox_address: string; original_sender: string;
  original_subject: string; original_message_id: string | null;
  expires_at: string; forwarder_id: string;
};

function resendClient() {
  const key = process.env.CAMP_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!key) throw new Error("Camp mail API key missing");
  return new Resend(key);
}

function sendError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // Never log the body of a camper or staff email.
  console.error("[camp-mail] provider/database failure:", message.slice(0, 200));
}

async function handleInboxEmail(
  resend: Resend,
  data: { inbox_id?: string; thread_id?: string; email_id?: string },
) {
  const inbox = inboxFromId(data.inbox_id);
  if (!inbox || !data.inbox_id || !data.thread_id || !data.email_id) return;
  const { data: received, error: fetchError } = await resend.inboxes.threads.emails.get({
    inboxId: data.inbox_id, threadId: data.thread_id, emailId: data.email_id,
  });
  if (fetchError || !received) throw fetchError || new Error("Cannot read inbox email");
  const originalSender = parseAddress(received.from);
  if (!originalSender || originalSender.endsWith("@campriseagain.org")) return;
  if (isAutoResponse(received.headers as Record<string, unknown> | undefined)) return;
  const db = getSupabaseAdmin();
  const { data: forwarders, error: readError } = await db.from("camp_rise_again_email_forwarders")
    .select("id,email,display_name,title,inboxes,enabled,verified_at")
    .eq("enabled", true).not("verified_at", "is", null);
  if (readError) throw readError;
  const message = newReplyText(received.text || "").slice(0, 20000) || "(This message has no plain-text body; view the original in the Resend inbox.)";
  const subject = safeSubject(received.subject);
  const address = CAMP_INBOXES[inbox];
  for (const staff of (forwarders || []) as Forwarder[]) {
    if (!staff.inboxes.includes(inbox) || parseAddress(staff.email) === originalSender) continue;
    const { data: route, error: routeError } = await db.from("camp_rise_again_mail_reply_routes")
      .upsert({
        inbound_email_id: data.email_id, forwarder_id: staff.id,
        inbox_address: address, original_sender: originalSender,
        original_subject: subject, original_message_id: received.message_id || null,
      }, { onConflict: "inbound_email_id,forwarder_id,inbox_address" }).select("id").single();
    if (routeError || !route) throw routeError || new Error("Cannot save reply route");
    const replyAlias = "reply-" + route.id + "@campriseagain.org";
    const forwardText = [
      "Camp Rise Again message received at: " + address,
      "Original sender: " + String(received.from).slice(0, 300),
      "Subject: " + subject,
      "",
      message,
      "",
      Array.isArray(received.attachments) && received.attachments.length
        ? "[Attachments are available in the Resend inbox; they were not attached to this forwarded copy.]"
        : "",
      "---",
      "Reply in Gmail to respond through " + address + ". Do not change the To address.",
      "Your Camp Rise Again name and title will be added automatically.",
    ].filter(Boolean).join("\n");
    const { error } = await resend.emails.send({
      from: "Camp Rise Again <" + address + ">",
      to: [staff.email],
      replyTo: replyAlias,
      subject: "[Camp Rise Again / " + inbox + "] " + subject,
      text: forwardText,
    }, {
      idempotencyKey: "camp-forward:" + createHash("sha256").update(data.email_id + ":" + staff.id).digest("hex"),
    });
    if (error) throw error;
  }
}

async function handleStaffReply(
  resend: Resend,
  data: { email_id?: string; from?: string; to?: string[] },
) {
  const emailId = data.email_id;
  if (!emailId || !Array.isArray(data.to)) return;
  const routeId = data.to.map(mailReplyRoute).find(Boolean);
  if (!routeId) return;
  const staffSender = parseAddress(data.from);
  if (!staffSender) return;
  const db = getSupabaseAdmin();
  const { data: route, error: routeError } = await db.from("camp_rise_again_mail_reply_routes")
    .select("id,inbox_address,original_sender,original_subject,original_message_id,expires_at,forwarder_id")
    .eq("id", routeId).single();
  if (routeError || !route) return;
  const target = route as ReplyRoute;
  if (new Date(target.expires_at).getTime() < Date.now()) return;
  const { data: forwarder, error: staffError } = await db.from("camp_rise_again_email_forwarders")
    .select("id,email,display_name,title,inboxes,enabled,verified_at")
    .eq("id", target.forwarder_id).single();
  if (staffError || !forwarder) return;
  const staff = forwarder as Forwarder;
  const inboxName = Object.keys(CAMP_INBOXES).find(
    key => CAMP_INBOXES[key as keyof typeof CAMP_INBOXES] === target.inbox_address,
  );
  if (!staff.enabled || !staff.verified_at || !inboxName ||
      !staff.inboxes.includes(inboxName) || staff.email !== staffSender) return;
  if (!parseAddress(target.original_sender) ||
      target.original_sender.endsWith("@campriseagain.org") ||
      staffSender === target.original_sender) return;
  const { data: received, error: fetchError } = await resend.emails.receiving.get(emailId);
  if (fetchError || !received) throw fetchError || new Error("Cannot read staff reply");
  if (parseAddress(received.from) !== staff.email ||
      isAutoResponse(received.headers as Record<string, unknown> | undefined)) return;
  const reply = newReplyText(received.text || "");
  if (!reply) return;
  const signature = replySignature(staff.display_name, staff.title);
  const replyBody = reply + (signature ? "\n\n" + signature : "");
  const headers = target.original_message_id && /^<[^<>\r\n]{2,250}>$/.test(target.original_message_id)
    ? { "In-Reply-To": target.original_message_id, "References": target.original_message_id }
    : undefined;
  const { error } = await resend.emails.send({
    from: "Camp Rise Again <" + target.inbox_address + ">",
    to: [target.original_sender],
    replyTo: target.inbox_address,
    subject: "Re: " + safeSubject(target.original_subject).replace(/^Re:\s*/i, ""),
    text: replyBody,
    headers,
  }, {
    idempotencyKey: "camp-reply:" + createHash("sha256").update(emailId).digest("hex"),
  });
  if (error) throw error;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CAMP_RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return new NextResponse("Not configured", { status: 503 });
  const raw = await req.text();
  if (raw.length > 150000) return new NextResponse("Request too large", { status: 413 });
  const resend = resendClient();
  let event: ReturnType<typeof resend.webhooks.verify>;
  try {
    event = resend.webhooks.verify({
      payload: raw,
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp: req.headers.get("svix-timestamp") || "",
        signature: req.headers.get("svix-signature") || "",
      },
      webhookSecret,
    });
  } catch {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  try {
    if (event.type === "inbox.email.received") {
      await handleInboxEmail(resend, event.data);
    } else if (event.type === "email.received") {
      await handleStaffReply(resend, event.data);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    sendError(error);
    return new NextResponse("Temporary failure", { status: 500 });
  }
}
