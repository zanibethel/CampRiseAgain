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

// Separate namespace from native inbox relay. Reply tokens are secret capabilities.
export function customReplyToken(value: unknown): string | null {
  if(typeof value!=="string")return null;
  const m=value.trim().match(/^reply-custom-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})@campriseagain\.org$/i);
  return m?m[1].toLowerCase():null;
}
export function customReplyAddress(token: string|null|undefined): string|undefined {
  if(!token)return undefined;
  const address="reply-custom-"+token+"@campriseagain.org";
  return customReplyToken(address)?address:undefined;
}
export function customForwardInstruction(token: string|null|undefined,address:string): string {
  return customReplyAddress(token)
    ?"Reply once from your verified email to respond as "+address+". Use Reply (not Forward or Reply All). Do not share this private reply address. For further replies or attachments, use the Camp admin portal. Your Camp name and title will be added."
    :"Reply from the Camp Rise Again admin portal. Do not reply to this forwarded copy.";
}
