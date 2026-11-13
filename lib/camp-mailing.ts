import { createHmac, timingSafeEqual } from "node:crypto";

export const CAMP_MAILING_FROM = "Camp Rise Again <info@campriseagain.org>";
export const CAMP_MAILING_SITE = "https://campriseagain.org";

export function normalizedMailingEmail(input: unknown): string {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  return value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) ? value : "";
}
export function mailingSignature(email: string, secret: string): string {
  if (secret.length < 32) throw new Error("Mailing signing secret is not configured");
  const normalized = normalizedMailingEmail(email);
  if (!normalized) throw new Error("Invalid subscriber email");
  return createHmac("sha256", secret).update("camp-mailing-unsubscribe:v1:" + normalized).digest("hex");
}
export function verifyMailingSignature(email: string, token: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = mailingSignature(email, secret);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}
export function unsubscribeUrl(email: string, secret: string): string {
  return CAMP_MAILING_SITE + "/newsletter?mode=unsubscribe&email=" +
    encodeURIComponent(email) + "&token=" + mailingSignature(email, secret);
}
export function campaignEmailText(body: string, email: string, secret: string, postalAddress: string): string {
  if (postalAddress.trim().length < 5) throw new Error("Mailing address is required for campaigns");
  return body.trim() + "\n\n---\nCamp Rise Again • Men's mental health\n" +
    "You received this because you confirmed a Camp Rise Again email subscription.\n" +
    "Manage your subscription: " + unsubscribeUrl(email, secret) + "\n" +
    postalAddress.trim() + "\ncampriseagain.org\n";
}
