import assert from "node:assert/strict";
import test from "node:test";
import { confirmationFailurePath, confirmationSuccessPath } from "../lib/auth-callback.ts";
import { protectedRouteRedirect } from "../lib/protected-routes.ts";

test("routes normal signup confirmation to the confirmed page", () => {
  assert.equal(confirmationSuccessPath(null, "email"), "/auth/confirmed");
  assert.equal(confirmationSuccessPath(null), "/auth/confirmed");
});

test("routes token-hash and PKCE recovery callbacks to the password update page", () => {
  assert.equal(confirmationSuccessPath(null, "recovery"), "/update-password");
  assert.equal(confirmationSuccessPath("recovery"), "/update-password");
});

test("does not use an arbitrary callback next value as a redirect destination", () => {
  assert.equal(confirmationSuccessPath("https://evil.example"), "/auth/confirmed");
  assert.equal(confirmationFailurePath, "/login?message=confirmation-error");
});

test("matches every protected member route before rendering", () => {
  assert.equal(protectedRouteRedirect("/dashboard"), "/login");
  assert.equal(protectedRouteRedirect("/courses"), "/login");
  assert.equal(protectedRouteRedirect("/courses/networking/quiz"), "/login");
  assert.equal(protectedRouteRedirect("/update-password"), "/forgot-password?message=confirmation-error");
  assert.equal(protectedRouteRedirect("/about"), null);
});
