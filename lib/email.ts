import { Resend } from "resend";

export async function sendSubmissionEmail({ subject, html }: { subject: string; html: string; }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FORM_RECIPIENT_EMAIL;
  const from = process.env.FORM_FROM_EMAIL;
  if (!apiKey || !to || !from) { console.warn("Email not sent: Resend environment variables are incomplete."); return { skipped: true }; }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(error.message);
  return { skipped: false };
}

export function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
