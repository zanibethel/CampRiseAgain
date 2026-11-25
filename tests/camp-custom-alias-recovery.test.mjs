import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("retries are explicit, ACL checked, bounded and claimed once",()=>{
 const bridge=read("supabase/functions/camp-email-bridge/index.ts");
 assert.match(bridge,/admin_alias_forward_retry/);
 assert.match(bridge,/!\(await allowedAlias\(message.alias\)\)/);
 assert.match(bridge,/prior.state!=="rejected"\|\|prior.attempts>=3/);
 assert.match(bridge,/\.eq\("state","rejected"\)\.eq\("attempts",prior.attempts\)/);
 const webhook=read("app/api/webhooks/camp-email/route.ts");
 assert.match(webhook,/statusCode===429/);
 const ui=read("components/CampAliasAdmin.tsx");
 assert.match(ui,/d.state==="rejected"&&d.attempts<3/);
});
