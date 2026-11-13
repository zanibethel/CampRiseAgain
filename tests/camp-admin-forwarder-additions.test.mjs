import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const admins = ["schofieldtierra@gmail.com", "zanibethel@gmail.com",
  "matthias.quellenberg@gmail.com", "james.campriseagain@gmail.com"];

test("all Camp admin gates retain existing and allow newly approved addresses", () => {
  const files = [
    "app/admin/page.tsx",
    "app/admin/reset-password/page.tsx",
    "components/AdminTeamGate.tsx",
    "components/AdminGoFundMeGate.tsx",
    "app/api/admin/request-password-reset/route.ts",
    "app/api/admin/visitor-analytics/route.ts",
    "supabase/functions/camp-email-bridge/index.ts",
  ];
  for (const file of files) {
    const source = read(file);
    for (const email of admins) assert.ok(source.includes(email), file + " missing " + email);
  }
});

test("only new authorized admins can create a login on first email-link sign-in", () => {
  const source = read("app/admin/page.tsx");
  assert.match(source, /const NEW_CAMP_ADMINS = new Set\(/);
  assert.match(source, /shouldCreateUser: NEW_CAMP_ADMINS\.has\(normalized\)/);
  assert.match(source, /const normalized = authorizedEmail\(\)/);
});

test("forwarding additions remain inactive until mailbox verification", () => {
  const sql = read("supabase/migrations/20261113012500_camp_add_admins_pending_forwarders.sql");
  assert.ok(sql.includes("'matthias.quellenberg@gmail.com','Matthias Quellenberg'"));
  assert.ok(sql.includes("ARRAY['volunteer']::text[],false,NULL"));
  assert.ok(sql.includes("'james.campriseagain@gmail.com','James'"));
  assert.ok(sql.includes("ARRAY['info']::text[],false,NULL"));
  assert.match(sql,/ON CONFLICT \(email\) DO NOTHING/);
  const component = read("components/EmailForwardingAdmin.tsx");
  assert.match(component,/!item\.verified_at &&/);
  assert.match(component,/Send Verification/);
  assert.match(component,/call\("POST", \{/);
});
