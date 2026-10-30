import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("confirmation GET is inert and token consumption stays behind a POST action", async () => {
  const [page, action, config] = await Promise.all([
    read("app/auth/confirm/page.tsx"),
    read("app/auth/confirm/actions.ts"),
    read("next.config.ts"),
  ]);

  assert.doesNotMatch(page, /exchangeCodeForSession|verifyOtp/);
  assert.match(page, /<form action=\{confirmAuth\}/);
  assert.match(action, /exchangeCodeForSession/);
  assert.match(action, /verifyOtp/);
  assert.match(config, /source: "\/auth\/confirm"/);
  assert.match(config, /Cache-Control", value: "private, no-store"/);
});
