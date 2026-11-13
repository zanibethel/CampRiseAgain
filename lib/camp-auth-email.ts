const CAMP_ORIGIN = "https://campriseagain.org";
const SUPABASE_AUTH_ORIGIN = "https://yufptpfiwdbzzrvhkvux.supabase.co";
export const CAMP_RECOVERY_REDIRECT = CAMP_ORIGIN + "/admin/reset-password";
export const CAMP_AUTH_FROM = "Camp Rise Again Support <support@campriseagain.org>";
export const CAMP_RECOVERY_SUBJECT = "Camp Rise Again — reset your admin password";
export const CAMP_RECOVERY_GENERIC_MESSAGE =
  "If this admin account is registered, check your inbox for a Camp Rise Again password-reset link.";

/**
 * Use only Supabase's freshly generated one-time recovery action URL.
 * Never echo, persist, or log this URL: it is a short-lived credential.
 */
export function validCampRecoveryLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.origin === SUPABASE_AUTH_ORIGIN &&
      url.pathname === "/auth/v1/verify" &&
      url.searchParams.get("type") === "recovery" &&
      !!url.searchParams.get("token") &&
      url.searchParams.get("redirect_to") === CAMP_RECOVERY_REDIRECT;
  } catch { return false; }
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");
}

export function campPasswordRecoveryEmail(link: string) {
  if (!validCampRecoveryLink(link)) {
    throw new Error("Invalid Camp Rise Again recovery link.");
  }
  return {
    subject: CAMP_RECOVERY_SUBJECT,
    text: [
      "Camp Rise Again — Admin Password Reset",
      "",
      "We received a request to create or reset your Camp Rise Again admin password.",
      "Use the secure, single-use link below to choose a new password:",
      "",
      link,
      "",
      "If you did not request this, ignore this email. Your existing password will remain unchanged.",
      "",
      "Please Note: This is an automated email from Camp Rise Again Support.",
      "This inbox is not monitored, and replies will not receive a response.",
      "If you experience any issues or need assistance, please visit https://campriseagain.org for contact information.",
      "",
      "Thank you,",
      "Camp Rise Again Support",
    ].join("\n"),
    // The text version remains available for plain-text-only mail clients.
    // Gmail and other HTML-capable clients display the short link label,
    // never the long one-time Supabase URL as visible message text.
    html: [
      '<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#14372d;">',
      '<h2>Camp Rise Again — Admin Password Reset</h2>',
      '<p>We received a request to create or reset your Camp Rise Again admin password.</p>',
      '<p>Use the secure, single-use link below to choose a new password:</p>',
      `<p><a href="${escapeHtmlAttribute(link)}" style="color:#11664e;font-weight:700;text-decoration:underline;">Click here to reset</a></p>`,
      '<p>If you did not request this, ignore this email. Your existing password will remain unchanged.</p>',
      '<p>Please Note: This is an automated email from Camp Rise Again Support.<br>',
      'This inbox is not monitored, and replies will not receive a response.<br>',
      'If you experience any issues or need assistance, please visit ',
      '<a href="https://campriseagain.org">campriseagain.org</a> for contact information.</p>',
      '<p>Thank you,<br>Camp Rise Again Support</p>',
      '</body></html>',
    ].join(""),
  };
}
