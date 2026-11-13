import { createHmac } from "node:crypto";
import { Resend } from "resend";
import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import {
  CAMP_AUTH_FROM, CAMP_RECOVERY_GENERIC_MESSAGE, CAMP_RECOVERY_REDIRECT,
  campPasswordRecoveryEmail,
} from "@/lib/camp-auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMP_HOST = "campriseagain.org";
const ADMINS = new Set(["schofieldtierra@gmail.com", "zanibethel@gmail.com"]);

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
  const origin=new URL(request.url);
  // Do not enable recovery generation on previews or alternate hostnames.
  if(process.env.VERCEL_ENV!=="production" || origin.hostname!==CAMP_HOST ||
     origin.protocol!=="https:") {
    return json({error:"This service is only available on Camp Rise Again."},503);
  }
  if(request.headers.get("origin")!==origin.origin ||
     request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json") {
    return json({error:"Same-origin JSON requests only."},403);
  }
  let input:unknown;
  try {
    const text=await request.text();
    if(text.length>550) return json({error:"Request too large."},413);
    input=JSON.parse(text);
  }catch{return json({error:"Invalid recovery request."},400);}
  if(!input || typeof input!=="object" || Array.isArray(input) ||
      Object.keys(input).some(key=>key!=="email")) {
    return json({error:"Invalid recovery request."},400);
  }
  const supplied=(input as {email?:unknown}).email;
  if(typeof supplied!=="string" || supplied.length>254 ||
     !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(supplied.trim())) {
    return json({error:"Enter a valid email address."},400);
  }
  const email=supplied.trim().toLowerCase();
  const confirmation={ok:true,message:CAMP_RECOVERY_GENERIC_MESSAGE};
  if(!ADMINS.has(email)) return json(confirmation);

  const secret=process.env.CAMP_SUPABASE_BRIDGE_TOKEN;
  const resendKey=process.env.CAMP_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if(!secret || !resendKey) {
    console.error("[camp-auth] Recovery bridge or email delivery is not configured.");
    return json({error:"Password recovery is temporarily unavailable."},503);
  }

  try {
    // Use Camp's existing hashed-bearer Supabase Edge bridge instead of
    // requiring a Supabase service key inside Vercel. The bridge has an
    // isolated, built-in service credential and enforces rate limits.
    const ip=request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipFingerprint=createHmac("sha256",secret)
      .update("camp-auth-reset:ip:"+ip).digest("hex");
    const emailFingerprint=createHmac("sha256",secret)
      .update("camp-auth-reset:email:"+email).digest("hex");
    const {actionLink}=await campBridge<{actionLink:string}>(
      "generate_camp_recovery_link",
      {email,ipFingerprint,emailFingerprint},
    );
    const {subject,text}=campPasswordRecoveryEmail(actionLink);
    const {error:sendError}=await new Resend(resendKey).emails.send({
      from:CAMP_AUTH_FROM,to:[email],subject,text,
    });
    if(sendError) {
      console.error("[camp-auth] Recovery delivery failed:",sendError.name);
      return json({error:"Password recovery is temporarily unavailable."},503);
    }
    return json(confirmation);
  }catch(error){
    if(error instanceof CampBridgeError && error.status===429) {
      return json({error:"Too many requests. Try again later."},429);
    }
    // Never log sensitive recovery URLs or recipient addresses.
    console.error("[camp-auth] Recovery request failed:",
      error instanceof Error ? error.name : "UnknownError");
    return json({error:"Password recovery is temporarily unavailable."},503);
  }
}
