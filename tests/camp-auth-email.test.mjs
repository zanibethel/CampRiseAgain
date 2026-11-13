import test from "node:test";
import assert from "node:assert/strict";
import {
  campPasswordRecoveryEmail, validCampRecoveryLink, CAMP_AUTH_FROM,
  CAMP_RECOVERY_GENERIC_MESSAGE, campAdminInvitationEmail,
  validCampInvitationLink,
} from "../lib/camp-auth-email.ts";

const good =
  "https://yufptpfiwdbzzrvhkvux.supabase.co/auth/v1/verify" +
  "?token=an-opaque-one-time-token&type=recovery" +
  "&redirect_to=https%3A%2F%2Fcampriseagain.org%2Fadmin%2Freset-password";

test("recognizes only genuine scoped recovery link shapes", () => {
  assert.equal(validCampRecoveryLink(good),true);
  for (const url of [
    "https://attacker.example/auth/v1/verify?token=x&type=recovery&redirect_to=https%3A%2F%2Fcampriseagain.org%2Fadmin%2Freset-password",
    good.replace("type=recovery","type=magiclink"),
    good.replace("token=an-opaque-one-time-token","token="),
    good.replace("campriseagain.org%2Fadmin","evil.example%2Fadmin"),
    good.replace("/auth/v1/verify","/malicious"),
    "javascript:alert(1)",
  ]) assert.equal(validCampRecoveryLink(url),false);
});

test("branded recovery email contains instructions, non-monitored notice, and contact site", () => {
  const result=campPasswordRecoveryEmail(good);
  assert.match(CAMP_AUTH_FROM,/support@campriseagain\.org/);
  assert.match(result.subject,/Camp Rise Again/);
  assert.match(result.text,/This inbox is not monitored/);
  assert.match(result.text,/https:\/\/campriseagain\.org/);
  assert.match(result.text,/If you did not request this/);
  assert.ok(result.text.includes(good));
  assert.ok(result.html.includes(">Click here to reset</a>"));
  assert.ok(result.html.includes('href="' + good.replaceAll("&", "&amp;") + '"'));
  assert.ok(!result.html.includes(">" + good + "<"));
  assert.match(result.html,/This inbox is not monitored/);
  assert.ok(!CAMP_RECOVERY_GENERIC_MESSAGE.includes("an-opaque-one-time-token"));
});

test("rejects broken links without rendering email", () => {
  assert.throws(()=>campPasswordRecoveryEmail("https://malicious.invalid/reset"),/Invalid Camp/);
});

test("first-time Camp admin invitation validates exact action, destination, and footer",()=>{
  const invite=good.replace("type=recovery","type=invite");
  assert.equal(validCampInvitationLink(invite),true);
  assert.equal(validCampInvitationLink(good),false);
  assert.equal(validCampInvitationLink(invite.replace("type=invite","type=magiclink")),false);
  assert.equal(validCampInvitationLink(invite.replace(
    "campriseagain.org%2Fadmin","evil.invalid%2Fadmin")),false);
  const message=campAdminInvitationEmail(invite);
  assert.match(message.subject,/create your admin password/i);
  assert.ok(message.html.includes("Create Your Admin Password</a>"));
  assert.ok(message.html.includes("This inbox is not monitored"));
  assert.ok(message.text.includes(invite));
  assert.ok(!message.html.includes(">"+invite+"<"));
  assert.throws(()=>campAdminInvitationEmail(good),/Invalid/);
});
