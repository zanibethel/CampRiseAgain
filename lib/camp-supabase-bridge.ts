/**
 * Narrow Camp Rise Again email data API; no Supabase service key in Vercel.
 * The Edge Function uses its own native service key after verifying this
 * random, server-only bridge token against a SHA-256 digest in its source.
 */
const BRIDGE_URL =
  "https://yufptpfiwdbzzrvhkvux.supabase.co/functions/v1/camp-email-bridge";

export class CampBridgeError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "CampBridgeError";
  }
}

export async function campBridge<T>(
  action: string,
  params: Record<string, unknown> = {},
  userToken?: string,
): Promise<T> {
  const token = process.env.CAMP_SUPABASE_BRIDGE_TOKEN;
  if (!token) throw new CampBridgeError("Mail database connection is not configured.", 503);

  const response = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ action, params, userToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  let result: Record<string, unknown> = {};
  try {
    result = await response.json() as Record<string, unknown>;
  } catch {
    throw new CampBridgeError("Mail database service returned an invalid response.", 502);
  }
  if (!response.ok) {
    throw new CampBridgeError(
      typeof result.error === "string" ? result.error : "Mail database service unavailable.",
      response.status,
    );
  }
  return result as T;
}
