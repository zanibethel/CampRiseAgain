import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { campPasswordUpdateErrorMessage } from "../lib/camp-auth-password-errors.ts";

test("same_password rejection explains the password is already in use", () => {
  const message = campPasswordUpdateErrorMessage({code: "same_password"});
  assert.equal(message, "This is already your current password. Choose a different password to change it.");
});

test("other errors do not expose provider details or credentials", () => {
  const unexpected = campPasswordUpdateErrorMessage({code: "invalid_token"});
  assert.match(unexpected, /Could not save your password/);
  assert.ok(!unexpected.includes("invalid_token"));
  assert.equal(campPasswordUpdateErrorMessage(null), unexpected);
});

test("reset form displays the mapped error from updateUser", () => {
  const source = readFileSync(new URL("../app/admin/reset-password/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const \{ error \} = await supabase\.auth\.updateUser\(\{ password \}\);/);
  assert.match(source, /setStatus\(campPasswordUpdateErrorMessage\(error\)\)/);
});
