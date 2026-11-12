import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 4096)
    return Response.json({error:"Sign in first."},{status:401});
  try {
    const report = await campBridge("admin_form_report",{},authorization.slice(7));
    return Response.json(report,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    return Response.json({error:"Unable to load engagement report."},{
      status:error instanceof CampBridgeError ? error.status:503,
      headers:{"Cache-Control":"private, no-store"},
    });
  }
}
