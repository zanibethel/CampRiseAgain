// Export a narrow engagement dataset rather than the full intake application.
// Authorized admins explicitly requested CRM tags and private notes in CSV;
// clinical details and other private intake free-text remain excluded.
export const ENGAGEMENT_COLUMNS = [
  "kind","id","created_at","first_name","last_name","name","email",
  "phone","city","state","season_preference","volunteer_roles","topic",
  "contact_tags","contact_notes",
] as const;

export function csvCell(value: unknown): string {
  const plain = value !== null && typeof value === "object"
    ? JSON.stringify(value) : String(value ?? "");
  // Prefix dangerous spreadsheet formulas, including those after whitespace.
  const safe = /^\s*[=+@-]/.test(plain) ? "'" + plain : plain;
  return '"' + safe.replace(/"/g,'""') + '"';
}

export function buildEngagementCsv(submissions:Record<string,unknown>[]): string {
  const extraKeys = [...new Set(submissions.flatMap(item=>{
    const extras=item.extra_answers;
    return extras && typeof extras==="object" && !Array.isArray(extras)
      ? Object.keys(extras) : [];
  }))].sort();
  const fields = [...ENGAGEMENT_COLUMNS,...extraKeys.map(key=>"answer:"+key)];
  const lines = [
    fields.map(csvCell).join(","),
    ...submissions.map(item=>fields.map(field=>{
      if(field.startsWith("answer:")) {
        const answers=item.extra_answers as Record<string,unknown> | undefined;
        return csvCell(answers?.[field.slice(7)]);
      }
      return csvCell(item[field]);
    }).join(",")),
  ];
  return "\uFEFF"+lines.join("\r\n");
}

/** Private CRM export: contacts do not imply an application or mailing consent. */
export const CONTACT_COLUMNS = [
  "display_name","email","phone","stage","tags","notes","source_kinds","last_engaged_at",
] as const;

export function buildContactsCsv(contacts:Record<string,unknown>[]):string {
  return "\uFEFF"+[
    CONTACT_COLUMNS.map(csvCell).join(","),
    ...contacts.map(item=>CONTACT_COLUMNS.map(field=>csvCell(item[field])).join(",")),
  ].join("\r\n");
}
