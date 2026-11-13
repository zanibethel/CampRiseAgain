import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";
import { buildEngagementCsv } from "@/lib/camp-report-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 4096)
    return Response.json({error:"Sign in first."},{status:401});
  const kind = new URL(request.url).searchParams.get("kind") || "all";
  if (!["all","camper","volunteer","contact"].includes(kind))
    return Response.json({error:"Invalid filter."},{status:400});
  try {
    const data = await campBridge<{submissions:Record<string,unknown>[];truncated:boolean}>(
      "admin_export_submissions",{kind},authorization.slice(7));
    const csv=buildEngagementCsv(data.submissions);
    return new Response(csv,{
      headers:{"Content-Type":"text/csv; charset=utf-8",
        "Content-Disposition":'attachment; filename="camp-rise-again-'+kind+'-submissions.csv"',
        "Cache-Control":"private, no-store",
        "X-Export-Truncated":data.truncated ? "true" : "false"},
    });
  } catch(error) {
    return Response.json({error:"Unable to export submissions."},{
      status:error instanceof CampBridgeError?error.status:503,
      headers:{"Cache-Control":"private, no-store"},
    });
  }
}
