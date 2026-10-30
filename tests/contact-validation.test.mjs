import assert from "node:assert/strict";
import test from "node:test";
import { validPrivateContactRequest } from "../lib/contact-validation.ts";

function request(overrides = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    name: "Alice Example",
    email: "Alice@Example.test",
    requestType: "deletion",
    message: "Please delete my member account and learning history.",
    ...overrides,
  })) if (value !== null) form.set(name, value);
  return form;
}

test("accepts and normalises a bounded private request", () => {
  assert.deepEqual(validPrivateContactRequest(request()), {
    name: "Alice Example",
    email: "Alice@Example.test",
    normalized: "alice@example.test",
    requestType: "deletion",
    message: "Please delete my member account and learning history.",
  });
});

test("rejects invalid categories, header controls and oversized messages", () => {
  for (const form of [
    request({ name: "A" }),
    request({ email: "invalid" }),
    request({ email: "alice@example.test\r\nBcc: hidden@example.test" }),
    request({ requestType: "admin" }),
    request({ message: "short" }),
    request({ message: "x".repeat(3001) }),
  ]) assert.equal(validPrivateContactRequest(form), null);
});
