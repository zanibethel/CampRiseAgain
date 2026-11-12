import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "camper" && kind !== "volunteer") {
    return Response.json({error:"Select a valid form."},{status:400});
  }
  try {
    const result = await campBridge<{fields: unknown[]}>("get_form_fields",{kind});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    return Response.json({error:"Additional questions are temporarily unavailable."},{
      status:error instanceof CampBridgeError ? error.status : 503,
      headers:{"Cache-Control":"no-store"},
    });
  }
}
