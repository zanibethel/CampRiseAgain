import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import test from "node:test";

const api=readFileSync(new URL("../app/api/admin/inbox/route.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../components/CampInboxAdmin.tsx",import.meta.url),"utf8");
const admin=readFileSync(new URL("../app/admin/page.tsx",import.meta.url),"utf8");
const crm=readFileSync(new URL("../components/CampCRMAdmin.tsx",import.meta.url),"utf8");

test("all inbox operations verify current signed-in Camp admin through private bridge",()=>{
  assert.match(api,/const admin = await authorize\(req\)/);
  assert.match(api,/await authorize\(req\)/);
  assert.match(api,/campBridge<\{ forwarders: Forwarder\[\] \}>\("admin_list"/);
  assert.match(api,/CAMP_RESEND_API_KEY/);
  assert.doesNotMatch(api,/NEXT_PUBLIC_.*RESEND/);
});
test("inbox operations are scoped to preexisting Camp boxes and validate message ids",()=>{
  assert.match(api,/Object\.hasOwn\(CAMP_INBOXES, input\)/);
  assert.match(api,/UUID\.test\(input\)/);
  assert.match(api,/original\.direction !== "inbound"/);
  assert.match(api,/idempotencyKey/);
  assert.match(api,/camp-admin-reply:/);
  assert.match(api,/camp-admin-send:/);
});
test("inbound email bodies are treated as untrusted plain text",()=>{
  assert.match(api,/typeof m\.text === "string"/);
  assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
  assert.match(ui,/Plain text is shown/);
  assert.match(ui,/window\.confirm\(/);
});
test("admin inbox is accessible from CRM contacts and independent of newsletters",()=>{
  assert.match(admin,/id: "inbox", label: "Camp Email Inbox"/);
  assert.match(admin,/CampInboxAdmin initialTo=\{composeTo\}/);
  assert.match(crm,/Send Official Email/);
  assert.match(api,/\/drafts/);
  assert.doesNotMatch(api,/admin_campaign_begin|admin_campaign_eligible/);
});

test("ambiguous mail responses block retries until the draft is reviewed or edited",()=>{
  assert.match(ui,/sendUncertain/);
  assert.match(ui,/replyUncertain/);
  assert.match(ui,/composeRequest\.current/);
  assert.match(ui,/replyRequest\.current/);
  assert.match(ui,/Check Sent and any Resend drafts/);
  assert.match(ui,/Check this thread before attempting another reply/);
});
