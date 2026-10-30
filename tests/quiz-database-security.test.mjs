import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const learningMigration = new URL("../supabase/migrations/20260816190000_create_learning_system.sql", import.meta.url);
const hardeningMigration = new URL("../supabase/migrations/20261030121000_quiz_security_hardening.sql", import.meta.url);

async function securedQuizDatabase() {
  const db = await PGlite.create();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  const learning = (await readFile(learningMigration, "utf8")).replace("create extension if not exists pgcrypto;", "");
  await db.exec(learning);
  await db.exec("alter table public.quiz_question_answer_keys add column if not exists explanation text;");
  const hardening = await readFile(hardeningMigration, "utf8");
  await db.exec(hardening);
  await db.exec(hardening);
  return db;
}

test("quiz RPC bounds payloads, quotas writes, and remains authenticated-only", async (t) => {
  const db = await securedQuizDatabase();
  t.after(() => db.close());
  const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];

  assert.equal(await scalar("select has_function_privilege('anon', 'public.submit_quiz_attempt(uuid,jsonb)', 'EXECUTE')"), false);
  assert.equal(await scalar("select has_function_privilege('authenticated', 'public.submit_quiz_attempt(uuid,jsonb)', 'EXECUTE')"), true);

  const userId = "11111111-1111-4111-8111-111111111111";
  const otherUserId = "22222222-2222-4222-8222-222222222222";
  await db.query("insert into auth.users (id) values ($1), ($2)", [userId, otherUserId]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);

  const quizId = await scalar("select id from public.quizzes order by title limit 1");
  const questions = (await db.query("select id, question_type from public.quiz_questions where quiz_id = $1 order by position", [quizId])).rows;
  const answers = questions.map(({ id, question_type }) => ({ question_id: id, response: question_type === "mcq" ? "TCP" : "Reviewed response" }));

  const result = await scalar("select public.submit_quiz_attempt($1, $2::jsonb)", [quizId, JSON.stringify(answers)]);
  assert.ok(result.attempt_id);
  assert.equal(await scalar("select count(*)::int from public.quiz_attempts where user_id = $1", [userId]), 1);

  await assert.rejects(
    db.query("select public.submit_quiz_attempt($1, $2::jsonb)", [quizId, JSON.stringify(answers)]),
    /Quiz submission rate limit reached/,
  );

  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherUserId]);
  const oversized = [{ question_id: questions[0].id, response: "x".repeat(5001) }];
  await assert.rejects(
    db.query("select public.submit_quiz_attempt($1, $2::jsonb)", [quizId, JSON.stringify(oversized)]),
    /Invalid quiz answers/,
  );
  assert.equal(await scalar("select count(*)::int from public.quiz_attempts where user_id = $1", [otherUserId]), 0);
});
