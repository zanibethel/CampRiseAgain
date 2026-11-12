// Built-in questions remain part of the existing intake validation.
// Admins can insert additional questions immediately after any of these fields.
export const BUILTIN_QUESTIONS = {
  camper: [
    { field_key: "firstName", label: "First name" },
    { field_key: "lastName", label: "Last name" },
    { field_key: "email", label: "Email" },
    { field_key: "phone", label: "Phone" },
    { field_key: "address1", label: "Street address" },
    { field_key: "address2", label: "Apt / unit" },
    { field_key: "city", label: "City" },
    { field_key: "state", label: "State" },
    { field_key: "postalCode", label: "ZIP code" },
    { field_key: "dateOfBirth", label: "Birthday" },
    { field_key: "shirtSize", label: "Shirt size" },
    { field_key: "season", label: "Preferred camp season" },
    { field_key: "notes", label: "Additional notes" },
  ],
  volunteer: [
    { field_key: "firstName", label: "First name" },
    { field_key: "lastName", label: "Last name" },
    { field_key: "email", label: "Email" },
    { field_key: "phone", label: "Phone" },
    { field_key: "season", label: "Preferred camp season" },
    { field_key: "roles", label: "Volunteer interests" },
    { field_key: "notes", label: "Experience and notes" },
  ],
} as const;

export type CampFormKind = keyof typeof BUILTIN_QUESTIONS;
export type OrderedField = {
  field_key: string;
  after_field: string | null;
  sort_order: number;
};

export type FieldPosition<T extends OrderedField> =
  | { type: "builtin"; field_key: string; label: string }
  | { type: "custom"; field_key: string; field: T };

/**
 * Return exactly the order public forms and the admin editor display.
 * A hidden/deleted parent or stale anchor cannot hide its children: orphaned
 * questions are shown after the last native question. Cycle protection also
 * prevents a damaged configuration from recursively crashing either screen.
 */
export function orderedCampFields<T extends OrderedField>(
  kind: CampFormKind,
  fields: readonly T[],
): FieldPosition<T>[] {
  const sorted = [...fields].sort((a, b) =>
    a.sort_order - b.sort_order || a.field_key.localeCompare(b.field_key));
  const result: FieldPosition<T>[] = [];
  const seen = new Set<string>();
  const children = new Map<string, T[]>();
  for (const field of sorted) {
    if (!field.after_field) continue;
    const siblings = children.get(field.after_field) || [];
    siblings.push(field);
    children.set(field.after_field, siblings);
  }
  function emit(field: T): void {
    if (seen.has(field.field_key)) return;
    seen.add(field.field_key);
    result.push({ type: "custom", field_key: field.field_key, field });
    for (const child of children.get(field.field_key) || []) emit(child);
  }
  for (const builtIn of BUILTIN_QUESTIONS[kind]) {
    result.push({ type: "builtin", ...builtIn });
    for (const child of children.get(builtIn.field_key) || []) emit(child);
  }
  // Legacy custom questions with no placement, inactive anchor, or a
  // misconfigured anchor remain visible and editable.
  for (const field of sorted) emit(field);
  return result;
}

/** Questions to render immediately after a native field. */
export function fieldsFollowing<T extends OrderedField>(
  positions: readonly FieldPosition<T>[],
  anchor: string,
): T[] {
  const start = positions.findIndex(x => x.type === "builtin" && x.field_key === anchor);
  if (start < 0) return [];
  const following: T[] = [];
  for (let i = start + 1; i < positions.length; i++) {
    const item = positions[i];
    if (item.type === "builtin") break;
    following.push(item.field);
  }
  return following;
}
