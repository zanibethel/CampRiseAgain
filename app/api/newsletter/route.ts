import { createHash, createHmac, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { CAMP_MAILING_FROM, CAMP_MAILING_SITE, normalizedMailingEmail,
  verifyMailingSignature } from "@/lib/camp-mailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
}
function sameOrigin(request: Request) {
  const origin=request.headers.get("origin");
  if(!origin)return true;
  try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
}
export async function POST(request: Request) {
  if(!sameOrigin(request))return reply({error:"Invalid request origin."},403);
  if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")
    return reply({error:"JSON required."},415);
  const raw=await request.text();
  if(raw.length>1800)return reply({error:"Request too large."},413);
  let input:Record<string,unknown>;
  try{
    input=JSON.parse(raw);
    if(!input || typeof input!=="object" || Array.isArray(input))throw Error();
  }catch{return reply({error:"Invalid request."},400);}
  const email=normalizedMailingEmail(input.email);
  const action=input.action;
  if(!email)return reply({error:"Enter a valid email address."},400);

  const signKey=process.env.CAMP_MAILING_SIGNING_SECRET || "";
  if(signKey.length<32)return reply({error:"Newsletter service is not configured yet."},503);
  try{
    if(action==="subscribe"){
      if(input.consent!==true)return reply({error:"Please agree to receive emails."},400);
      const key=process.env.CAMP_RESEND_API_KEY;
      if(!key)return reply({error:"Email delivery is not configured."},503);
      const rawToken=randomBytes(32).toString("hex");
      const hash=createHash("sha256").update(rawToken).digest("hex");
      const ip=(request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown")
        .split(",")[0].trim().slice(0,100);
      const fingerprint=createHmac("sha256",signKey).update("camp:newsletter-ip:"+ip).digest("hex");
      const emailFingerprint=createHmac("sha256",signKey).update("camp:newsletter-email:"+email).digest("hex");
      const result=await campBridge<{ok:boolean;send:boolean}>("mailing_request",{
        email,name:typeof input.name==="string"?input.name.trim().slice(0,120):"",
        verification_hash:hash,fingerprint,email_fingerprint:emailFingerprint,
      });
      if(result.send){
        const url=CAMP_MAILING_SITE+"/newsletter?mode=confirm&email="+encodeURIComponent(email)+
          "&token="+rawToken;
        const {error}=await new Resend(key).emails.send({
          from:CAMP_MAILING_FROM,to:[email],subject:"Confirm your Camp Rise Again email subscription",
          text:"Thanks for your interest in Camp Rise Again.\n\nPlease confirm that you want announcements and newsletters:\n"+url+
            "\n\nThis link expires after 48 hours. If you did not sign up, you can ignore this message.\n\nCamp Rise Again",
        },{idempotencyKey:"camp-mailing-confirm:"+hash.slice(0,48)});
        if(error)return reply({error:"We couldn't send the confirmation message. Please try again."},503);
      }
      return reply({ok:true,message:"If a confirmation is needed, check your inbox for a link."});
    }
    if(action==="confirm"){
      const token=typeof input.token==="string"?input.token:"";
      if(!/^[a-f0-9]{64}$/i.test(token))return reply({error:"Invalid confirmation link."},400);
      const hash=createHash("sha256").update(token).digest("hex");
      await campBridge("mailing_confirm",{email,verification_hash:hash});
      return reply({ok:true,message:"Subscription confirmed. You're on the Camp Rise Again mailing list."});
    }
    if(action==="unsubscribe"){
      const token=typeof input.token==="string"?input.token:"";
      if(!verifyMailingSignature(email,token,signKey))return reply({error:"Invalid unsubscribe link."},400);
      await campBridge("mailing_unsubscribe",{email});
      return reply({ok:true,message:"You have been unsubscribed from announcements and newsletters."});
    }
    return reply({error:"Unsupported newsletter action."},400);
  }catch(error){
    const status=error instanceof CampBridgeError?error.status:503;
    return reply({error:status===429?"Too many requests. Please try again later.":
      status===410?"This confirmation link has expired. Subscribe again to get a new one.":
      "The newsletter service is temporarily unavailable."},status);
  }
}
