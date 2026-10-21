import assert from "node:assert/strict";
import test from "node:test";
import { validEventEmail, validEventRegistration } from "../lib/event-registration-validation.ts";
import { verifyTurnstileToken } from "../lib/turnstile.ts";

function form(name, email, consent) {
  const data = new FormData();
  if (name !== null) data.set("fullName", name);
  if (email !== null) data.set("email", email);
  if (consent !== null) data.set("photographyConsent", consent);
  return data;
}

test("validates name, email and an explicit yes or no consent", () => {
  assert.equal(validEventRegistration(form("", "a@example.com", "yes")), null);
  assert.equal(validEventRegistration(form("A".repeat(121), "a@example.com", "yes")), null);
  assert.equal(validEventRegistration(form("A", "invalid", "yes")), null);
  assert.equal(validEventRegistration(form("A", "a@example.com", null)), null);
  assert.equal(validEventRegistration(form("A", "a@example.com", "yes")).consent, true);
  assert.equal(validEventRegistration(form("A", "a@example.com", "no")).consent, false);
  assert.equal(validEventRegistration(form("A\nB", "a@example.com", "no")), null);
  assert.deepEqual(validEventEmail("  User@EXAMPLE.COM "), { email: "User@EXAMPLE.COM", normalized: "user@example.com" });
});

test("Turnstile requires success, action and hostname and fails closed", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ success: calls === 1, action: "event-register", hostname: "example.org" }), { status: 200 }); };
    assert.equal(await verifyTurnstileToken("test-token", "event-register", "example.org"), true);
    assert.equal(await verifyTurnstileToken("test-token", "event-register", "example.org"), false);
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "event-register", hostname: "wrong.example" }), { status: 200 });
    assert.equal(await verifyTurnstileToken("test-token", "event-register", "example.org"), false);
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await verifyTurnstileToken("test-token", "event-register", "example.org"), false);
    assert.equal(await verifyTurnstileToken("", "event-register", "example.org"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  }
});
