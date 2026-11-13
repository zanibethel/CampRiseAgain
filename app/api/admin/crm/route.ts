import { createHash } from "node:crypto";
import { Resend } from "resend";
import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { CAMP_MAILING_FROM, campaignEmailText, unsubscribeUrl } from "@/lib/camp-mailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Json = Record<string,unknown>;
type Campaign={id:string;subject:string;body:string;status:string};
type CampaignList={campaigns:Campaign[];mailing_settings:{postal_address:string;address_confirmed:boolean};mailing_ready:boolean};
function response(value:unknown,status=200) {
  return Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
}
function token(request:Request) {
  const auth=request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.length<=4096 ? auth.slice(7) : "";
}
function errorReply(error:unknown) {
  const status=error instanceof CampBridgeError?error.status:503;
  return response({error:error instanceof CampBridgeError && (status===400 || status===409)
    ? error.message
    : status===403?"Only authorized Camp Rise Again admins can use the CRM."
    : "CRM service unavailable."},status);
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
    update_mailing_settings:"admin_mailing_settings_update",
  };
  const action=String(input.action||"");
  try{
    if(actions[action])return response(await campBridge(actions[action],input,userToken));
    if(action==="send_batch"){
      const id=String(input.id||"");
      if(!/^[a-f0-9-]{36}$/i.test(id))return response({error:"Invalid campaign."},400);
      const key=process.env.CAMP_RESEND_API_KEY;
      const signKey=process.env.CAMP_MAILING_SIGNING_SECRET||"";
      if(!key||signKey.length<32)
        return response({error:"Campaign delivery requires the Camp email credentials and signing secret."},503);
      const list=await campBridge<CampaignList>("admin_campaign_list",{},userToken);
      const postalAddress=list.mailing_settings?.postal_address||"";
      if(!list.mailing_ready || postalAddress.trim().length<10)
        return response({error:"Add and confirm the organization mailing address under Contacts & Announcements before sending."},409);
      const campaign=list.campaigns.find(item=>item.id===id&&item.status==="sending");
      if(!campaign)return response({error:"Campaign must be started before sending."},409);
      const claimed=await campBridge<{emails:string[]}>("admin_campaign_claim",{id},userToken);
      const resend=new Resend(key);
      let sent=0,failed=0;
      for(const email of claimed.emails){
        // Opt-outs take effect even if a campaign was queued earlier.
        const consent=await campBridge<{eligible:boolean}>(
          "admin_campaign_eligible",{email},userToken);
        if(!consent.eligible){
          await campBridge("admin_campaign_suppress",{id,email},userToken);
          continue;
        }
        const hash=createHash("sha256").update(email).digest("hex").slice(0,32);
        let providerId="";
        try{
          const {data,error}=await resend.emails.send({
            from:CAMP_MAILING_FROM,to:[email],subject:campaign.subject,
            text:campaignEmailText(campaign.body,email,signKey,postalAddress),
            headers:{"List-Unsubscribe":"<"+unsubscribeUrl(email,signKey)+">"},
          },{idempotencyKey:"camp-campaign:"+id+":"+hash});
          if(error)throw Error(error.name);
          providerId=data?.id||"";
        }catch(error){
          try{
            await campBridge("admin_campaign_result",{id,email,delivered:false,
              error_code:error instanceof Error?error.name:"delivery_error"},userToken);
          }catch{ /* ledger claims expire and may safely be retried */ }
          failed++;
          continue;
        }
        // If recording API acceptance fails, leave the lease intact. On
        // recovery, the same Resend idempotency key prevents duplicate mail.
        await campBridge("admin_campaign_result",{id,email,delivered:true,
          provider_id:providerId},userToken);
        sent++;
      }
      const progress=await campBridge("admin_campaign_progress",{id},userToken);
      return response({sent,failed,...progress as Json});
    }
    return response({error:"Unsupported CRM action."},400);
  }catch(error){return errorReply(error);}
}
