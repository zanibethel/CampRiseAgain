import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const admins = ["schofieldtierra@gmail.com", "zanibethel@gmail.com",
  "matthias.quellenberg@gmail.com", "james.campriseagain@gmail.com"];

test("Camp administrator membership is shared and all gates check active directory access",()=>{
  const migration=read("supabase/migrations/20261113044000_camp_admin_management.sql");
  for(const address of admins)assert.ok(migration.includes(address),"Missing seeded admin: "+address);
  assert.ok(migration.includes("private.camp_rise_again_is_admin()"));
  const browser=read("app/admin/page.tsx");
  assert.ok(browser.includes('fetch("/api/admin/request-sign-in-link"'));
  assert.ok(browser.includes('label: "Admin Management"'));
  assert.ok(browser.includes("campAdminAllowed("));
  const bridge=read("supabase/functions/camp-email-bridge/index.ts");
  assert.ok(bridge.includes('if (action === "admin_team_add")'));
  assert.ok(bridge.includes('if (action === "admin_team_revoke")'));
  assert.ok(bridge.includes("activeCampAdmin(recipient)"));
  assert.ok(bridge.includes('type: "magiclink"'));
  for(const file of [
    "components/AdminTeamGate.tsx",
    "components/AdminGoFundMeGate.tsx",
    "app/admin/reset-password/page.tsx",
  ])assert.ok(read(file).includes("campAdminAllowed("),file+" does not check live directory");
  assert.ok(read("app/api/admin/visitor-analytics/route.ts").includes('"admin_team_me"'));
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
