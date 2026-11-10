import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function respond(result: unknown, status = 200) {
  return Response.json(result, { status, headers: { "Cache-Control":"private, no-store" } });
}
function tokenFrom(request: Request): string | null {
  const value = request.headers.get("authorization") || "";
  if (!value.startsWith("Bearer ") || value.length > 4096) return null;
  return value.slice(7);
}
function fail(error: unknown) {
  if (error instanceof CampBridgeError) return respond({ error:error.message }, error.status);
  console.error("[camp-faq-admin] unavailable",error instanceof Error?error.name:"unknown");
  return respond({ error:"FAQ settings are temporarily unavailable." },503);
}
async function body(request: Request): Promise<Record<string,unknown> | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  const raw=await request.text();
  if (raw.length>12000) return null;
  try {
    const v:unknown=JSON.parse(raw);
    return v && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown>:null;
  } catch { return null; }
}
export async function GET(request: Request) {
  const token=tokenFrom(request);
  if (!token) return respond({ error:"Sign in to manage FAQs." },401);
  try { return respond(await campBridge("admin_faq_list",{},token)); }
  catch(e) { return fail(e); }
}
export async function POST(request: Request) {
  const token=tokenFrom(request);
  if (!token) return respond({ error:"Sign in to manage FAQs." },401);
  const input=await body(request);
  if (!input) return respond({ error:"Invalid FAQ request." },400);
  try { return respond(await campBridge("admin_faq_create", input, token),201); }
  catch(e) { return fail(e); }
}
export async function PATCH(request: Request) {
  const token=tokenFrom(request);
  if (!token) return respond({ error:"Sign in to manage FAQs." },401);
  const input=await body(request);
  if (!input) return respond({ error:"Invalid FAQ request." },400);
  const action=input.action==="reorder" ? "admin_faq_reorder":"admin_faq_update";
  try { return respond(await campBridge(action, input, token)); }
  catch(e) { return fail(e); }
}
export async function DELETE(request: Request) {
  const token=tokenFrom(request);
  if (!token) return respond({ error:"Sign in to manage FAQs." },401);
  const input=await body(request);
  if (!input) return respond({ error:"Invalid FAQ request." },400);
  try { return respond(await campBridge("admin_faq_delete",input,token)); }
  catch(e) { return fail(e); }
}
