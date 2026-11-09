import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function page(title: string, message: string, token = "") {
  const form = token
    ? '<form method="post"><input type="hidden" name="token" value="' + token +
      '"><button type="submit">Confirm email forwarding</button></form>'
    : '<a href="https://campriseagain.org">Return to Camp Rise Again</a>';
  return new Response(
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    title + '</title><style>body{font:16px system-ui;background:#f5f7f2;color:#233d32;max-width:550px;margin:12vh auto;padding:24px}main{background:white;padding:28px;border-radius:16px}button{background:#20553d;color:white;padding:14px 20px;border:0;border-radius:10px;font:inherit}a{color:#20553d}</style></head><body><main><h1>' +
    title + '</h1><p>' + message + '</p>' + form + '</main></body></html>',
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  );
}

function tokenIsValid(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!tokenIsValid(token)) return page("Link not valid", "This verification link is invalid or has expired.");
  // GET never activates forwarding: email security scanners may preview links.
  return page("Confirm Camp Rise Again forwarding",
    "Confirm that you agree to receive organization emails at this address. You may be able to reply on behalf of Camp Rise Again with the name and title assigned by its administrator.",
    token);
}

export async function POST(req: Request) {
  let token: FormDataEntryValue | null;
  try { token = (await req.formData()).get("token"); }
  catch { return page("Verification failed", "Please reopen the email verification link."); }
  if (!tokenIsValid(token)) return page("Verification failed", "That verification link is invalid.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("camp_rise_again_email_forwarders")
    .update({
      enabled: true, verified_at: new Date().toISOString(),
      verification_token_hash: null, verification_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("verification_token_hash", tokenHash)
    .is("verified_at", null)
    .gt("verification_expires_at", new Date().toISOString())
    .select("id").maybeSingle();
  if (error || !data) return page("Verification failed", "This link was already used or has expired. Ask a Camp Rise Again administrator to resend it.");
  return page("Forwarding confirmed", "Your email address is verified. Messages for the selected Camp Rise Again inboxes can now be forwarded to you.");
}
