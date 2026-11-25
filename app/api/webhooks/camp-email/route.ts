import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import { uniqueAliases } from "@/lib/camp-custom-alias";
import { campBridge } from "@/lib/camp-supabase-bridge";
import { campAdminEmailHtml } from "@/lib/camp-admin-email-html";
import { currentCampLogoUrl } from "@/lib/camp-email-branding";
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
  const { forwarders } = await campBridge<{ forwarders: Forwarder[] }>("get_forwarders");
  const message = newReplyText(received.text || "").slice(0, 20000) || "(This message has no plain-text body; view the original in the Resend inbox.)";
  const subject = safeSubject(received.subject);
  const address = CAMP_INBOXES[inbox];
  const logoUrl = await currentCampLogoUrl();
  for (const staff of (forwarders || []) as Forwarder[]) {
    if (!staff.inboxes.includes(inbox) || parseAddress(staff.email) === originalSender) continue;
    const { routeId } = await campBridge<{ routeId: string }>("upsert_route", {
      inbound_email_id: data.email_id, forwarder_id: staff.id,
      inbox_address: address, original_sender: originalSender,
      original_subject: subject, original_message_id: received.message_id || null,
    });
    const replyAlias = "reply-" + routeId + "@campriseagain.org";
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
      html: campAdminEmailHtml(forwardText, "Camp Rise Again Team", logoUrl),
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
  const { result } = await campBridge<{ result: { route: ReplyRoute; staff: Forwarder } | null }>(
    "lookup_reply", { routeId, staffSender },
  );
  if (!result) return;
  const { route: target, staff } = result;
  if (new Date(target.expires_at).getTime() < Date.now()) return;
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
    html: campAdminEmailHtml(reply, signature, await currentCampLogoUrl()),
    headers,
  }, {
    idempotencyKey: "camp-reply:" + createHash("sha256").update(emailId).digest("hex"),
  });
  if (error) throw error;
}

async function handleCustomAliasEmail(resend: Resend, data: {email_id?:string;from?:string;to?:string[]}) {
  if(!data.email_id || !Array.isArray(data.to) || data.to.some(mailReplyRoute)) return;
  const candidates=uniqueAliases(data.to.map(parseAddress));
  if(!candidates.length)return;
  const enabled:string[]=[];
  for(const local of candidates){
    const result=await campBridge<{enabled:boolean}>("alias_enabled",{local_part:local});
    if(result.enabled)enabled.push(local);
  }
  if(!enabled.length)return;
  const {data:received,error}=await resend.emails.receiving.get(data.email_id);
  if(error||!received)throw error||new Error("Cannot read custom alias email");
  const sender=parseAddress(received.from);
  if(!sender||sender.endsWith("@campriseagain.org"))return;
  const original=received as unknown as {text?:string;html?:string;subject?:string;message_id?:string;attachments?:Array<{filename?:string}>;headers?:Record<string,unknown>};
  const body=original.text||"";
  const html=original.html||"";
  if(body.length>300000||html.length>500000)throw new Error("Message exceeds archive limit");
  const attachmentResponse=await resend.emails.receiving.attachments.list({emailId:data.email_id,limit:100});
  if(attachmentResponse.error||!attachmentResponse.data||attachmentResponse.data.has_more)throw new Error("Cannot enumerate attachments");
  const attachments=attachmentResponse.data.data;
  const names=attachments.map(a=>String(a.filename||"Attachment").slice(0,100));
  for(const local of enabled){
    const address=local+"@campriseagain.org";
    const result=await campBridge<{accepted:boolean;messageId:string;recipients:Array<{id:string;email:string}>}>("alias_receive",{
      local_part:local,provider_id:data.email_id,from_email:sender,subject:safeSubject(original.subject),body,html_body:html,
      message_id:original.message_id||null,attachment_names:names,suppress_forward:isAutoResponse(original.headers)
    });
    if(!result.accepted)continue;
    for(const attachment of attachments){
      const slot=await campBridge<{ready:boolean;signedUrl:string}>("alias_file_prepare",{messageId:result.messageId,attachmentId:attachment.id,filename:attachment.filename,size:attachment.size});
      if(slot.ready)continue;
      const download=new URL(attachment.download_url);
      if(download.protocol!=="https:"||download.hostname!=="cdn.resend.app")throw new Error("Unexpected attachment download host");
      const remote=await fetch(download,{redirect:"error",signal:AbortSignal.timeout(20000)});
      if(!remote.ok||!remote.body)throw new Error("Attachment download unavailable");
      const reader=remote.body.getReader();const chunks:Uint8Array[]=[];let total=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
        if(total>41943040||total>attachment.size)throw new Error("Attachment exceeds declared size");chunks.push(value);}}
      finally{await reader.cancel().catch(()=>{});}
      if(total!==attachment.size)throw new Error("Attachment size mismatch");
      const upload=new URL(slot.signedUrl);
      if(upload.protocol!=="https:"||upload.hostname!=="yufptpfiwdbzzrvhkvux.supabase.co")throw new Error("Unexpected archive host");
      const saved=await fetch(upload,{method:"PUT",headers:{"Content-Type":"application/octet-stream","Cache-Control":"max-age=0","x-upsert":"true"},body:Buffer.concat(chunks,total),redirect:"error",signal:AbortSignal.timeout(25000)});
      if(!saved.ok)throw new Error("Attachment archive failed");
      await campBridge("alias_file_finish",{messageId:result.messageId,attachmentId:attachment.id});
    }
    await campBridge("alias_archive_finish",{messageId:result.messageId,expected:attachments.length});
    for(const person of result.recipients||[]){
      const claim=await campBridge<{claimed:boolean;email:string}>("alias_forward_claim",{messageId:result.messageId,forwarderId:person.id});
      if(!claim.claimed)continue;
      const forwardText=["Camp Rise Again message received at: "+address,"Original sender: "+sender,"Subject: "+safeSubject(original.subject),"",body.slice(0,14000)||"(HTML message: open the original in the portal.)",
        names.length?"Attachments are available in the private portal; files are not included in this copy.":"",
        "Reply from the Camp Rise Again admin portal. Do not reply to this forwarded copy."].filter(Boolean).join("\n");
      let sent=false;
      try{
        const response=await resend.emails.send({from:"Camp Rise Again <"+address+">",to:[claim.email],subject:"[Camp Rise Again / "+local+"] "+safeSubject(original.subject),
          text:forwardText,html:campAdminEmailHtml(forwardText,"Camp Rise Again Team",await currentCampLogoUrl())},
          {idempotencyKey:"camp-alias-forward:"+result.messageId+":"+person.id});
        sent=!response.error;
      }finally{
        await campBridge("alias_forward_finish",{messageId:result.messageId,forwarderId:person.id,sent});
      }
    }
  }
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
      await handleCustomAliasEmail(resend, event.data);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    sendError(error);
    return new NextResponse("Temporary failure", { status: 500 });
  }
}
