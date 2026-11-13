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
export type CampaignPurpose = "community" | "commercial";
export function campaignEmailText(
  body: string, email: string, secret: string, postalAddress: string, purpose: CampaignPurpose,
): string {
  if (!["community","commercial"].includes(purpose)) throw new Error("Invalid campaign purpose");
  const address=postalAddress.trim();
  if (purpose==="commercial" && address.length<10)
    throw new Error("Confirmed mailing address required for commercial promotions");
  return (purpose==="commercial"?"Advertisement from Camp Rise Again\n\n":"") +
    body.trim() + "\n\n---\nCamp Rise Again • Men's mental health\n" +
    "You received this because you confirmed a Camp Rise Again email subscription.\n" +
    "Manage your subscription: " + unsubscribeUrl(email, secret) + "\n" +
    (address?address+"\n":"") + "campriseagain.org\n";
}
