import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {normalizedCampAdminEmail} from "../lib/camp-admin-email-validation.ts";

test("existing Camp admin addresses pass client-side validation",()=>{
  for(const address of [
    "zanibethel@gmail.com",
    "schofieldtierra@gmail.com",
    "matthias.quellenberg@gmail.com",
    "james.campriseagain@gmail.com",
  ]) assert.equal(normalizedCampAdminEmail(address),address);
});
test("whitespace and case are normalized without altering permissions",()=>{
  assert.equal(normalizedCampAdminEmail("  SUPPORT@Example.org  "),"support@example.org");
  assert.equal(normalizedCampAdminEmail("person+tag@example.org"),"person+tag@example.org");
});
test("malformed addresses are rejected without rejecting regular emails",()=>{
  for(const address of ["", "invalid", "foo@", "@example.com", "foo@bar", 
    "foo bar@example.com", "foo\nBCC:bar@example.com", "<foo@example.com>", 
    "x".repeat(250)+"@test.org"
  ]) assert.equal(normalizedCampAdminEmail(address),null);
});
test("admin login calls the tested shared validator",()=>{
  const path=new URL("../app/admin/page.tsx",import.meta.url);
  const page=readFileSync(path,"utf8");
  assert.match(page,/normalizedCampAdminEmail\(email\)/);
  assert.doesNotMatch(page,/!\s*\/\^\[\^@/);
});
