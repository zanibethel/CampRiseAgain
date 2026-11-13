import { createHmac } from "node:crypto";
import { Resend } from "resend";
import { CampBridgeError, campBridge } from "@/lib/camp-supabase-bridge";
import { CAMP_AUTH_FROM, CAMP_SIGNIN_GENERIC_MESSAGE, campSigninEmail } from "@/lib/camp-auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMP_HOST = "campriseagain.org";


function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const origin = new URL(request.url);
  if (process.env.VERCEL_ENV !== "production" ||
      origin.hostname !== CAMP_HOST || origin.protocol !== "https:") {
    return json({ error: "This service is only available on Camp Rise Again." }, 503);
  }
  if (request.headers.get("origin") !== origin.origin ||
      request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return json({ error: "Same-origin JSON requests only." }, 403);
  }

  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 550) return json({ error: "Request too large." }, 413);
    input = JSON.parse(body);
  } catch {
    return json({ error: "Invalid sign-in request." }, 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => key !== "email")) {
    return json({ error: "Invalid sign-in request." }, 400);
  }
  const supplied = (input as { email?: unknown }).email;
  if (typeof supplied !== "string" || supplied.length > 254 ||
      !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(supplied.trim())) {
    return json({ error: "Enter a valid email address." }, 400);
  }
  const email = supplied.trim().toLowerCase();
  const confirmation = { ok: true, message: CAMP_SIGNIN_GENERIC_MESSAGE };


  const secret = process.env.CAMP_SUPABASE_BRIDGE_TOKEN;
  const resendKey = process.env.CAMP_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!secret || !resendKey) {
    console.error("[camp-auth] Sign-in bridge or email delivery is unavailable.");
    return json({ error: "Sign-in email is temporarily unavailable." }, 503);
  }

  try {
    const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipFingerprint = createHmac("sha256", secret)
      .update("camp-auth-signin:ip:" + ip).digest("hex");
    const emailFingerprint = createHmac("sha256", secret)
      .update("camp-auth-signin:email:" + email).digest("hex");
    const { actionLink, approved } = await campBridge<{ actionLink?: string; approved: boolean }>(
      "generate_camp_signin_link", { email, ipFingerprint, emailFingerprint },
    );
    if (!approved) return json(confirmation);
    if (!actionLink) throw new Error("Missing approved sign-in link");
    const { subject, text, html } = campSigninEmail(actionLink);
    const { error: sendError } = await new Resend(resendKey).emails.send({
      from: CAMP_AUTH_FROM, to: [email], subject, text, html,
    });
    if (sendError) {
      console.error("[camp-auth] Sign-in delivery failed:", sendError.name);
      return json({ error: "Sign-in email is temporarily unavailable." }, 503);
    }
    return json(confirmation);
  } catch (error) {
    if (error instanceof CampBridgeError && error.status === 429) {
      return json({ error: "Too many requests. Try again later." }, 429);
    }
    console.error("[camp-auth] Sign-in request failed:",
      error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Sign-in email is temporarily unavailable." }, 503);
  }
}
