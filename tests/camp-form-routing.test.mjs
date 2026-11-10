import assert from "node:assert/strict";
import test from "node:test";
import { FORM_MAILBOX, resolveFormMailbox, staffFormNotice, applicantReceipt } from "../lib/camp-form-routing.ts";

test("each web form uses its respective Camp Rise Again sender and forwarding inbox", () => {
  assert.deepEqual(FORM_MAILBOX.camper, { inbox: "forms", address: "forms@campriseagain.org", label: "Camper application" });
  assert.deepEqual(FORM_MAILBOX.volunteer, { inbox: "volunteer", address: "volunteer@campriseagain.org", label: "Volunteer application" });
  assert.deepEqual(FORM_MAILBOX.contact, { inbox: "info", address: "info@campriseagain.org", label: "Contact question" });
});

test("staff notifications contain only reference and safe summary, never private form answers", () => {
  const id = "c4d628ee-51d4-4d86-9a77-bd9f563ca0ed";
  const notice = staffFormNotice("camper", id, "Sample Applicant");
  assert.match(notice, /New camper application/);
  assert.ok(notice.includes(id));
  assert.ok(notice.includes("https://campriseagain.org/admin"));
  assert.ok(notice.includes("forms@campriseagain.org"));
  assert.ok(!notice.includes("Birthday:"));
  assert.ok(!notice.includes("Address:"));
  assert.ok(!notice.includes("Medical:"));
  assert.ok(!notice.includes("Notes:"));
});

test("confirmation is appropriate but never promises placement or an instant response", () => {
  const message = applicantReceipt("camper", "sample-id", "Sample");
  assert.ok(message.includes("does not confirm a place"));
  assert.ok(message.includes("988"));
  const volunteer = applicantReceipt("volunteer", "sample-id", "Sample");
  assert.ok(volunteer.includes("volunteer interest form"));
});

test("FAQ contact topics route questions to the right inbox while preserving contact message type", () => {
  assert.deepEqual(resolveFormMailbox("contact","Volunteering"),
    { inbox:"volunteer", address:"volunteer@campriseagain.org", label:"Contact question" });
  assert.deepEqual(resolveFormMailbox("contact","Camper application"),
    { inbox:"forms", address:"forms@campriseagain.org", label:"Contact question" });
  assert.deepEqual(resolveFormMailbox("contact","General question"),FORM_MAILBOX.contact);
  assert.ok(staffFormNotice("contact","ref-1","Sample","Volunteering").includes("volunteer@campriseagain.org"));
});
