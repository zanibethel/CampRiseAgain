import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { CAMP_INBOXES, parseAddress } from "@/lib/camp-email-helpers";
import { CampBridgeError, campBridge } from "@/lib/camp-supabase-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Forwarder = {
  id: string; email: string; display_name: string; title: string;
  inboxes: string[]; enabled: boolean; verified_at: string | null;
  created_at: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}
function jwt(request: Request): string | null {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") && value.length < 4096 ? value.slice(7) : null;
}
function errorResponse(error: unknown) {
  if (error instanceof CampBridgeError) return json({ error: error.message }, error.status);
  console.error("[camp-admin-mail] internal failure", error instanceof Error ? error.name : "unknown");
  return json({ error: "Mail settings are temporarily unavailable." }, 503);
}
function inboxes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.some(id => typeof id !== "string" || !(id in CAMP_INBOXES))) return null;
  return [...new Set(value as string[])];
}
function stringField(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(req: Request) {
  const accessToken = jwt(req);
  if (!accessToken) return json({ error: "Sign in to manage email forwarding." }, 401);
  try {
    const data = await campBridge<{ forwarders: Forwarder[] }>("admin_list", {}, accessToken);
    return json(data);
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  const accessToken = jwt(req);
  if (!accessToken) return json({ error: "Sign in to add a forwarding address." }, 401);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const address = parseAddress(input.email);
  const name = stringField(input.display_name, 100);
  const title = stringField(input.title, 120);
  const selected = inboxes(input.inboxes);
  if (!address || !name || !selected || address.endsWith("@campriseagain.org")) {
    return json({ error: "Enter an external email, full name and at least one inbox." }, 400);
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    await campBridge("admin_create", {
      email: address, display_name: name, title, inboxes: selected, tokenHash,
    }, accessToken);
    const resendKey = process.env.CAMP_RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!resendKey) return json({ error: "Address saved, but email delivery is not configured." }, 503);
    const resend = new Resend(resendKey);
    const verificationUrl = "https://campriseagain.org/api/email-forwarding/verify?token=" + token;
    const { error } = await resend.emails.send({
      from: "Camp Rise Again <info@campriseagain.org>",
      to: [address],
      subject: "Confirm your Camp Rise Again forwarding address",
      text: [
        "You were invited to receive Camp Rise Again organization emails.",
        "",
        "Your reply signature will be:",
        name, title, "",
        "Confirm this forwarding address using the link below within 24 hours:",
        verificationUrl, "",
        "If you were not expecting this invitation, please ignore it.",
      ].join("\n"),
    });
    if (error) return json({ error: "Recipient saved but verification email could not be sent. Try again." }, 502);
    return json({
      ok: true,
      message: "Verification email sent. Forwarding is disabled until the recipient confirms.",
    }, 201);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: Request) {
  const accessToken = jwt(req);
  if (!accessToken) return json({ error: "Sign in to edit forwarding." }, 401);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (typeof input.id !== "string") return json({ error: "Recipient ID is required." }, 400);
  const params: Record<string, unknown> = { id: input.id };
  for (const key of ["display_name", "title", "inboxes", "enabled"]) {
    if (key in input) params[key] = input[key];
  }
  try {
    const data = await campBridge<{ ok: boolean }>("admin_patch", params, accessToken);
    return json(data);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(req: Request) {
  const accessToken = jwt(req);
  if (!accessToken) return json({ error: "Sign in to remove forwarding." }, 401);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (typeof input.id !== "string") return json({ error: "Recipient ID is required." }, 400);
  try {
    const data = await campBridge<{ ok: boolean }>("admin_delete", { id: input.id }, accessToken);
    return json(data);
  } catch (error) { return errorResponse(error); }
}
