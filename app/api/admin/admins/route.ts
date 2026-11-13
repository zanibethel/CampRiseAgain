import {createHmac} from "node:crypto";
import {Resend} from "resend";
import {campBridge,CampBridgeError} from "@/lib/camp-supabase-bridge";
import {
  CAMP_AUTH_FROM,campAdminInvitationEmail,campPasswordRecoveryEmail,
} from "@/lib/camp-auth-email";
export const runtime="nodejs";
export const dynamic="force-dynamic";

type AdminMember={
  email:string; enabled:boolean; is_protected:boolean;
  added_by:string|null;created_at:string;last_invited_at:string|null;
  revoked_at:string|null;
  account_status:"not_created"|"pending_confirmation"|"verified";
};

function json(data:unknown,status=200){
  return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
}
function bearer(request:Request):string|null{
  const header=request.headers.get("authorization")||"";
  return header.startsWith("Bearer ")&&header.length<4096?header.slice(7):null;
}
function protectedOrigin(request:Request):boolean{
  return request.headers.get("origin")===new URL(request.url).origin;
}
async function body(request:Request):Promise<{email:string}|null>{
  try{
    if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")return null;
    const raw=await request.text();
    if(raw.length>560)return null;
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||
       Object.keys(parsed).some(key=>key!=="email"))return null;
    const candidate=(parsed as {email?:unknown}).email;
    if(typeof candidate!=="string")return null;
    const email=candidate.trim().toLowerCase();
    return email.length<=254&&/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email)
      ?{email}:null;
  }catch{return null;}
}
function responseError(error:unknown){
  if(error instanceof CampBridgeError)
    return json({error:error.status>=500?"Administrator management is temporarily unavailable.":error.message},error.status);
  console.error("[camp-admin-team] Request failed",error instanceof Error?error.name:"UnknownError");
  return json({error:"Administrator management is temporarily unavailable."},503);
}
async function sendInvitation(email:string,token:string){
  const secret=process.env.CAMP_SUPABASE_BRIDGE_TOKEN;
  const resendKey=process.env.CAMP_RESEND_API_KEY||process.env.RESEND_API_KEY;
  if(!secret||!resendKey)throw new CampBridgeError("Invitation delivery is not configured.",503);
  const fingerprint=createHmac("sha256",secret)
    .update("camp-team-invite:"+email).digest("hex");
  const {actionLink,linkType}=await campBridge<{actionLink:string;linkType:"invite"|"recovery"}>(
    "admin_team_invite",{email,fingerprint},token,
  );
  const letter=linkType==="invite"
    ?campAdminInvitationEmail(actionLink)
    :linkType==="recovery"
      ?campPasswordRecoveryEmail(actionLink)
      :(()=>{throw new Error("Unexpected invitation type");})();
  const {error}=await new Resend(resendKey).emails.send({
    from:CAMP_AUTH_FROM,to:[email],subject:letter.subject,text:letter.text,html:letter.html,
  });
  if(error){
    console.error("[camp-admin-team] Invitation delivery failed",error.name);
    throw new CampBridgeError("Invitation delivery failed. Try resending.",503);
  }
  try{await campBridge("admin_team_invite_sent",{email},token);}
  catch{console.error("[camp-admin-team] Sent invitation status could not be recorded.");}
}

export async function GET(request:Request){
  const token=bearer(request);
  if(!token)return json({error:"Sign in to view administrators."},401);
  try{
    if(new URL(request.url).searchParams.get("me")==="1"){
      const me=await campBridge<{email:string}>("admin_team_me",{},token);
      return json(me);
    }
    const result=await campBridge<{admins:AdminMember[];email:string}>("admin_team_list",{},token);
    return json(result);
  }catch(error){return responseError(error);}
}

export async function POST(request:Request){
  const token=bearer(request);
  if(!token)return json({error:"Sign in to add administrators."},401);
  if(!protectedOrigin(request))return json({error:"Invalid request origin."},403);
  const value=await body(request);
  if(!value)return json({error:"Enter a valid email address."},400);
  try{
    await campBridge("admin_team_add",{email:value.email},token);
    try{
      await sendInvitation(value.email,token);
      return json({ok:true,message:"Administrator approved. Invitation email sent."},201);
    }catch(error){
      // The administrator is still added; show a truthful delivery status
      // so any teammate can resend from the shared management screen.
      console.error("[camp-admin-team] New administrator saved but invitation failed",
        error instanceof Error?error.name:"UnknownError");
      return json({ok:true,invitationWarning:true,
        message:"Administrator approved, but the invitation email could not be delivered. Use Resend Invitation."},201);
    }
  }catch(error){return responseError(error);}
}

export async function PATCH(request:Request){
  const token=bearer(request);
  if(!token)return json({error:"Sign in to resend invitations."},401);
  if(!protectedOrigin(request))return json({error:"Invalid request origin."},403);
  const value=await body(request);
  if(!value)return json({error:"Enter a valid email address."},400);
  try{
    await sendInvitation(value.email,token);
    return json({ok:true,message:"A secure admin access email was sent."});
  }catch(error){return responseError(error);}
}

export async function DELETE(request:Request){
  const token=bearer(request);
  if(!token)return json({error:"Sign in to remove administrators."},401);
  if(!protectedOrigin(request))return json({error:"Invalid request origin."},403);
  const value=await body(request);
  if(!value)return json({error:"Enter a valid email address."},400);
  try{
    await campBridge("admin_team_revoke",{email:value.email},token);
    return json({ok:true,message:"Administrator access revoked. Shared Supabase account remains intact."});
  }catch(error){return responseError(error);}
}
