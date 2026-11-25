const RESERVED = new Set(["info","volunteer","forms","support","postmaster","abuse","mailer-daemon","constructor","prototype","__proto__"]);
export function aliasLocalPart(value: unknown): string {
  if (typeof value !== "string") return "";
  const local = value.trim().toLowerCase();
  return /^[a-z][a-z0-9._-]{0,47}$/.test(local) && !local.startsWith("reply-") && !RESERVED.has(local) ? local : "";
}
export function aliasFromAddress(value: unknown): string {
  if (typeof value !== "string") return "";
  const parts = value.trim().toLowerCase().split("@");
  return parts.length === 2 && parts[1] === "campriseagain.org" ? aliasLocalPart(parts[0]) : "";
}
export function uniqueAliases(recipients: unknown): string[] {
  return Array.isArray(recipients) ? [...new Set(recipients.map(aliasFromAddress).filter(Boolean))] : [];
}
