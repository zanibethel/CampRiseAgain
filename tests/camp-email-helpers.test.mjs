import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMP_INBOXES, inboxFromId, isAutoResponse, mailReplyRoute,
  newReplyText, parseAddress, replySignature, safeSubject,
} from "../lib/camp-email-helpers.ts";

test("known inbox id routes to the right sender", () => {
  assert.equal(inboxFromId("1030725d-d42e-4780-9dd7-0d2fe269b778"), "info");
  assert.equal(inboxFromId("37912907-c443-4534-b6ad-dc0d7fa96224"), "volunteer");
  assert.equal(inboxFromId("1107b18f-8eba-460c-b0b6-2a65f944d905"), "forms");
  assert.equal(inboxFromId("not-an-inbox"), null);
  assert.equal(CAMP_INBOXES.info, "info@campriseagain.org");
});

test("rejects header injection, forged route domains and malformed email", () => {
  assert.equal(parseAddress("Tierra <SchofieldTierra@gmail.com>"), "schofieldtierra@gmail.com");
  assert.equal(parseAddress("victim@example.com\nBcc: evil@example.org"), "");
  assert.equal(parseAddress("No address"), "");
  assert.equal(mailReplyRoute("reply-00000000-0000-4000-8000-000000000001@other.org"), null);
  assert.equal(mailReplyRoute("info@campriseagain.org"), null);
  assert.equal(mailReplyRoute("reply-00000000-0000-4000-8000-000000000001@campriseagain.org"),
    "00000000-0000-4000-8000-000000000001");
});

test("forwards only a new reply, not quoted messages or private context", () => {
  const gmail = "Thanks for reaching out.\n\nWe can help.\n\nOn Mon, Nov 9, 2026 at 2:00 PM Someone wrote:\n> private information";
  assert.equal(newReplyText(gmail), "Thanks for reaching out.\n\nWe can help.");
  assert.equal(newReplyText("Yes\n\nFrom: Sender <sender@domain.org>\nSent: yesterday"), "Yes");
  assert.equal(newReplyText("   "), "");
  assert.equal(safeSubject("Hi\r\nBcc: injected@example.org"), "Hi Bcc: injected@example.org");
});

test("ignores automatic replies and formats named signature", () => {
  assert.equal(isAutoResponse({ "Auto-Submitted": "auto-replied" }), true);
  assert.equal(isAutoResponse({ "Precedence": "bulk" }), true);
  assert.equal(isAutoResponse({ "Auto-Submitted": "no" }), false);
  assert.equal(replySignature(" Tierra Schofield ", " Founder of CampRiseAgain "),
    "Tierra Schofield\nFounder of CampRiseAgain");
});
