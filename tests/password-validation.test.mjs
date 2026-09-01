import assert from "node:assert/strict";
import test from "node:test";
import { validateNewPassword } from "../lib/auth-validation.ts";

function passwordForm(password, confirmPassword = password) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("confirmPassword", confirmPassword);
  return formData;
}

test("rejects a password whose confirmation does not match", () => {
  assert.equal(validateNewPassword(passwordForm("SecurePassword1", "DifferentPassword1")), "mismatch");
});

test("rejects passwords that do not meet the existing password policy", () => {
  assert.equal(validateNewPassword(passwordForm("short1A")), null);
  assert.equal(validateNewPassword(passwordForm("alllowercasepassword1")), null);
  assert.equal(validateNewPassword(passwordForm("ALLUPPERCASEPASSWORD1")), null);
  assert.equal(validateNewPassword(passwordForm("NoDigitsInThisPassword")), null);
});

test("accepts a valid new password for the authenticated update action", () => {
  assert.equal(validateNewPassword(passwordForm("GreCyberSecure2026")), "GreCyberSecure2026");
});
