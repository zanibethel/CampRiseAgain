import assert from "node:assert/strict";
import test from "node:test";
import { normalizedMailingEmail, mailingSignature, verifyMailingSignature,
  unsubscribeUrl, campaignEmailText } from "../lib/camp-mailing.ts";

const secret="absolutely-not-a-real-secret-this-is-a-test-value-123";
test("newsletter email normalization rejects malformed addresses",()=>{
  assert.equal(normalizedMailingEmail("  Visitor@Example.com "), "visitor@example.com");
  assert.equal(normalizedMailingEmail("person\nBCC:bad@example.com"), "");
  assert.equal(normalizedMailingEmail("invalid"), "");
});
test("unsubscribe token is scoped to the address and compares safely",()=>{
  const token=mailingSignature("visitor@example.com",secret);
  assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal(verifyMailingSignature("visitor@example.com",token,secret),true);
  assert.equal(verifyMailingSignature("other@example.com",token,secret),false);
  assert.equal(verifyMailingSignature("visitor@example.com","bad",secret),false);
  assert.throws(()=>mailingSignature("visitor@example.com","short"),/secret/);
});
test("noncommercial community newsletters send without physical address",()=>{
  const message=campaignEmailText("Our next camp date has been announced.",
    "visitor@example.com",secret,"","community");
  assert.match(message,/Our next camp date/);
  assert.match(message,/confirmed a Camp Rise Again email subscription/);
  assert.match(message,/mode=unsubscribe/);
  assert.ok(message.includes(unsubscribeUrl("visitor@example.com",secret)));
  assert.doesNotMatch(message,/Advertisement/);
});
test("commercial promotions require a valid organization postal address",()=>{
  assert.throws(()=>campaignEmailText("New sale","visitor@example.com",secret,
    "","commercial"),/address/);
  const message=campaignEmailText("New sale","visitor@example.com",secret,
    "Camp Rise Again, PO Box 123, TX 75001","commercial");
  assert.match(message,/Advertisement from Camp Rise Again/);
  assert.match(message,/PO Box 123/);
  assert.match(message,/mode=unsubscribe/);
  assert.throws(()=>campaignEmailText("Hi","visitor@example.com",secret,
    "","unclassified"),/purpose/);
});
