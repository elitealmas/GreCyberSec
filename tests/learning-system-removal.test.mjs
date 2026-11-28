import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const removal = "20261127140000_drop_learning_system.sql";
const courseTables = ["courses", "course_modules", "lessons", "lesson_progress", "quizzes", "quiz_questions", "quiz_question_answer_keys", "quiz_attempts", "quiz_answers"];

async function migrationSql(name) {
  return (await readFile(new URL(name, migrationsDir), "utf8")).replace("create extension if not exists pgcrypto;", "");
}

// Builds a database from every migration before the removal, like production.
async function productionLikeDatabase() {
  const db = await PGlite.create();
  await db.exec(`
    create role anon; create role authenticated; create role service_role noinherit bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql") && name < removal).sort();
  for (const name of names) await db.exec(await migrationSql(name));
  return db;
}

const scalar = async (db, sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const eventObjects = (db) => db.query(`
  select 'table' as kind, table_schema || '.' || table_name as name from information_schema.tables where table_schema = 'event_private'
  union all
  select 'function', p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'event\\_%'
  order by 1, 2`).then((result) => result.rows);

test("learning-system removal drops only course objects and keeps events and accounts", async (t) => {
  const db = await productionLikeDatabase();
  t.after(() => db.close());

  const userId = "11111111-1111-4111-8111-111111111111";
  await db.query("insert into auth.users (id) values ($1)", [userId]);
  const eventsBefore = await eventObjects(db);
  assert.ok(eventsBefore.length > 5, "event objects exist before removal");
  assert.ok(await scalar(db, "select count(*)::int from public.courses") > 0, "seeded course exists before removal");
  for (const table of courseTables) assert.notEqual(await scalar(db, "select to_regclass($1)::text", [`public.${table}`]), null);

  const sql = await migrationSql(removal);
  await db.exec(sql);
  await db.exec(sql); // safe to rerun

  for (const table of courseTables) assert.equal(await scalar(db, "select to_regclass($1)::text", [`public.${table}`]), null, table);
  assert.equal(await scalar(db, "select to_regprocedure('public.submit_quiz_attempt(uuid,jsonb)')::text"), null);
  assert.equal(await scalar(db, "select to_regprocedure('public.set_updated_at()')::text"), null);

  assert.deepEqual(await eventObjects(db), eventsBefore, "event schema and functions unchanged");
  assert.equal(await scalar(db, "select count(*)::int from auth.users"), 1, "member accounts kept");
});

test("keeps set_updated_at when something else still uses it", async (t) => {
  const db = await productionLikeDatabase();
  t.after(() => db.close());
  await db.exec("create table public.other_thing (id int, updated_at timestamptz); create trigger other_thing_set_updated_at before update on public.other_thing for each row execute procedure public.set_updated_at();");

  await db.exec(await migrationSql(removal));

  assert.notEqual(await scalar(db, "select to_regprocedure('public.set_updated_at()')::text"), null);
  assert.equal(await scalar(db, "select to_regclass('public.courses')::text"), null);
});

test("stops without dropping anything if another object depends on the course tables", async (t) => {
  const db = await productionLikeDatabase();
  t.after(() => db.close());
  await db.exec("create view public.course_report as select id from public.courses;");

  await assert.rejects(db.exec(await migrationSql(removal)));
  await db.exec("rollback;").catch(() => {});

  assert.notEqual(await scalar(db, "select to_regclass('public.courses')::text"), null);
  assert.notEqual(await scalar(db, "select to_regprocedure('public.submit_quiz_attempt(uuid,jsonb)')::text"), null, "nothing dropped on failure");
});
