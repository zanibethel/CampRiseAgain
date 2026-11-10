import { createHmac, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { campBridge } from "@/lib/camp-supabase-bridge";

export type SubmissionKind = "camper" | "volunteer" | "contact";
type Forwarder = { id: string; email: string; inboxes: string[]; enabled: boolean; verified_at: string | null };

const ROUTES: Record<SubmissionKind, { inbox: "info" | "volunteer" | "forms"; address: string; label: string }> = {
  camper: { inbox: "forms", address: "forms@campriseagain.org", label: "Camper application" },
  volunteer: { inbox: "volunteer", address: "volunteer@campriseagain.org", label: "Volunteer application" },
  contact: { inbox: "info", address: "info@campriseagain.org", label: "Contact question" },
};

function rateFingerprint(request: Request, kind: SubmissionKind): string {
  const secret = process.env.CAMP_SUPABASE_BRIDGE_TOKEN;
  if (!secret) throw new Error("Bridge not configured");
  // On Vercel the platform supplies x-vercel-forwarded-for; don't accept an
  // arbitrary fingerprint from a browser or send raw IPs to the database.
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable";
  return createHmac("sha256", secret).update(kind + ":" + ip).digest("hex");
}

function validEmail(value: unknown) {
  return typeof value === "string" && value.length <= 254 &&
    /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(value.trim());
}
function safe(value: unknown, max = 100) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0,max);
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser integration requests still throttled
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function handleCampSubmission(request: Request, kind: SubmissionKind): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return Response.json({ error: "JSON is required." }, { status: 415 });
  }
  const bodyText = await request.text();
  if (bodyText.length > 14000) return Response.json({ error: "Submission is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid");
    body = parsed as Record<string,unknown>;
  } catch { return Response.json({ error: "Invalid submission." }, { status: 400 }); }

  // Honeypot. Bots that fill this invisible field will not send notifications.
  if (body.website) return Response.json({ ok: true, message: "Submission received." });
  if (!validEmail(body.email) || body.consent !== true) {
    return Response.json({ error: "Please enter a valid email and agree to the consent statement." }, { status: 400 });
  }
  const requestId = typeof body.requestId === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId)
    ? body.requestId : randomUUID();
  const receipt = ROUTES[kind];
  let id: string;
  let duplicate = false;
  try {
    const result = await campBridge<{ id: string; duplicate: boolean }>("submit_form", {
      kind, requestId, fingerprint: rateFingerprint(request,kind), fields: body,
    });
    id = result.id;
    duplicate = result.duplicate;
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" ? error.status : 503;
    const message = status === 429 ? "Too many requests. Please try again later."
      : status === 400 ? "Please review the required fields and try again."
      : "We couldn't save your submission. Please try again.";
    return Response.json({ error: message }, { status });
  }

  // A repeated HTTP request with the same ID must not double-send emails.
  if (duplicate) return Response.json({ ok: true, id, duplicate: true });
  const key = process.env.CAMP_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[camp-forms] Submission stored but sending credential unavailable.");
    return Response.json({ ok: true, id, deliveryWarning: true });
  }

  const resend = new Resend(key);
  const applicantEmail = String(body.email).trim().toLowerCase();
  const name = kind === "contact" ? safe(body.name) :
    [safe(body.firstName),safe(body.lastName)].filter(Boolean).join(" ");
  const staffSubject = "[Camp Rise Again / " + receipt.inbox + "] New " + receipt.label + " — " + id.slice(0,8);
  const summary = [
    "A new " + receipt.label.toLowerCase() + " was submitted on campriseagain.org.",
    "Reference: " + id,
    "Submitted by: " + name,
    "The full information is available only in the protected admin portal.",
    "Review: https://campriseagain.org/admin (Submissions tab)",
    "",
    "Reply in Gmail to answer the applicant from " + receipt.address + ".",
    "Do not send private camper application details in an email.",
  ].join("\n");

  let notificationFailure = false;
  try {
    const { forwarders } = await campBridge<{ forwarders: Forwarder[] }>("get_forwarders");
    const staff = forwarders.filter(f => f.inboxes.includes(receipt.inbox) &&
      f.enabled && f.verified_at && f.email.toLowerCase() !== applicantEmail);
    for (const person of staff) {
      const { routeId } = await campBridge<{ routeId: string }>("upsert_route", {
        inbound_email_id: "form:" + kind + ":" + id, forwarder_id: person.id,
        inbox_address: receipt.address, original_sender: applicantEmail,
        original_subject: receipt.label + " inquiry",
      });
      const { error } = await resend.emails.send({
        from: "Camp Rise Again <" + receipt.address + ">", to: [person.email],
        replyTo: "reply-" + routeId + "@campriseagain.org",
        subject: staffSubject,
        text: summary,
      }, { idempotencyKey: "camp-form:" + kind + ":" + id + ":" + person.id });
      if (error) {
        notificationFailure = true;
        console.error("[camp-forms] Staff notification failed", error.name);
      }
    }
    if (staff.length === 0) {
      notificationFailure = true;
      console.error("[camp-forms] No verified forwarding recipients for", kind);
    }
  } catch {
    notificationFailure = true;
    console.error("[camp-forms] Failed to queue staff notifications", kind);
  }

  const confirmation = [
    "Thank you for contacting Camp Rise Again" + (name ? ", " + name : "") + ".",
    "",
    kind === "camper"
      ? "We received your camper application. Submitting an application does not confirm a place at camp."
      : kind === "volunteer"
        ? "We received your volunteer interest form. A team member may contact you about opportunities."
        : "We received your message. Our team will review it.",
    "Your reference number: " + id,
    "",
    "If this is an emergency, call 911. In the U.S., call or text 988 for immediate mental-health crisis support.",
    "Camp Rise Again is a peer-support camp, not a crisis or clinical treatment service.",
    "",
    "Camp Rise Again",
  ].join("\n");
  const { error: confirmationError } = await resend.emails.send({
    from: "Camp Rise Again <" + receipt.address + ">",
    to: [applicantEmail],
    subject: "Camp Rise Again — " + receipt.label + " received",
    text: confirmation,
  }, { idempotencyKey: "camp-form:receipt:" + kind + ":" + id });
  if (confirmationError) {
    notificationFailure = true;
    console.error("[camp-forms] Confirmation email failed", confirmationError.name);
  }
  return Response.json({ ok: true, id, deliveryWarning: notificationFailure }, { status: 201 });
}
