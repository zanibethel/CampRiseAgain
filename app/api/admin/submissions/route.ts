import { campBridge, CampBridgeError } from "@/lib/camp-supabase-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 4096) {
    return reply({ error: "Please sign in to review submissions." }, 401);
  }
  const token = authorization.slice(7);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");

  try {
    if (kind || id) {
      if (!kind || !id) return reply({ error: "Select a submission." }, 400);
      const result = await campBridge<{ submission: Record<string, unknown> }>(
        "admin_get_submission", { kind, id }, token);
      return reply(result);
    }
    const data = await campBridge<{ submissions: Record<string,unknown>[] }>(
      "admin_list_submissions", {}, token);
    return reply(data);
  } catch (error) {
    const status = error instanceof CampBridgeError ? error.status : 503;
    return reply({ error: status === 403 ? "Only Camp Rise Again staff may view submissions." :
      "Submissions are temporarily unavailable." }, status);
  }
}
