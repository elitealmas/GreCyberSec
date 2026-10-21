import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationUrl = new URL("../supabase/migrations/20261021090000_event_registration.sql", import.meta.url);
const fixedEnd = "2026-10-29T16:00:00Z";
const hash = (character) => character.repeat(64);

async function databaseAt(instant) {
  const db = await PGlite.create();
  await db.exec("create role anon; create role authenticated; create role service_role noinherit bypassrls;");
  const migration = (await readFile(migrationUrl, "utf8")).replaceAll("clock_timestamp()", `timestamptz '${instant}'`);
  await db.exec(migration);
  return { db, migration };
}

test("event migration is rerunnable and keeps attendees behind RLS and backend-only RPCs", async (t) => {
  const { db, migration } = await databaseAt("2026-10-21T12:00:00Z");
  t.after(() => db.close());
  await db.exec(migration);
  const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];

  assert.equal(await scalar("select has_schema_privilege('anon', 'event_private', 'USAGE')"), false);
  assert.equal(await scalar("select has_function_privilege('authenticated', 'public.event_verify_registration(text,text,timestamptz)', 'EXECUTE')"), false);
  assert.equal(await scalar("select has_function_privilege('service_role', 'public.event_verify_registration(text,text,timestamptz)', 'EXECUTE')"), true);
  assert.equal(await scalar("select relrowsecurity from pg_class where oid = 'event_private.registrations'::regclass"), true);

  const bucket = hash("a");
  assert.equal(await scalar("select public.event_rate_limit($1, 2, 900)", [bucket]), true);
  assert.equal(await scalar("select public.event_rate_limit($1, 2, 900)", [bucket]), true);
  assert.equal(await scalar("select public.event_rate_limit($1, 2, 900)", [bucket]), false);

  const register = (name, email, consent, tokenHash) => scalar(
    "select public.event_register_pending('beyond-the-firewall', $1, $2, $3, $4, $5, '2026-10-21T12:30:00Z', $6)",
    [name, email, email.toLowerCase(), consent, tokenHash, fixedEnd],
  );
  const alice = await register("Alice Example", "Alice@Example.test", true, hash("b"));
  const bob = await register("Bob Example", "bob@example.test", false, hash("c"));
  assert.ok(alice && bob);
  assert.deepEqual(
    (await db.query("select consent from event_private.photography_preferences order by consent desc")).rows.map((row) => row.consent),
    [true, false],
  );

  assert.equal(await register("Alice Updated", "Alice@Example.test", false, hash("d")), alice);
  assert.equal(await scalar("select count(*)::int from event_private.registrations"), 2);
  assert.equal(await scalar("select public.event_verify_registration('beyond-the-firewall', $1, $2)", [hash("b"), fixedEnd]), false);
  assert.equal(await scalar("select public.event_verify_registration('beyond-the-firewall', $1, $2)", [hash("d"), fixedEnd]), true);
  assert.equal(await scalar("select public.event_verify_registration('beyond-the-firewall', $1, $2)", [hash("d"), fixedEnd]), false);
  assert.equal(await scalar("select token_hash is null from event_private.registrations where id = $1", [alice]), true);
  assert.equal(await register("Alice Example", "Alice@Example.test", true, hash("e")), null);

  const claimed = (await db.query("select * from public.event_claim_emails('beyond-the-firewall')")).rows;
  assert.equal(claimed.length, 1);
  assert.equal((await db.query("select * from public.event_claim_emails('beyond-the-firewall')")).rows.length, 0);
  await db.query("select public.event_finish_email($1, true, $2)", [claimed[0].job_id, claimed[0].lease_token]);
  assert.equal((await db.query("select * from public.event_claim_emails('beyond-the-firewall')")).rows.length, 0);

  await db.query("update event_private.registrations set token_expires_at = '2026-10-21T11:59:00Z' where id = $1", [bob]);
  assert.equal(await scalar("select public.event_verify_registration('beyond-the-firewall', $1, $2)", [hash("c"), fixedEnd]), false);
  const cleanup = (await db.query("select * from public.event_cleanup('beyond-the-firewall', $1, 7)", [fixedEnd])).rows[0];
  assert.equal(cleanup.expired_tokens, 1);
  assert.equal(await scalar("select status from event_private.registrations where id = $1", [bob]), "expired");
  assert.equal(await scalar("select token_hash is null from event_private.registrations where id = $1", [bob]), true);
});

test("cleanup closes the fixed event, deletes its data after seven days, and leaves unrelated rows", async (t) => {
  const { db } = await databaseAt("2026-11-06T12:00:00Z");
  t.after(() => db.close());
  const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];

  await db.exec(`
    insert into event_private.events values ('unrelated-event', '2026-01-01T00:00:00Z', 'completed');
    insert into event_private.registrations (event_id, full_name, email, email_normalized, status, verified_at)
      values ('beyond-the-firewall', 'Delete Me', 'delete@example.test', 'delete@example.test', 'verified', now()),
             ('unrelated-event', 'Keep Me', 'keep@example.test', 'keep@example.test', 'verified', now());
  `);
  assert.equal(await scalar("select removed_registrations from public.event_cleanup('beyond-the-firewall', $1, 7)", [fixedEnd]), 1);
  assert.equal(await scalar("select status from event_private.events where event_id = 'beyond-the-firewall'"), "completed");
  assert.equal(await scalar("select count(*)::int from event_private.registrations where event_id = 'unrelated-event'"), 1);
  assert.equal(await scalar("select removed_registrations from public.event_cleanup('beyond-the-firewall', $1, 7)", [fixedEnd]), 0);
  await assert.rejects(
    db.query("select * from public.event_cleanup('unrelated-event', '2026-01-01T00:00:00Z', 7)"),
    /Invalid cleanup configuration/,
  );
});
