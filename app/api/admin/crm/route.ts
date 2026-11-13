import { createHash } from "node:crypto";
import { Resend } from "resend";
import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { CAMP_MAILING_FROM, campaignEmailText } from "@/lib/camp-mailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Json = Record<string,unknown>;
type Campaign={id:string;subject:string;body:string;status:string};
function response(value:unknown,status=200) {
  return Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
}
function token(request:Request) {
  const auth=request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.length<=4096 ? auth.slice(7) : "";
}
function errorReply(error:unknown) {
  const status=error instanceof CampBridgeError?error.status:503;
  return response({error:status===403?"Only authorized Camp Rise Again admins can use the CRM.":
    status===409?"This item changed or cannot be sent yet. Refresh and try again.":
    "CRM service unavailable."},status);
}
export async function GET(request:Request) {
  const userToken=token(request);
  if(!userToken)return response({error:"Sign in first."},401);
  const view=new URL(request.url).searchParams.get("view")==="campaigns"?"campaigns":"contacts";
  try{return response(await campBridge(
    view==="campaigns"?"admin_campaign_list":"admin_crm_list",{},userToken));
  }catch(error){return errorReply(error);}
}
export async function POST(request:Request) {
  const userToken=token(request);
  if(!userToken)return response({error:"Sign in first."},401);
  if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")
    return response({error:"JSON required."},415);
  const raw=await request.text();
  if(raw.length>15000)return response({error:"Request too large."},413);
  let input:Json;
  try{
    input=JSON.parse(raw);
    if(!input||typeof input!=="object"||Array.isArray(input))throw Error();
  }catch{return response({error:"Invalid request."},400);}
  const actions:Record<string,string>={
    add_contact:"admin_crm_add",update_contact:"admin_crm_update",
    save_campaign:"admin_campaign_save",begin_campaign:"admin_campaign_begin",
  };
  const action=String(input.action||"");
  try{
    if(actions[action])return response(await campBridge(actions[action],input,userToken));
    if(action==="send_batch"){
      const id=String(input.id||"");
      if(!/^[a-f0-9-]{36}$/i.test(id))return response({error:"Invalid campaign."},400);
      const key=process.env.CAMP_RESEND_API_KEY;
      const signKey=process.env.CAMP_MAILING_SIGNING_SECRET||"";
      if(!key||signKey.length<32)return response({error:"Campaign email delivery is not configured."},503);
      const list=await campBridge<{campaigns:Campaign[]}>("admin_campaign_list",{},userToken);
      const campaign=list.campaigns.find(item=>item.id===id&&item.status==="sending");
      if(!campaign)return response({error:"Campaign must be started before sending."},409);
      const claimed=await campBridge<{emails:string[]}>("admin_campaign_claim",{id},userToken);
      const resend=new Resend(key);
      let sent=0,failed=0;
      for(const email of claimed.emails){
        const hash=createHash("sha256").update(email).digest("hex").slice(0,32);
        try{
          const {data,error}=await resend.emails.send({
            from:CAMP_MAILING_FROM,to:[email],subject:campaign.subject,
            text:campaignEmailText(campaign.body,email,signKey),
            headers:{"List-Unsubscribe":"<"+(await import("@/lib/camp-mailing")).unsubscribeUrl(email,signKey)+">"},
          },{idempotencyKey:"camp-campaign:"+id+":"+hash});
          if(error)throw Error(error.name);
          await campBridge("admin_campaign_result",{id,email,delivered:true,
            provider_id:data?.id||""},userToken);
          sent++;
        }catch(error){
          // If provider succeeded but ledger failed, its fixed idempotency key
          // protects the recipient from a duplicate on later lease recovery.
          try{await campBridge("admin_campaign_result",{id,email,delivered:false,
            error_code:error instanceof Error?error.name:"delivery_error"},userToken);}
          catch{ /* stale lease will be retried with the same provider key */ }
          failed++;
        }
      }
      const progress=await campBridge("admin_campaign_progress",{id},userToken);
      return response({sent,failed,...progress as Json});
    }
    return response({error:"Unsupported CRM action."},400);
  }catch(error){return errorReply(error);}
}
