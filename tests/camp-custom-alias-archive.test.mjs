import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("private file archive requires mailbox ACL and short-lived forced download",()=>{
 const bridge=source("supabase/functions/camp-email-bridge/index.ts");
 assert.match(bridge,/action==="admin_alias_file"/);
 assert.match(bridge,/!\(await allowedAlias\(local\)\)/);
 assert.match(bridge,/createSignedUrl\(file.object_path,60,\{download:file.filename\}\)/);
 const sql=source("supabase/migrations/20261125221500_camp_custom_email_aliases.sql");
 assert.match(sql,/'camp-private-mail','camp-private-mail',false/);
 assert.match(sql,/camp_rise_again_alias_files enable row level security/);
});
test("archive attachments before forwarding and show pending archive",()=>{
 const hook=source("app/api/webhooks/camp-email/route.ts");
 assert.ok(hook.indexOf('await campBridge("alias_archive_finish"')<hook.indexOf('const claim=await campBridge'));
 assert.match(hook,/total!==attachment.size/);
 assert.match(hook,/download.hostname!=="cdn.resend.app"/);
 const ui=source("components/CampAliasAdmin.tsx");
 assert.match(ui,/sandbox=""/);assert.match(ui,/Archive incomplete/);assert.match(ui,/Forwarding status/);
});
