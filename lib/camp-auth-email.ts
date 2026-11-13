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

export const CAMP_INVITE_SUBJECT = "Camp Rise Again — create your admin password";

/** Accept only one-time invitations for the exact Camp admin password setup page. */
export function validCampInvitationLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.origin === SUPABASE_AUTH_ORIGIN &&
      url.pathname === "/auth/v1/verify" &&
      url.searchParams.get("type") === "invite" &&
      !!url.searchParams.get("token") &&
      url.searchParams.get("redirect_to") === CAMP_RECOVERY_REDIRECT;
  } catch { return false; }
}

export function campAdminInvitationEmail(link: string) {
  if (!validCampInvitationLink(link)) {
    throw new Error("Invalid Camp Rise Again admin invitation link.");
  }
  return {
    subject: CAMP_INVITE_SUBJECT,
    text: [
      "Camp Rise Again — Set Up Your Admin Account",
      "",
      "You have been approved to access Camp Rise Again Admin.",
      "Use this secure, single-use link to verify your email and create a password:",
      "",
      link,
      "",
      "If you weren't expecting an invitation, ignore this message.",
      "",
      "Please Note: This is an automated email from Camp Rise Again Support.",
      "This inbox is not monitored, and replies will not receive a response.",
      "If you experience any issues or need assistance, please visit https://campriseagain.org for contact information.",
      "",
      "Thank you,",
      "Camp Rise Again Support",
    ].join("\n"),
    html: [
      '<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#14372d;">',
      '<h2>Camp Rise Again — Set Up Your Admin Account</h2>',
      '<p>You have been approved to access Camp Rise Again Admin.</p>',
      '<p>Use the secure, single-use link below to verify your email and create a password.</p>',
      `<p><a href="${escapeHtmlAttribute(link)}" style="color:#11664e;font-weight:700;text-decoration:underline;">Create Your Admin Password</a></p>`,
      "<p>If you weren't expecting an invitation, ignore this message.</p>",
      '<p>Please Note: This is an automated email from Camp Rise Again Support.<br>',
      'This inbox is not monitored, and replies will not receive a response.<br>',
      'If you need assistance, please visit <a href="https://campriseagain.org">campriseagain.org</a>.</p>',
      '<p>Thank you,<br>Camp Rise Again Support</p>',
      '</body></html>',
    ].join(""),
  };
}

export const CAMP_SIGNIN_REDIRECT = CAMP_ORIGIN + "/admin";
export const CAMP_SIGNIN_SUBJECT = "Camp Rise Again — sign in to your admin account";
export const CAMP_SIGNIN_GENERIC_MESSAGE =
  "If this is an approved Camp Rise Again admin email, check your inbox for a secure sign-in link.";

/** Supabase-generated magic links are short-lived credentials; reject all non-Camp destinations. */
export function validCampSigninLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.origin === SUPABASE_AUTH_ORIGIN &&
      url.pathname === "/auth/v1/verify" &&
      url.searchParams.get("type") === "magiclink" &&
      !!url.searchParams.get("token") &&
      url.searchParams.get("redirect_to") === CAMP_SIGNIN_REDIRECT;
  } catch { return false; }
}

export function campSigninEmail(link: string) {
  if (!validCampSigninLink(link)) throw new Error("Invalid Camp Rise Again sign-in link.");
  return {
    subject: CAMP_SIGNIN_SUBJECT,
    text: [
      "Camp Rise Again — Admin Sign-In",
      "",
      "Use this secure, single-use link to sign in to your Camp Rise Again admin account:",
      link,
      "",
      "If you didn't request this email, ignore it.",
      "",
      "This is an automated email from Camp Rise Again Support.",
      "This inbox is not monitored, and replies will not receive a response.",
      "If you need assistance, visit https://campriseagain.org for contact information.",
      "",
      "Thank you,",
      "Camp Rise Again Support",
    ].join("\n"),
    html: [
      '<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#14372d;">',
      '<h2>Camp Rise Again — Admin Sign-In</h2>',
      '<p>Use the secure, single-use link below to sign in to Camp Rise Again Admin.</p>',
      `<p><a href="${escapeHtmlAttribute(link)}" style="color:#11664e;font-weight:700;text-decoration:underline;">Sign In to Camp Rise Again</a></p>`,
      "<p>If you didn't request this email, ignore it.</p>",
      '<p>This is an automated email from Camp Rise Again Support.<br>',
      'This inbox is not monitored, and replies will not receive a response.<br>',
      'If you need assistance, visit <a href="https://campriseagain.org">campriseagain.org</a>.</p>',
      '<p>Thank you,<br>Camp Rise Again Support</p>',
      '</body></html>',
    ].join(""),
  };
}
