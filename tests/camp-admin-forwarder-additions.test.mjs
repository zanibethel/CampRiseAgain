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

test("approved new admins use Camp's protected branded sign-in endpoint", () => {
  const browser = read("app/admin/page.tsx");
  assert.ok(browser.includes('fetch("/api/admin/request-sign-in-link"'));
  assert.ok(!browser.includes("auth.signInWithOtp"));
  const api = read("app/api/admin/request-sign-in-link/route.ts");
  for (const email of admins) assert.ok(api.includes(email), "Missing approved admin: " + email);
  assert.ok(api.includes("generate_camp_signin_link"));
  const bridge = read("supabase/functions/camp-email-bridge/index.ts");
  assert.ok(bridge.includes('type: "magiclink"'));
  assert.ok(bridge.includes("ADMIN_EMAILS.has(recipient)"));
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

test("forwarding checkboxes show the matching inbox email in existing and new recipient forms", () => {
  const component = read("components/EmailForwardingAdmin.tsx");
  for (const [key, title, address] of [
    ["info", "General inquiries", "info@campriseagain.org"],
    ["volunteer", "Volunteers", "volunteer@campriseagain.org"],
    ["forms", "Website forms", "forms@campriseagain.org"],
  ]) {
    assert.ok(component.includes(`id: "${key}", label: "${title}", address: "${address}"`));
  }
  const renderedLabels = component.match(/<InboxLabel label={box.label} address={box.address} \/>/g) || [];
  assert.equal(renderedLabels.length, 2, "Both existing and new forwarding screens display the mailbox address");
  assert.match(component, /overflowWrap: "anywhere"/);
  assert.match(component, /item.inboxes.includes\(box.id\)/);
  assert.match(component, /newForwarder.inboxes.includes\(box.id\)/);
});
