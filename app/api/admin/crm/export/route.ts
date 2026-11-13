import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { buildContactsCsv } from "@/lib/camp-report-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request:Request){
  const authorization=request.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer ")||authorization.length>4096)
    return Response.json({error:"Sign in first."},{status:401});
  try{
    const data=await campBridge<{contacts:Record<string,unknown>[];truncated:boolean}>(
      "admin_crm_export",{},authorization.slice(7),
    );
    const csv=buildContactsCsv(data.contacts||[]);
    return new Response(csv,{headers:{
      "Content-Type":"text/csv; charset=utf-8",
      "Content-Disposition":'attachment; filename="camp-rise-again-contacts.csv"',
      "Cache-Control":"private, no-store",
      "X-Export-Truncated":data.truncated?"true":"false",
    }});
  }catch(error){
    return Response.json({error:"Unable to export contacts."},{
      status:error instanceof CampBridgeError?error.status:503,
      headers:{"Cache-Control":"private, no-store"},
    });
  }
}
