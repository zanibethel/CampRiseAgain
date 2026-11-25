import test from "node:test";
import assert from "node:assert/strict";
import {aliasLocalPart,aliasFromAddress,uniqueAliases} from "../lib/camp-custom-alias.ts";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("custom alias prefixes cannot shadow native, auth, relay or system mailboxes",()=>{
 for(const reserved of ["info","volunteer","forms","support","reply-abc","abuse","postmaster","constructor","__proto__","x@y","a b"])assert.equal(aliasLocalPart(reserved),"");
 assert.equal(aliasLocalPart(" Admin "),"admin");assert.equal(aliasLocalPart("finance.team"),"finance.team");
});
test("routing is domain exact and deduplicates recipients",()=>{
 assert.deepEqual(uniqueAliases(["admin@campriseagain.org","ADMIN@CAMPRISEAGAIN.ORG","admin@campriseagain.org.evil","info@campriseagain.org","reply-x@campriseagain.org","finance@campriseagain.org"]),["admin","finance"]);
 assert.equal(aliasFromAddress("admin@elsewhere.org"),"");
});
test("database mail tables deny direct public access and deduplicate received messages",()=>{
 const sql=source("supabase/migrations/20261125221500_camp_custom_email_aliases.sql");
 assert.match(sql,/unique\(alias,provider_id\)/);assert.match(sql,/unique\(alias,request_id\)/);
 assert.match(sql,/enable row level security/);assert.match(sql,/from public,anon,authenticated/);
});
test("bridge scopes private mailbox actions and requires verified forwarders",()=>{
 const bridge=source("supabase/functions/camp-email-bridge/index.ts");
 assert.match(bridge,/row\.access_emails\.includes\(adminEmail\)/);
 assert.match(bridge,/!row\) return respond\(\{error:"Mailbox not found"\}/);
 assert.match(bridge,/alias_forward_claim/);
 assert.match(bridge,/\.eq\("enabled",true\)\.not\("verified_at","is",null\)/);
});
test("webhook uses signature verification before archive and keeps reply aliases separate",()=>{
 const webhook=source("app/api/webhooks/camp-email/route.ts");
 assert.match(webhook,/data\.to\.some\(mailReplyRoute\)/);
 assert.match(webhook,/resend\.webhooks\.verify/);
 assert.match(webhook,/await handleCustomAliasEmail\(resend, event\.data\)/);
 assert.match(webhook,/alias_receive/);
});
