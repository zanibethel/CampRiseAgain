import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function response(payload: unknown, status=200) {
  return Response.json(payload,{status,headers:{"Cache-Control":"private, no-store"}});
}
function jwt(request: Request) {
  const v=request.headers.get("authorization") || "";
  return v.startsWith("Bearer ") && v.length<4096 ? v.slice(7):null;
}
async function parse(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  const raw=await request.text();
  if (raw.length>14000) return null;
  try {
    const v:unknown=JSON.parse(raw);
    return v && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown> : null;
  } catch { return null; }
}
function fail(error: unknown) {
  if(error instanceof CampBridgeError)
    return response({error:error.message},error.status);
  console.error("[camp-gallery-admin] request failed",error instanceof Error ? error.name:"unknown");
  return response({error:"Gallery temporarily unavailable."},503);
}
const actions = new Set([
  "admin_gallery_create_album","admin_gallery_update_album","admin_gallery_delete_album",
  "admin_gallery_prepare_upload","admin_gallery_finalize_upload",
  "admin_gallery_update_media","admin_gallery_delete_media","admin_gallery_move",
]);
export async function GET(request: Request) {
  const token=jwt(request);
  if(!token)return response({error:"Sign in to manage past camps."},401);
  try{return response(await campBridge("admin_gallery_list",{},token));}
  catch(error){return fail(error);}
}
export async function POST(request: Request) {
  const token=jwt(request);
  if(!token)return response({error:"Sign in to manage past camps."},401);
  const input=await parse(request);
  if(!input || typeof input.action!=="string" || !actions.has(input.action))
    return response({error:"Invalid gallery action."},400);
  const {action,...values}=input;
  try{return response(await campBridge(action,values,token));}
  catch(error){return fail(error);}
}
