import assert from "node:assert/strict";
import test from "node:test";
import { validateContactInput } from "../lib/contact-validation.ts";

test("accepts a well-formed contact message", () => {
  assert.deepEqual(validateContactInput({
    name: "Ada Lovelace",
    email: "ada@example.ac.uk",
    message: "I would like to attend the next workshop.",
  }), {});
});

test("rejects malformed and undersized input", () => {
  const errors = validateContactInput({ name: "A", email: "not-an-email", message: "Short" });
  assert.equal(errors.name, "Enter a name between 2 and 80 characters.");
  assert.equal(errors.email, "Enter a valid email address.");
  assert.equal(errors.message, "Enter a message between 10 and 1,500 characters.");
});

test("rejects fields over the server-side limits", () => {
  const errors = validateContactInput({ name: "a".repeat(81), email: `${"a".repeat(250)}@b.co`, message: "a".repeat(1501) });
  assert.ok(errors.name);
  assert.ok(errors.email);
  assert.ok(errors.message);
});
