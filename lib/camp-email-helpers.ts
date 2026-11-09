export const CAMP_INBOXES = {
  info: "info@campriseagain.org",
  volunteer: "volunteer@campriseagain.org",
  forms: "forms@campriseagain.org",
} as const;

export type CampInbox = keyof typeof CAMP_INBOXES;

export const CAMP_INBOX_IDS: Record<string, CampInbox> = {
  "1030725d-d42e-4780-9dd7-0d2fe269b778": "info",
  "37912907-c443-4534-b6ad-dc0d7fa96224": "volunteer",
  "1107b18f-8eba-460c-b0b6-2a65f944d905": "forms",
};

const ADDRESS = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const REPLY_ALIAS = /^reply-([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})@campriseagain\.org$/i;

export function parseAddress(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/<([^<>]+)>$/);
  const email = (match ? match[1] : value).trim().toLowerCase();
  return ADDRESS.test(email) && email.length <= 254 ? email : "";
}

export function mailReplyRoute(recipient: unknown): string | null {
  const parsed = parseAddress(recipient);
  return parsed.match(REPLY_ALIAS)?.[1]?.toLowerCase() || null;
}

export function inboxFromId(id: unknown): CampInbox | null {
  return typeof id === "string" ? CAMP_INBOX_IDS[id] || null : null;
}

export function safeSubject(value: unknown): string {
  return (typeof value === "string" ? value : "Message")
    .replace(/[\r\n\t]+/g, " ").trim().slice(0, 160) || "Message";
}

// Only new plain-text reply content is relayed; exclude quoted private threads.
// Do not interpret any text as instructions, executable content, or HTML.
export function newReplyText(value: unknown): string {
  if (typeof value !== "string") return "";
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const cleaned: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Gmail on mobile can wrap the quoted-message header, putting "wrote:"
    // on the following line. Match across up to three lines before stopping.
    const quoteHeader = lines.slice(i, i + 3).join(" ").replace(/\s+/g, " ");
    const gmailQuote = /^\s*On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s].{8,300}\bwrote:\s*$/i.test(quoteHeader);
    if (/^\s*>/.test(line) || gmailQuote ||
        /^\s*On .{5,180}wrote:\s*$/i.test(line) ||
        /^\s*From:\s.+@.+$/i.test(line) ||
        /^\s*-{4,}\s*(Original Message|Forwarded Message)\s*-{4,}/i.test(line)) break;
    if (line.includes("data-smartmail")) break;
    cleaned.push(line);
  }
  return cleaned.join("\n").trim().slice(0, 20000);
}

export function isAutoResponse(headers: Record<string, unknown> | undefined): boolean {
  if (!headers) return false;
  const lowered = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()]));
  return Boolean((lowered["auto-submitted"] && lowered["auto-submitted"] !== "no") ||
      lowered["precedence"] === "bulk" || lowered["precedence"] === "list" ||
      lowered["x-autoreply"] || lowered["x-autorespond"]);
}

export function replySignature(name: string, title: string): string {
  return [name.trim(), title.trim()].filter(Boolean).join("\n");
}

export function isCampInbox(value: string): boolean {
  return Object.values(CAMP_INBOXES).includes(value as typeof CAMP_INBOXES[CampInbox]);
}
