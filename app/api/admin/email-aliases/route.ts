import { Resend } from "resend";
import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { campAdminEmailHtml } from "@/lib/camp-admin-email-html";
import { currentCampLogoUrl } from "@/lib/camp-email-branding";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Json=Record<string,unknown>;
function reply(value:unknown,status=200){return Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
function token(req:Request){const h=req.headers.get("authorization")||"";return h.startsWith("Bearer ")&&h.length<4096?h.slice(7):"";}
function failure(e:unknown){return e instanceof CampBridgeError?reply({error:e.message},e.status):reply({error:"Custom mail temporarily unavailable"},503);}
export async function GET(req:Request){
  const t=token(req);if(!t)return reply({error:"Sign in required"},401);
  const q=new URL(req.url).searchParams;
  const local=q.get("alias");
  try{
    return reply(await campBridge(local?(q.get("id")?"admin_alias_message":"admin_alias_messages"):"admin_alias_list",
      local?{local_part:local,id:q.get("id"),folder:q.get("folder"),page:q.get("page")}: {},t));
  }catch(e){return failure(e);}
}
export async function POST(req:Request){
  const t=token(req);if(!t)return reply({error:"Sign in required"},401);
  if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return reply({error:"JSON required"},415);
  try{
    const raw=await req.text();if(raw.length>25000)return reply({error:"Request too large"},413);
    const p=JSON.parse(raw) as Json;
    if(!p||typeof p!=="object"||Array.isArray(p))return reply({error:"Invalid request"},400);
    if(p.action==="save")return reply(await campBridge("admin_alias_save",p,t));
    if(p.action==="mark")return reply(await campBridge("admin_alias_mark",p,t));
    if(p.action==="download")return reply(await campBridge("admin_alias_file",p,t));
    if(p.action==="retry_forward"){
      const key=process.env.CAMP_RESEND_API_KEY;if(!key)return reply({error:"Mail not configured"},503);
      const claim=await campBridge<{claimed:boolean;email:string;attempt:number;message:{id:string;alias:string;from_email:string;subject:string;body:string;attachment_names:string[]}}>("admin_alias_forward_retry",p,t);
      if(!claim.claimed)return reply({error:"Forwarding no longer enabled"},409);
      const m=claim.message,address=m.alias+"@campriseagain.org";
      const body=["Camp Rise Again message received at: "+address,"Original sender: "+m.from_email,"Subject: "+m.subject,"",m.body.slice(0,14000)||"(HTML message: open the original in the portal.)",
        m.attachment_names.length?"Attachments are available in the private portal; files are not included in this copy.":"",
        "Reply from the Camp Rise Again admin portal. Do not reply to this forwarded copy."].filter(Boolean).join("\n");
      let sent=false,rejected=false;
      try{
        const result=await new Resend(key).emails.send({from:"Camp Rise Again <"+address+">",to:[claim.email],subject:"[Camp Rise Again / "+m.alias+"] "+m.subject,
          text:body,html:campAdminEmailHtml(body,"Camp Rise Again Team",await currentCampLogoUrl())},
          {idempotencyKey:"camp-alias-forward:"+m.id+":"+String(p.forwarderId)+":"+claim.attempt});
        sent=!result.error&&!!result.data?.id;rejected=(result.error as {statusCode?:number}|null)?.statusCode===429;
      }finally{await campBridge("alias_forward_finish",{messageId:m.id,forwarderId:p.forwarderId,sent,rejected});}
      return sent?reply({ok:true}):reply({error:rejected?"Provider rejected the send; review delivery state.":"Delivery uncertain; do not retry until reconciled."},502);
    }
    if(p.action!=="send")return reply({error:"Unknown action"},400);
    const key=process.env.CAMP_RESEND_API_KEY;if(!key)return reply({error:"Mail not configured"},503);
    const message=await campBridge<{recipient:string;subject:string;body:string;signature:string;originalMessageId:string|null}>("admin_alias_reserve",p,t);
    const local=String(p.local_part).trim().toLowerCase();
    const address=local+"@campriseagain.org";
    const headers=message.originalMessageId&&/^<[^<>\r\n]{2,250}>$/.test(message.originalMessageId)?
      {"In-Reply-To":message.originalMessageId,"References":message.originalMessageId}:undefined;
    let providerId="";
    try{
      const result=await new Resend(key).emails.send({from:"Camp Rise Again <"+address+">",to:[message.recipient],replyTo:address,
        subject:message.subject,text:message.body+"\n\n"+message.signature,
        html:campAdminEmailHtml(message.body,message.signature,await currentCampLogoUrl()),headers},
        {idempotencyKey:"camp-alias-send:"+local+":"+String(p.request_id)});
      providerId=result.data?.id||"";
    }finally{
      await campBridge("admin_alias_finish",{local_part:local,request_id:p.request_id,provider_id:providerId},t);
    }
    return providerId?reply({ok:true}):reply({error:"Send not confirmed. Review Sent before attempting another message."},502);
  }catch(e){return failure(e);}
}
