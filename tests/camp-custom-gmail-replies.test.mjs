import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
import {customReplyToken,customReplyAddress,customForwardInstruction,aliasLocalPart} from "../lib/camp-custom-alias.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const token="f312a07a-310d-4f52-98e5-42bcd99eb110";
test("reply routes are isolated and never valid mailbox aliases",()=>{
 const address=customReplyAddress(token);
 assert.equal(customReplyToken(address),token);assert.equal(customReplyToken(address.toUpperCase()),token);
 assert.equal(customReplyToken("reply-"+token+"@campriseagain.org"),null);
 assert.equal(customReplyToken(address+".evil"),null);
 assert.equal(aliasLocalPart(address.split("@")[0]),"");
 assert.equal(customReplyAddress(null),undefined);
 assert.match(customForwardInstruction(token,"admin@campriseagain.org"),/Reply once/);
 assert.match(customForwardInstruction(null,"admin@campriseagain.org"),/admin portal/);
});
test("database uses one-time reservation and replay protection",()=>{
 const sql=read("supabase/migrations/20261125233000_camp_custom_gmail_replies.sql");
 assert.match(sql,/gmail_reply_token uuid unique/);assert.match(sql,/gmail_source_id text unique/);
 const b=read("supabase/functions/camp-email-bridge/index.ts");
 assert.match(b,/delivery.state!=="sent"/);assert.match(b,/Date.parse\(delivery.reply_expires_at\)<=Date.now\(\)/);
 assert.match(b,/!row.access_emails.includes\(sender\)/);assert.match(b,/!\(await activeCampAdmin\(sender\)\)/);
 assert.match(b,/\.eq\("email",sender\)/);assert.match(b,/gmail_reply_token:token,gmail_source_id:sourceId/);
 assert.match(b,/if\(error\?\.code==="23505"\)return respond\(\{claimed:false\}\)/);
 assert.match(b,/alias_gmail_finish/);
 assert.doesNotMatch(b,/select\("\*"\).eq\("alias",local\).eq\("id",id\)/);
});
test("relay only addresses original sender and archives before provider send",()=>{
 const w=read("app/api/webhooks/camp-email/route.ts");
 const g=w.slice(w.indexOf("async function handleCustomGmailReply"),w.indexOf("async function handleCustomAliasEmail"));
 assert.match(g,/data.to.length!==1/);assert.match(g,/parseAddress\(received.from\)!==sender/);
 assert.match(g,/isAutoResponse/);assert.match(g,/received.attachments\?\.length/);
 assert.ok(g.indexOf('"alias_gmail_reserve"')<g.indexOf('resend.emails.send'));
 assert.match(g,/to:\[result.recipient\]/);assert.match(g,/alias_gmail_finish/);
 assert.match(w,/replyTo:customReplyAddress\(claim.replyToken\)/);
});
