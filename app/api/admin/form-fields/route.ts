import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function response(value: unknown, status = 200) {
  return Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
}
function tokenFor(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") && authorization.length <= 4096
    ? authorization.slice(7) : null;
}
export async function GET(request: Request) {
  const token = tokenFor(request);
  if (!token) return response({error:"Sign in first."},401);
  try {
    return response(await campBridge("admin_field_list",{},token));
  } catch (error) {
    return response({error:"Unable to retrieve questions."},error instanceof CampBridgeError ? error.status:503);
  }
}
async function mutate(request: Request, action: "admin_field_create" | "admin_field_update") {
  const token = tokenFor(request);
  if (!token) return response({error:"Sign in first."},401);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return response({error:"JSON required."},415);
  const raw = await request.text();
  if (raw.length > 7000) return response({error:"Question too large."},413);
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return response({error:"Invalid question."},400);
    return response(await campBridge(action,body as Record<string,unknown>,token));
  } catch(error) {
    return response({error:error instanceof CampBridgeError && error.status === 409 ?
      "The question has changed. Refresh and try again." : "Unable to save question."},
      error instanceof CampBridgeError ? error.status:400);
  }
}
export async function POST(request: Request) { return mutate(request,"admin_field_create"); }
export async function PATCH(request: Request) { return mutate(request,"admin_field_update"); }
