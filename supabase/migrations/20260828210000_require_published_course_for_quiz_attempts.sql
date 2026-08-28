-- Keep the SECURITY DEFINER scoring function aligned with the published-content
-- policy. This does not alter data; it only rejects attempts for a quiz whose
-- parent course is not published.
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

  select q.* into v_quiz
  from public.quizzes q
  join public.courses c on c.id = q.course_id
  where q.id = p_quiz_id and q.is_published and c.is_published;
  if not found then raise exception 'Quiz is unavailable' using errcode = '22023'; end if;

  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text) left join public.quiz_questions q on q.id = submitted.question_id and q.quiz_id = p_quiz_id where submitted.question_id is null or q.id is null) then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text) group by question_id having count(*) > 1) then raise exception 'Duplicate quiz answers' using errcode = '22023'; end if;

  insert into public.quiz_attempts (user_id, quiz_id, score, correct_answers, scoreable_questions, passed)
  values (v_user_id, p_quiz_id, 0, 0, 0, false) returning id into v_attempt_id;

  for v_question in select id, question_type from public.quiz_questions where quiz_id = p_quiz_id order by position loop
    select left(coalesce(submitted.response, ''), 5000) into v_response from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text) where submitted.question_id = v_question.id;
    v_response := coalesce(v_response, ''); v_is_correct := null; v_explanation := null;
    if v_question.question_type = 'mcq' then
      select correct_answer, explanation into v_correct_answer, v_explanation from public.quiz_question_answer_keys where question_id = v_question.id;
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
  update public.quiz_attempts set score = v_score, correct_answers = v_correct_answers, scoreable_questions = v_scoreable_questions, passed = v_passed where id = v_attempt_id;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'passed', v_passed);
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
