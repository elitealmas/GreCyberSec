-- Bound authenticated quiz writes even when a member calls the RPC directly.
-- Apply after the learning-system migrations. Safe to rerun.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 121000);

do $preflight$
begin
  if to_regclass('public.quiz_attempts') is null
     or to_regclass('public.quiz_answers') is null
     or to_regclass('public.quizzes') is null
     or to_regclass('public.quiz_questions') is null
     or to_regclass('public.quiz_question_answer_keys') is null then
    raise exception 'Apply the learning-system migrations before quiz security hardening.';
  end if;
end $preflight$;

create index if not exists quiz_attempts_user_quiz_submitted_idx
  on public.quiz_attempts (user_id, quiz_id, submitted_at desc);

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_question record;
  v_attempt_id uuid;
  v_response text;
  v_correct_answer text;
  v_explanation text;
  v_is_correct boolean;
  v_correct_answers integer := 0;
  v_scoreable_questions integer := 0;
  v_score numeric(5,2);
  v_passed boolean;
begin
  if v_user_id is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 100 then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
      where submitted.response is null or char_length(submitted.response) > 5000)
     or (select coalesce(sum(char_length(submitted.response)), 0) from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)) > 100000 then
    raise exception 'Invalid quiz answers' using errcode = '22023';
  end if;

  select q.* into v_quiz
  from public.quizzes q
  join public.courses c on c.id = q.course_id
  where q.id = p_quiz_id and q.is_published and c.is_published;
  if not found then raise exception 'Quiz is unavailable' using errcode = '22023'; end if;

  -- One transaction at a time for each member/quiz pair prevents concurrent
  -- requests from racing past the cooldown and quotas.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_quiz_id::text, 20261030));
  if exists (select 1 from public.quiz_attempts where user_id = v_user_id and quiz_id = p_quiz_id
      and submitted_at > clock_timestamp() - interval '10 seconds')
     or (select count(*) from public.quiz_attempts where user_id = v_user_id and quiz_id = p_quiz_id
      and submitted_at > clock_timestamp() - interval '1 hour') >= 10
     or (select count(*) from public.quiz_attempts where user_id = v_user_id and quiz_id = p_quiz_id
      and submitted_at > clock_timestamp() - interval '24 hours') >= 25 then
    raise exception 'Quiz submission rate limit reached' using errcode = 'P0001';
  end if;

  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
      left join public.quiz_questions q on q.id = submitted.question_id and q.quiz_id = p_quiz_id
      where submitted.question_id is null or q.id is null) then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
      group by question_id having count(*) > 1) then raise exception 'Duplicate quiz answers' using errcode = '22023'; end if;

  insert into public.quiz_attempts (user_id, quiz_id, score, correct_answers, scoreable_questions, passed)
  values (v_user_id, p_quiz_id, 0, 0, 0, false) returning id into v_attempt_id;

  for v_question in select id, question_type from public.quiz_questions where quiz_id = p_quiz_id order by position loop
    select coalesce(submitted.response, '') into v_response
      from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
      where submitted.question_id = v_question.id;
    v_response := coalesce(v_response, ''); v_is_correct := null; v_explanation := null;
    if v_question.question_type = 'mcq' then
      select correct_answer, explanation into v_correct_answer, v_explanation
        from public.quiz_question_answer_keys where question_id = v_question.id;
      v_scoreable_questions := v_scoreable_questions + 1;
      v_is_correct := lower(btrim(v_response)) = lower(btrim(v_correct_answer));
      if v_is_correct then v_correct_answers := v_correct_answers + 1; end if;
    end if;
    insert into public.quiz_answers (attempt_id, question_id, response, is_correct, feedback)
    values (v_attempt_id, v_question.id, v_response, v_is_correct,
      case when v_question.question_type <> 'mcq' then 'Saved for review'
           when v_is_correct then 'Correct. ' || coalesce(v_explanation, '')
           else 'Not quite. ' || coalesce(v_explanation, '') end);
  end loop;

  v_score := case when v_scoreable_questions = 0 then 0 else round((v_correct_answers::numeric / v_scoreable_questions) * 100, 2) end;
  v_passed := v_score >= v_quiz.passing_score;
  update public.quiz_attempts set score = v_score, correct_answers = v_correct_answers,
    scoreable_questions = v_scoreable_questions, passed = v_passed where id = v_attempt_id;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'passed', v_passed);
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
commit;
