-- Remove the retired course / lesson / quiz learning system.
--
-- PERMANENT: deletes all course content, members' lesson progress and quiz
-- history. Take a backup first if you might want that data back.
--
-- Touches only objects created by the learning-system migrations:
--   20260816190000_create_learning_system.sql
--   20260827110000_replace_sample_courses_with_networking_course.sql
--   20260828210000_require_published_course_for_quiz_attempts.sql
--   20261030121000_quiz_security_hardening.sql
-- Event registration (event_private schema and public.event_* functions),
-- auth.users and member accounts are not touched.
--
-- Runs in one transaction: if anything unexpected depends on these tables,
-- nothing is dropped and the error names the dependency. Safe to rerun.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- 1. Quiz submission RPC (security definer function used only by quizzes).
drop function if exists public.submit_quiz_attempt(uuid, jsonb);

-- 2. Tables, children before parents. Dropping a table also removes its
--    indexes, triggers, RLS policies and foreign keys. No CASCADE, so an
--    unexpected dependency (e.g. a view built on these tables) stops the
--    whole migration instead of being silently dropped.
drop table if exists public.quiz_answers;
drop table if exists public.quiz_attempts;
drop table if exists public.quiz_question_answer_keys;
drop table if exists public.quiz_questions;
drop table if exists public.quizzes;
drop table if exists public.lesson_progress;
drop table if exists public.lessons;
drop table if exists public.course_modules;
drop table if exists public.courses;

-- 3. The generic updated_at trigger helper was created for the course tables.
--    Drop it only if no remaining trigger anywhere still uses it.
do $cleanup$
declare
  helper regprocedure := to_regprocedure('public.set_updated_at()');
begin
  if helper is not null
     and not exists (select 1 from pg_trigger where tgfoid = helper and not tgisinternal) then
    drop function public.set_updated_at();
  end if;
end $cleanup$;

commit;
