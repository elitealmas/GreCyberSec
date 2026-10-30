import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireDependency = createRequire(import.meta.url);
const now = Date.parse("2026-10-21T12:00:00.000Z");
const token = "a".repeat(64);
const tokenHash = createHash("sha256").update(token).digest("hex");
const worker = `test.${Buffer.from(JSON.stringify({ role: "gcs_event_worker", exp: 2_000_000_000 })).toString("base64url")}.signature`;
const initialState = { status: "idle", version: 0 };

// Execute the real TypeScript modules with isolated environment, clock, database
// and HTTP boundaries. No test can contact a live service or send real mail.
function harness(options = {}) {
  const env = {
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://events.example.org",
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.org",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "production-site-key",
    TURNSTILE_SECRET_KEY: "production-turnstile-secret",
    TURNSTILE_EXPECTED_HOSTNAME: "events.example.org",
    SUPABASE_EVENT_WORKER_JWT: worker,
    RESEND_API_KEY: "server-only-test-resend-key",
    EVENT_EMAIL_FROM: "Events <events@example.org>",
    EVENT_SECURITY_KEY: "event-test-security-key-32-characters-long",
    CRON_SECRET: "event-test-cron-secret-32-characters-long",
    EVENT_ORGANISER_NAME: "GreCyberSec",
    EVENT_PRIVACY_CONTACT: "privacy@example.org",
    ...options.env,
  };
  const calls = [];
  const logs = [];
  const background = [];
  const cache = new Map();
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [options.now ?? now])); }
    static now() { return options.now ?? now; }
  }
  const database = {
    async rpc(name, params) {
      calls.push({ kind: "rpc", name, params });
      if (options.rpc) {
        const override = await options.rpc(name, params);
        if (override !== undefined) return override;
      }
      if (name === "event_rate_limit") return { data: true, error: null };
      if (name === "event_register_pending") return { data: "pending-id", error: null };
      if (name === "event_resend_pending_v2") return { data: { email: "alice@example.org", full_name: "Alice Example", consent: false }, error: null };
      if (name === "event_verify_registration") return { data: true, error: null };
      if (name === "event_claim_emails") return { data: [], error: null };
      if (name === "event_finish_email") return { data: true, error: null };
      if (name === "event_cleanup") return { data: [{ expired_pending: 0, retained_registrations: 0, stalled_emails: 0 }], error: null };
      throw new Error(`Unexpected database operation: ${name}`);
    },
  };
  async function fakeFetch(url, init) {
    const call = { kind: "fetch", url: String(url), init };
    calls.push(call);
    if (options.fetch) {
      const override = await options.fetch(call);
      if (override !== undefined) return override;
    }
    if (call.url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
      return Response.json({ success: true, action: "event-register", hostname: "events.example.org" });
    }
    if (call.url === "https://api.resend.com/emails") return Response.json({ id: "synthetic-email-id" });
    throw new Error(`Unexpected HTTP request: ${call.url}`);
  }
  function load(relative) {
    const filename = resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function isolatedRequire(id) {
      if (id === "server-only") return {};
      if (id === "next/server") return { after: (callback) => background.push(callback) };
      if (id === "@supabase/supabase-js") return {
        createClient(...args) { calls.push({ kind: "client", args }); return database; },
      };
      if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
      if (id.startsWith(".")) return load(resolve(dirname(filename), id.endsWith(".ts") ? id : `${id}.ts`));
      if (id.startsWith("node:")) return requireDependency(id);
      throw new Error(`Unmocked dependency: ${id}`);
    }
    const run = new Function("require", "module", "exports", "process", "fetch", "console", "Date", source);
    run(isolatedRequire, loadedModule, loadedModule.exports, { env }, fakeFetch, {
      error: (...args) => logs.push(args), warn: (...args) => logs.push(args), log: (...args) => logs.push(args),
    }, TestDate);
    return loadedModule.exports;
  }
  return { env, calls, logs, load, background, drain: async () => { while (background.length) await background.shift()(); }, server: () => load("lib/event-registration-server.ts"), actions: () => load("app/events/beyond-the-firewall/actions.ts"), cron: () => load("app/api/cron/event-maintenance/route.ts") };
}

function registration(overrides = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({ fullName: "Alice Example", email: "alice@example.org", photographyConsent: "no", turnstileToken: "synthetic-challenge", ...overrides })) {
    if (value !== null) form.set(name, value);
  }
  return form;
}

function verification(value = token) {
  const form = new FormData();
  form.set("token", value);
  return form;
}

const rpcCalls = (h, name) => h.calls.filter((call) => call.kind === "rpc" && (!name || call.name === name));
const emailCalls = (h) => h.calls.filter((call) => call.kind === "fetch" && call.url === "https://api.resend.com/emails");
const secretSentinel = "NEVER-LOG-PROVIDER-SECRET-OR-ATTENDEE-DATA";

test("No photography consent registers pending; only the token hash reaches Supabase before verification mail", async () => {
  const h = harness();
  const result = await h.actions().registerForEvent(initialState, registration());
  assert.equal(result.status, "sent");
  const [insert] = rpcCalls(h, "event_register_pending");
  assert.equal(insert.params.p_consent, false);
  assert.equal(insert.params.p_event, "beyond-the-firewall");
  assert.equal(insert.params.p_end, "2026-10-29T16:00:00.000Z");
  assert.equal(insert.params.p_expires, "2026-10-21T12:30:00.000Z");
  assert.match(insert.params.p_hash, /^[a-f0-9]{64}$/);
  const [mail] = emailCalls(h);
  const body = JSON.parse(mail.init.body);
  assert.deepEqual(body.to, ["alice@example.org"]);
  assert.equal(body.subject, "Verify your registration — Beyond the Firewall");
  assert.ok(body.text.includes("Name: Alice Example"));
  assert.ok(body.text.includes("Photography consent: No"));
  const link = body.text.match(/https:\/\/events\.example\.org\/events\/beyond-the-firewall\/verify#[a-f0-9]{64}/)?.[0];
  assert.ok(link);
  const rawToken = new URL(link).hash.slice(1);
  assert.equal(new URL(link).search, "");
  assert.equal(createHash("sha256").update(rawToken).digest("hex"), insert.params.p_hash);
  assert.equal(JSON.stringify(rpcCalls(h)).includes(rawToken), false);
  assert.ok(h.calls.indexOf(insert) < h.calls.indexOf(mail));
  assert.equal(rpcCalls(h, "event_verify_registration").length, 0);
  assert.equal(rpcCalls(h, "event_claim_emails").length, 0);
});

test("invalid inputs and failed Turnstile cannot create pending attendees", async () => {
  for (const form of [registration({ fullName: "" }), registration({ email: "invalid" }), registration({ photographyConsent: null })]) {
    const h = harness();
    assert.equal((await h.actions().registerForEvent(initialState, form)).status, "invalid");
    assert.equal(h.calls.length, 0);
  }
  const h = harness({ fetch: ({ url }) => url.includes("cloudflare.com") ? Response.json({ success: false }) : undefined });
  assert.equal((await h.actions().registerForEvent(initialState, registration())).status, "turnstile");
  assert.equal(rpcCalls(h, "event_rate_limit").length, 0);
  assert.equal(rpcCalls(h, "event_register_pending").length, 0);
  assert.equal(emailCalls(h).length, 0);
});

test("rate limiting runs only after a valid challenge and before attendee writes", async () => {
  const h = harness({ rpc: (name) => name === "event_rate_limit" ? { data: false, error: null } : undefined });
  assert.equal((await h.actions().registerForEvent(initialState, registration())).status, "rate-limited");
  assert.equal(rpcCalls(h, "event_register_pending").length, 0);
  const challenge = h.calls.find((call) => call.kind === "fetch" && call.url.includes("cloudflare.com"));
  const limiter = rpcCalls(h, "event_rate_limit")[0];
  assert.ok(challenge && limiter);
  assert.ok(h.calls.indexOf(challenge) < h.calls.indexOf(limiter));
});

test("already registered addresses receive the same neutral response without a new email", async () => {
  const h = harness({ rpc: (name) => name === "event_register_pending" ? { data: null, error: null } : undefined });
  assert.equal((await h.actions().registerForEvent(initialState, registration())).status, "sent");
  assert.equal(emailCalls(h).length, 0);
});

test("verification provider rejection and transport failure remain neutral and never log provider data", async () => {
  for (const throws of [false, true]) {
    const h = harness({ fetch: ({ url }) => {
      if (!url.includes("api.resend.com")) return undefined;
      if (throws) throw new Error(secretSentinel);
      return new Response(secretSentinel, { status: 503 });
    } });
    const result = await h.actions().registerForEvent(initialState, registration());
    assert.equal(result.status, "sent");
    assert.equal(JSON.stringify([result, h.logs]).includes(secretSentinel), false);
    assert.equal(rpcCalls(h, "event_register_pending").length, 1);
  }
});

test("resending rotates the pending hash and repeats immutable details for the recipient", async () => {
  const h = harness();
  const form = registration();
  assert.equal((await h.actions().resendEventVerification(initialState, form)).status, "sent");
  const [resend] = rpcCalls(h, "event_resend_pending_v2");
  const body = JSON.parse(emailCalls(h)[0].init.body);
  assert.ok(body.text.includes("Name: Alice Example"));
  assert.ok(body.text.includes("Photography consent: No"));
  const raw = body.text.match(/verify#([a-f0-9]{64})/)?.[1];
  assert.ok(raw);
  assert.equal(resend.params.p_hash, createHash("sha256").update(raw).digest("hex"));
  assert.equal(resend.params.p_event, "beyond-the-firewall");
  assert.equal(JSON.stringify(rpcCalls(h)).includes(raw), false);
  const unknown = harness({ rpc: (name) => name === "event_resend_pending_v2" ? { data: null, error: null } : undefined });
  assert.equal((await unknown.actions().resendEventVerification(initialState, form)).status, "sent");
  assert.equal(emailCalls(unknown).length, 0);
});

test("verification submits a hash to the atomic RPC and only successful consumption starts confirmation delivery", async () => {
  const h = harness();
  assert.equal((await h.actions().verifyEventRegistration(initialState, verification())).status, "verified");
  assert.equal(rpcCalls(h, "event_rate_limit").length, 1, "verification must not debit a shared global bucket");
  assert.deepEqual(rpcCalls(h, "event_verify_registration").map((call) => call.params), [{
    p_event: "beyond-the-firewall", p_hash: tokenHash, p_end: "2026-10-29T16:00:00.000Z",
  }]);
  assert.equal(h.background.length, 1);
  assert.equal(rpcCalls(h, "event_claim_emails").length, 0);
  await h.drain();
  assert.equal(rpcCalls(h, "event_claim_emails").length, 1);
  assert.equal(JSON.stringify(rpcCalls(h)).includes(token), false);
  for (const reason of ["expired", "already consumed", "unknown"]) {
    const denied = harness({ rpc: (name) => name === "event_verify_registration" ? { data: false, error: null, reason } : undefined });
    assert.equal((await denied.actions().verifyEventRegistration(initialState, verification())).status, "expired");
    assert.equal(rpcCalls(denied, "event_claim_emails").length, 0);
    assert.equal(denied.background.length, 0);
    assert.equal(emailCalls(denied).length, 0);
  }
});

test("malformed verification tokens and a closed event never reach the consumption RPC", async () => {
  const invalid = harness();
  assert.equal((await invalid.actions().verifyEventRegistration(initialState, verification("not-a-token"))).status, "expired");
  assert.equal(invalid.calls.length, 0);
  const closed = harness({ now: Date.parse("2026-10-29T16:00:00.000Z") });
  assert.equal((await closed.actions().registerForEvent(initialState, registration())).status, "closed");
  assert.equal((await closed.actions().resendEventVerification(initialState, registration())).status, "closed");
  assert.equal((await closed.actions().verifyEventRegistration(initialState, verification())).status, "closed");
  assert.equal(closed.calls.length, 0);
});

test("database exceptions produce generic action errors without exposing internal details", async () => {
  const h = harness({ rpc: (name) => name === "event_register_pending" ? { data: null, error: { message: secretSentinel } } : undefined });
  const result = await h.actions().registerForEvent(initialState, registration());
  assert.equal(result.status, "error");
  assert.equal(JSON.stringify([result, h.logs]).includes(secretSentinel), false);
  assert.equal(emailCalls(h).length, 0);
});

test("confirmation contains the event date, venue, speaker and all calendar links and completes its lease", async () => {
  const job = { job_id: "synthetic-job", full_name: "Alice Example", email: "alice@example.org", lease_token: "synthetic-lease" };
  const h = harness({ rpc: (name) => name === "event_claim_emails" ? { data: [job], error: null } : undefined });
  const outcome = await h.server().sendPendingConfirmations(h.server().eventRegistrationConfig());
  assert.deepEqual(outcome, { attempted: 1, failures: 0 });
  const [claim] = rpcCalls(h, "event_claim_emails");
  assert.equal(claim.params.p_event, "beyond-the-firewall");
  const body = JSON.parse(emailCalls(h)[0].init.body);
  assert.equal(body.subject, "Registration Confirmed — Beyond the Firewall");
  for (const detail of ["Hi Alice", "Thursday, 29 October 2026", "2:00 PM – 4:00 PM", "Ali Mohamed", "CrowdStrike", "Board Room", "Dreadnought Building", "University of Greenwich", "SE10 9LS", "calendar.google.com", "outlook.live.com", "https://events.example.org/events/beyond-the-firewall/calendar"]) assert.ok(body.text.includes(detail), detail);
  assert.deepEqual(rpcCalls(h, "event_finish_email").map((call) => call.params), [{ p_job: job.job_id, p_accepted: true, p_lease_token: job.lease_token }]);
  assert.equal(emailCalls(h)[0].init.headers["Idempotency-Key"], `event-confirmation/${job.job_id}`);
});

test("confirmation failures release the lease for retry and expose aggregate failures only", async () => {
  const job = { job_id: "synthetic-job", full_name: "Alice Example", email: "alice@example.org", lease_token: "synthetic-lease" };
  const h = harness({ rpc: (name) => name === "event_claim_emails" ? { data: [job], error: null } : undefined, fetch: () => { throw new Error(secretSentinel); } });
  assert.deepEqual(await h.server().sendPendingConfirmations(h.server().eventRegistrationConfig()), { attempted: 1, failures: 1 });
  assert.equal(rpcCalls(h, "event_finish_email")[0].params.p_accepted, false);
  assert.equal(rpcCalls(h, "event_finish_email")[0].params.p_lease_token, job.lease_token);
  assert.equal(JSON.stringify(h.logs).includes(secretSentinel), false);
  assert.equal(JSON.stringify(h.logs).includes(job.email), false);
});

test("maintenance rejects unauthorized callers before touching the database", async () => {
  for (const authorization of [undefined, "Bearer wrong-secret", "bearer event-test-cron-secret-32-characters-long"]) {
    const h = harness();
    const request = new Request("https://events.example.org/api/cron/event-maintenance", { headers: authorization ? { authorization } : {} });
    assert.equal((await h.cron().GET(request)).status, 401);
    assert.equal(h.calls.length, 0);
  }
});

test("authorized maintenance scopes cleanup to the fixed event and seven-day retention", async () => {
  const h = harness();
  const request = new Request("https://events.example.org/api/cron/event-maintenance", { headers: { authorization: `Bearer ${h.env.CRON_SECRET}` } });
  const response = await h.cron().GET(request);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(rpcCalls(h, "event_cleanup").map((call) => call.params), [{ p_event: "beyond-the-firewall", p_end: "2026-10-29T16:00:00.000Z", p_retention_days: 7 }]);
  assert.equal((await response.json()).ok, true);
});

test("cleanup remains available when mail configuration is absent and reports a retryable failure", async () => {
  const h = harness({ env: { RESEND_API_KEY: undefined } });
  const response = await h.cron().GET(new Request("https://events.example.org/api/cron/event-maintenance", { headers: { authorization: `Bearer ${h.env.CRON_SECRET}` } }));
  assert.equal(response.status, 503);
  assert.equal(rpcCalls(h, "event_cleanup").length, 1);
  assert.equal(rpcCalls(h, "event_cleanup")[0].params.p_retention_days, 7);
  assert.equal(rpcCalls(h, "event_claim_emails").length, 0);
  assert.equal((await response.json()).ok, false);
});

test("maintenance surfaces stalled or failed delivery to the scheduler without attendee details", async () => {
  for (const stalled of [false, true]) {
    const h = harness({
      rpc: (name) => {
        if (stalled && name === "event_cleanup") return { data: [{ expired_pending: 0, retained_registrations: 0, stalled_emails: 1 }], error: null };
        if (!stalled && name === "event_claim_emails") return { data: [{ job_id: "synthetic-job", full_name: "Alice Example", email: "alice@example.org", lease_token: "synthetic-lease" }], error: null };
      },
      fetch: () => new Response(secretSentinel, { status: 503 }),
    });
    const response = await h.cron().GET(new Request("https://events.example.org/api/cron/event-maintenance", { headers: { authorization: `Bearer ${h.env.CRON_SECRET}` } }));
    assert.equal(response.status, 503);
    const output = await response.text();
    assert.equal(JSON.parse(output).ok, false);
    assert.equal(output.includes("alice@example.org"), false);
    assert.equal(JSON.stringify([output, h.logs]).includes(secretSentinel), false);
  }
});

test("a confirmation queue outage cannot undo a successfully consumed verification token", async () => {
  const h = harness({ rpc: (name) => name === "event_claim_emails" ? { data: null, error: { message: secretSentinel } } : undefined });
  assert.equal((await h.actions().verifyEventRegistration(initialState, verification())).status, "verified");
  await h.drain();
  assert.equal(rpcCalls(h, "event_verify_registration").length, 1);
  assert.equal(emailCalls(h).length, 0);
  assert.equal(JSON.stringify(h.logs).includes(secretSentinel), false);
});

test("configuration defaults to the requested date and preserves the existing restricted worker credential", async () => {
  const h = harness();
  assert.equal(h.server().eventPublicConfig().date, "2026-10-29");
  assert.equal(h.server().eventRegistrationConfig().expectedHostname, "events.example.org");
  h.server().eventDatabase();
  const client = h.calls.find((call) => call.kind === "client");
  assert.equal(client.args[0], "https://database.example.org");
  assert.equal(client.args[1], "public-test-key");
  assert.equal(await client.args[2].accessToken(), worker);
  assert.equal(client.args[2].auth.persistSession, false);
});

test("broad Supabase key aliases remain a non-production migration fallback", async () => {
  for (const name of ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const h = harness({ env: {
      NODE_ENV: "development",
      SUPABASE_EVENT_WORKER_JWT: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_URL: "https://database.example.org",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      [name]: "server-only-existing-database-key",
      EVENT_EMAIL_FROM: undefined,
      RESEND_FROM_EMAIL: "Existing Sender <events@example.org>",
      EVENT_SECURITY_KEY: undefined,
      EVENT_ORGANISER_NAME: undefined,
      EVENT_PRIVACY_CONTACT: undefined,
      TURNSTILE_EXPECTED_HOSTNAME: undefined,
      CRON_SECRET: undefined,
    } });
    const config = h.server().eventRegistrationConfig();
    assert.ok(config, name);
    assert.equal(config.expectedHostname, "events.example.org");
    assert.equal(config.organiser, "GreCyberSec");
    h.server().eventDatabase();
    const client = h.calls.find((call) => call.kind === "client");
    assert.equal(client.args[1], "server-only-existing-database-key");
    assert.equal(client.args[2].accessToken, undefined);
    assert.equal(client.args[2].auth.persistSession, false);
    assert.equal(client.args[2].auth.autoRefreshToken, false);
    assert.match(h.server().eventBucket("registration", "alice@example.org"), /^[a-f0-9]{64}$/);
    await h.server().sendVerificationEmail("alice@example.org", token, tokenHash, config, { name: "Alice Example", consent: false });
    assert.equal(JSON.parse(emailCalls(h)[0].init.body).from, "Existing Sender <events@example.org>");
  }
  const anonAlias = harness({ env: { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "existing-anon-key" } });
  assert.ok(anonAlias.server().eventRegistrationConfig());
  anonAlias.server().eventDatabase();
  assert.equal(anonAlias.calls.find((call) => call.kind === "client").args[1], "existing-anon-key");
});

test("production refuses broad database keys when the restricted worker token is missing", () => {
  const h = harness({ env: {
    SUPABASE_EVENT_WORKER_JWT: undefined,
    SUPABASE_SECRET_KEY: "broad-key-must-not-be-used",
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  } });
  assert.equal(h.server().eventRegistrationConfig(), null);
  assert.throws(() => h.server().eventDatabase(), /not configured/);
});

test("production rejects published Turnstile test credentials and untrusted origins", () => {
  for (const env of [
    { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
    { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "2x00000000000000000000AB" },
    { TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" },
    { TURNSTILE_SECRET_KEY: "2x0000000000000000000000000000000AA" },
    { TURNSTILE_SECRET_KEY: "3x0000000000000000000000000000000AA" },
    { NEXT_PUBLIC_SITE_URL: "http://events.example.org" },
    { NEXT_PUBLIC_SITE_URL: "https://events.example.org/untrusted-path" },
    { NEXT_PUBLIC_SITE_URL: "https://user:password@events.example.org" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://database.example.org" },
    { TURNSTILE_EXPECTED_HOSTNAME: "wrong.example.org" },
    { EVENT_EMAIL_FROM: "events@example.org\r\nBcc: hidden@example.org" },
    { EVENT_VERIFICATION_MINUTES: "0" },
    { EVENT_SECURITY_KEY: "short" },
    { SUPABASE_EVENT_WORKER_JWT: "invalid", SUPABASE_SECRET_KEY: "do-not-silently-fallback" },
  ]) {
    assert.equal(harness({ env }).server().eventRegistrationConfig(), null, JSON.stringify(Object.keys(env)));
  }
});

test("the fixed event date cannot be changed through a stale date environment variable", () => {
  const h = harness({ env: { EVENT_BEYOND_FIREWALL_DATE: "2026-04-29" } });
  assert.equal(h.server().eventPublicConfig().date, "2026-10-29");
});

test("pending token expiry is capped at event end", async () => {
  const h = harness({ now: Date.parse("2026-10-29T15:55:00.000Z") });
  assert.equal((await h.actions().registerForEvent(initialState, registration())).status, "sent");
  assert.equal(rpcCalls(h, "event_register_pending")[0].params.p_expires, "2026-10-29T16:00:00.000Z");
  assert.equal((await h.actions().resendEventVerification(initialState, registration())).status, "sent");
  assert.equal(rpcCalls(h, "event_resend_pending_v2")[0].params.p_expires, "2026-10-29T16:00:00.000Z");
});
