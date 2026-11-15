/**
 * Branded operational messages for the Camp admin inbox (NOT marketing mail).
 * Accept only plain text from the admin composer and escape it before creating HTML.
 * Both the new-email draft and threaded replies send a text alternative.
 */
const FALLBACK_LOGO = "https://campriseagain.org/3426A745-DDB8-4CB7-8BBC-9DC68C16B20A.png";

export function campMailFallbackLogo(): string {
  return FALLBACK_LOGO;
}

export function escapeCampEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paragraphs(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map(part =>
    '<p style="margin:0 0 18px;line-height:1.65;color:#26392f;font-size:16px;">' +
    escapeCampEmailHtml(part).replace(/\n/g, "<br>") + "</p>"
  ).join("");
}

/**
 * Keep the organization's existing signature, and link its public website only.
 * The image URL must be a public HTTPS URL returned by the logo resolver.
 */
export function campAdminEmailHtml(message: string, signature: string, logoUrl = FALLBACK_LOGO): string {
  const logo = escapeCampEmailHtml(/^https:\/\//i.test(logoUrl) ? logoUrl : FALLBACK_LOGO);
  const copy = paragraphs(message);
  const signed = escapeCampEmailHtml(signature.replace(/\r\n?/g,"\n")).replace(/\n/g, "<br>");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Camp Rise Again</title></head>
<body style="margin:0;padding:0;background:#f4f6f2;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;">
<tr><td align="center" style="padding:28px 28px 24px;background:#103f32;border-radius:12px 12px 0 0;">
<img src="${logo}" alt="Camp Rise Again logo" width="104" style="width:104px;height:auto;max-width:100%;display:block;margin:0 auto 12px;background:#ffffff;border-radius:12px;">
<div style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:.3px;">Camp Rise Again</div>
<div style="font-size:12px;color:#e0e8df;line-height:1.6;margin-top:6px;">Honor the Lost. Protect the Living.</div>
</td></tr>
<tr><td style="padding:30px 32px 16px;">${copy}
<div style="border-top:1px solid #dce4dc;margin-top:28px;padding-top:18px;color:#103f32;font-size:14px;line-height:1.6;">${signed}</div>
</td></tr>
<tr><td style="padding:16px 32px 28px;color:#6b786e;font-size:12px;line-height:1.6;">
Sent through the official Camp Rise Again team inbox.<br>
<a href="https://campriseagain.org" style="color:#14523d;text-decoration:underline;">CampRiseAgain.org</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}
