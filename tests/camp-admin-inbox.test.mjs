import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import test from "node:test";
import { campAdminEmailHtml, campMailFallbackLogo } from "../lib/camp-admin-email-html.ts";

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
test("incoming HTML is confined to a script-disabled sandbox with remote images off by default",()=>{
  assert.match(api,/typeof m\.html === "string"/);
  assert.match(ui,/sandbox=""/);
  assert.match(ui,/referrerPolicy="no-referrer"/);
  assert.match(ui,/srcDoc=\{htmlPreview\}/);
  assert.match(ui,/default-src 'none'/);
  assert.match(ui,/script-src 'none'/);
  assert.match(ui,/form-action 'none'/);
  assert.match(ui,/loadRemoteImages\?"https: data:":"data:"/);
  assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
  assert.match(ui,/window\.confirm\(/);
});
test("all admin replies and new drafts send both safe HTML and plain text",()=>{
  assert.match(api,/campAdminEmailHtml\(text, admin\.signature/);
  assert.match(api,/\{ text: signed, html, reply_all: false \}/);
  assert.match(api,/text: signed, html \}/);
  assert.match(api,/select\("logo_path"\)/);
  assert.match(api,/camp-rise-again-branding/);
});
test("HTML email escapes untrusted message and signature text, preserving paragraphs",()=>{
  const html=campAdminEmailHtml('<script>alert("hello")</script>\n\nHello & goodbye','Zac <Support>\nCamp Team','https://campriseagain.org/logo.png');
  assert.match(html,/Camp Rise Again/);
  assert.match(html,/src="https:\/\/campriseagain\.org\/logo\.png"/);
  assert.match(html,/&lt;script&gt;alert\(&quot;hello&quot;\)&lt;\/script&gt;/);
  assert.match(html,/Hello &amp; goodbye/);
  assert.match(html,/Zac &lt;Support&gt;<br>Camp Team/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/<p style=/);
  assert.match(campAdminEmailHtml("hi","Team","javascript:alert(1)"),new RegExp(campMailFallbackLogo().replace(/[.*+?^\$\{\}()|[\]\\]/g,"\\test("inbound email bodies are treated as untrusted plain text",()=>{
  assert.match(api,/typeof m\.text === "string"/);
  assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
  assert.match(ui,/Plain text is shown/);
  assert.match(ui,/window\.confirm\(/);
});")));
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
