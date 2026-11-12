import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(value: unknown): string {
  const string = typeof value === "object" && value !== null
    ? JSON.stringify(value) : String(value ?? "");
  // A downloaded CSV must not execute spreadsheet formulas from untrusted form data.
  const safe = /^\s*[=+@-]/.test(string) ? "'" + string : string;
  return '"' + safe.replace(/"/g,'""') + '"';
}
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
    const standard = ["kind","id","created_at","first_name","last_name","name","email",
      "phone","city","state","season_preference","volunteer_roles","topic",
      "address_1","address_2","postal_code","date_of_birth","shirt_size","notes","message"];
    const extras = [...new Set(data.submissions.flatMap(x=>Object.keys(
      x.extra_answers && typeof x.extra_answers === "object" && !Array.isArray(x.extra_answers)
        ? x.extra_answers as Record<string,unknown> : {})))].sort();
    const keys = [...standard,...extras.map(x=>"answer:"+x)];
    const lines = [keys.map(cell).join(","),...data.submissions.map(item=>keys.map(key=>{
      if (key.startsWith("answer:")) {
        const answers=item.extra_answers as Record<string,unknown> | undefined;
        return cell(answers?.[key.slice(7)]);
      }
      return cell(item[key]);
    }).join(","))];
    return new Response("\uFEFF"+lines.join("\r\n"),{
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
