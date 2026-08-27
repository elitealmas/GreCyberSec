import assert from "node:assert/strict";
import test from "node:test";
import { registrationFailureMessage } from "../lib/registration-errors.ts";

test("maps Supabase confirmation email rate limits separately", () => {
  assert.equal(
    registrationFailureMessage({ status: 429, code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }),
    "email-rate-limited",
  );
});

test("maps other Supabase rate limits without mislabelling them as Turnstile failures", () => {
  assert.equal(
    registrationFailureMessage({ status: 429, code: "over_request_rate_limit", message: "Too many requests" }),
    "registration-rate-limited",
  );
});

test("uses the generic registration failure message for unknown Supabase failures", () => {
  assert.equal(
    registrationFailureMessage({ status: 500, message: "Unexpected error" }),
    "registration-unavailable",
  );
});
