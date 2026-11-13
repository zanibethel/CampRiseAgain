import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  CAMP_AUTH_FROM, CAMP_RECOVERY_GENERIC_MESSAGE, CAMP_RECOVERY_REDIRECT,
  campPasswordRecoveryEmail,
} from "@/lib/camp-auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMP_HOST = "campriseagain.org";
const SUPABASE_ORIGIN = "https://yufptpfiwdbzzrvhkvux.supabase.co";
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
  const supabaseUrl=process.env.SUPABASE_URL;
  const supabaseKey=process.env.SUPABASE_SECRET_KEY;
  const resendKey=process.env.CAMP_RESEND_API_KEY;
  if(!secret || !supabaseKey || !resendKey || supabaseUrl!==SUPABASE_ORIGIN) {
    console.error("[camp-auth] Recovery sender is missing production configuration.");
    return json({error:"Password recovery is temporarily unavailable."},503);
  }

  try {
    const supabase=createClient(supabaseUrl,supabaseKey,{
      auth:{autoRefreshToken:false,persistSession:false},
    });
    // Runtime RPC exists in the database. This repo intentionally does not
    // generate its full SQL types; narrow only this RPC's argument type.
    async function claim(key:string,max:number,windowSeconds:number):Promise<boolean> {
      const fingerprint=createHmac("sha256",secret as string).update("camp-auth-reset:"+key).digest("hex");
      const {data,error}=await supabase.rpc("camp_rise_again_claim_form_rate",{
        p_fingerprint:fingerprint,p_limit:max,p_window_seconds:windowSeconds,
      } as never);
      if(error) throw new Error("Rate limit is unavailable.");
      return data===true;
    }
    // Trust Vercel's own forwarded address, never a caller-provided client IP.
    // When missing, the common 'unknown' bucket fails closed under load.
    const ip=request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipAllowed=await claim("ip:"+ip,3,900);
    const recipientAllowed=await claim("email:"+email,5,3600);
    if(!ipAllowed || !recipientAllowed) {
      return json({error:"Too many requests. Try again later."},429);
    }
    const {data,error}=await supabase.auth.admin.generateLink({
      type:"recovery",email,options:{redirectTo:CAMP_RECOVERY_REDIRECT},
    });
    if(error || !data?.properties?.action_link) {
      console.error("[camp-auth] Unable to generate recovery link.");
      return json({error:"Password recovery is temporarily unavailable."},503);
    }
    const {subject,text}=campPasswordRecoveryEmail(data.properties.action_link);
    const {error:sendError}=await new Resend(resendKey).emails.send({
      from:CAMP_AUTH_FROM,to:[email],subject,text,
    });
    if(sendError) {
      console.error("[camp-auth] Recovery delivery failed:",sendError.name);
      return json({error:"Password recovery is temporarily unavailable."},503);
    }
    return json(confirmation);
  }catch(error){
    console.error("[camp-auth] Recovery request failed:",
      error instanceof Error ? error.name : "UnknownError");
    return json({error:"Password recovery is temporarily unavailable."},503);
  }
}
