-- GreCyberSec learning system. Apply with the Supabase CLI or SQL Editor.
create extension if not exists pgcrypto;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 10 and 600),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  summary text not null check (char_length(summary) between 10 and 600),
  content text not null check (char_length(content) between 1 and 20000),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  instructions text not null check (char_length(instructions) between 10 and 3000),
  passing_score numeric(5,2) not null default 70 check (passing_score between 0 and 100),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 3 and 5000),
  question_type text not null check (question_type in ('mcq', 'written', 'code')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, position),
  check ((question_type = 'mcq' and jsonb_array_length(options) between 2 and 8) or (question_type <> 'mcq' and jsonb_array_length(options) = 0))
);

-- Answer keys deliberately live outside quiz_questions so authenticated clients
-- can read question prompts/options without ever receiving MCQ solutions.
create table public.quiz_question_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_answer text not null check (char_length(correct_answer) between 1 and 500)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  correct_answers integer not null check (correct_answers >= 0),
  scoreable_questions integer not null check (scoreable_questions >= 0),
  passed boolean not null,
  submitted_at timestamptz not null default now()
);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete restrict,
  response text not null check (char_length(response) <= 5000),
  is_correct boolean,
  feedback text,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index course_modules_course_position_idx on public.course_modules (course_id, position);
create index lessons_module_position_idx on public.lessons (module_id, position);
create index lesson_progress_user_completed_idx on public.lesson_progress (user_id, completed_at desc);
create index quizzes_course_idx on public.quizzes (course_id);
create index quiz_questions_quiz_position_idx on public.quiz_questions (quiz_id, position);
create index quiz_attempts_user_quiz_submitted_idx on public.quiz_attempts (user_id, quiz_id, submitted_at desc);
create index quiz_answers_attempt_idx on public.quiz_answers (attempt_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at before update on public.courses for each row execute procedure public.set_updated_at();
create trigger course_modules_set_updated_at before update on public.course_modules for each row execute procedure public.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons for each row execute procedure public.set_updated_at();
create trigger lesson_progress_set_updated_at before update on public.lesson_progress for each row execute procedure public.set_updated_at();
create trigger quizzes_set_updated_at before update on public.quizzes for each row execute procedure public.set_updated_at();
create trigger quiz_questions_set_updated_at before update on public.quiz_questions for each row execute procedure public.set_updated_at();

alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

create policy "authenticated members can read published courses" on public.courses for select to authenticated using (is_published);
create policy "authenticated members can read course modules" on public.course_modules for select to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.is_published));
create policy "authenticated members can read lessons" on public.lessons for select to authenticated using (exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and c.is_published));
create policy "authenticated members can read published quizzes" on public.quizzes for select to authenticated using (is_published and exists (select 1 from public.courses c where c.id = course_id and c.is_published));
create policy "authenticated members can read quiz questions" on public.quiz_questions for select to authenticated using (exists (select 1 from public.quizzes q join public.courses c on c.id = q.course_id where q.id = quiz_id and q.is_published and c.is_published));

create policy "members can read their own lesson progress" on public.lesson_progress for select to authenticated using (auth.uid() = user_id);
create policy "members can create their own lesson progress" on public.lesson_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "members can update their own lesson progress" on public.lesson_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "members can delete their own lesson progress" on public.lesson_progress for delete to authenticated using (auth.uid() = user_id);

create policy "members can read their own quiz attempts" on public.quiz_attempts for select to authenticated using (auth.uid() = user_id);
create policy "members can read their own quiz answers" on public.quiz_answers for select to authenticated using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- Server-side scoring: this function is the only path that inserts attempts and answers.
-- It accepts answers, derives the user from auth.uid(), reads private answer keys,
-- and returns only the safe result summary.
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
  v_is_correct boolean;
  v_correct_answers integer := 0;
  v_scoreable_questions integer := 0;
  v_score numeric(5,2);
  v_passed boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 100 then
    raise exception 'Invalid quiz answers' using errcode = '22023';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id and is_published;
  if not found then
    raise exception 'Quiz is unavailable' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
    left join public.quiz_questions q on q.id = submitted.question_id and q.quiz_id = p_quiz_id
    where submitted.question_id is null or q.id is null
  ) then
    raise exception 'Invalid quiz answers' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
    group by question_id having count(*) > 1
  ) then
    raise exception 'Duplicate quiz answers' using errcode = '22023';
  end if;

  insert into public.quiz_attempts (user_id, quiz_id, score, correct_answers, scoreable_questions, passed)
  values (v_user_id, p_quiz_id, 0, 0, 0, false)
  returning id into v_attempt_id;

  for v_question in
    select id, question_type from public.quiz_questions where quiz_id = p_quiz_id order by position
  loop
    select left(coalesce(submitted.response, ''), 5000) into v_response
    from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text)
    where submitted.question_id = v_question.id;
    v_response := coalesce(v_response, '');
    v_is_correct := null;

    if v_question.question_type = 'mcq' then
      select correct_answer into v_correct_answer from public.quiz_question_answer_keys where question_id = v_question.id;
      v_scoreable_questions := v_scoreable_questions + 1;
      v_is_correct := lower(btrim(v_response)) = lower(btrim(v_correct_answer));
      if v_is_correct then v_correct_answers := v_correct_answers + 1; end if;
    end if;

    insert into public.quiz_answers (attempt_id, question_id, response, is_correct, feedback)
    values (
      v_attempt_id,
      v_question.id,
      v_response,
      v_is_correct,
      case when v_question.question_type = 'mcq' and v_is_correct then 'Correct'
           when v_question.question_type = 'mcq' then 'Incorrect'
           else 'Saved for review' end
    );
  end loop;

  v_score := case when v_scoreable_questions = 0 then 0 else round((v_correct_answers::numeric / v_scoreable_questions) * 100, 2) end;
  v_passed := v_score >= v_quiz.passing_score;
  update public.quiz_attempts
    set score = v_score, correct_answers = v_correct_answers, scoreable_questions = v_scoreable_questions, passed = v_passed
    where id = v_attempt_id;

  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'passed', v_passed);
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- Minimal seed content. Add future material through data migrations, not application code.
insert into public.courses (slug, title, description) values
  ('networking-for-cybersecurity', 'Networking for Cybersecurity', 'Build the networking foundations used to understand, secure and investigate modern systems.'),
  ('linux-python-bash', 'Linux, Python & Bash for Cybersecurity', 'Develop safe command-line and scripting skills for practical cybersecurity work.'),
  ('cybersecurity-fundamentals', 'Cybersecurity Fundamentals & Ethical Hacking', 'Learn core security concepts, responsible testing and defensive thinking.')
on conflict (slug) do update set title = excluded.title, description = excluded.description;

insert into public.course_modules (course_id, title, position)
select id, 'Network essentials', 1 from public.courses where slug = 'networking-for-cybersecurity'
union all select id, 'Defensive network visibility', 2 from public.courses where slug = 'networking-for-cybersecurity'
union all select id, 'Linux foundations', 1 from public.courses where slug = 'linux-python-bash'
union all select id, 'Automation basics', 2 from public.courses where slug = 'linux-python-bash'
union all select id, 'Security principles', 1 from public.courses where slug = 'cybersecurity-fundamentals'
union all select id, 'Ethical testing workflow', 2 from public.courses where slug = 'cybersecurity-fundamentals'
on conflict (course_id, position) do update set title = excluded.title;

insert into public.lessons (module_id, slug, title, summary, content, position)
select m.id, v.slug, v.title, v.summary, v.content, v.position
from (values
  ('Network essentials', 'networking-protocol-basics', 'Protocols and ports', 'Learn how protocols and ports describe a conversation between systems.', 'A protocol is an agreed way for systems to communicate. Ports help services share one network address. Start by identifying the service, the protocol and the direction of traffic.', 1),
  ('Network essentials', 'networking-tcp-udp', 'TCP and UDP', 'Compare reliable connections with lightweight datagrams.', 'TCP establishes a connection and provides ordered delivery. UDP trades that reliability for lower overhead. Security monitoring often starts with knowing which one fits a service.', 2),
  ('Defensive network visibility', 'networking-logs-and-flows', 'Logs and flows', 'Use network metadata to spot unusual behaviour.', 'Flow records can show who connected, when, for how long and how much data moved. Treat them as clues that require context, not proof on their own.', 1),
  ('Defensive network visibility', 'networking-segmentation', 'Segmentation', 'Reduce blast radius with intentional network boundaries.', 'Segmentation limits which systems can communicate. Start with the least connectivity required, document exceptions and review them regularly.', 2),
  ('Linux foundations', 'linux-files-and-permissions', 'Files and permissions', 'Read permissions and apply least privilege on Linux.', 'Linux permissions decide who can read, write and execute. Check ownership before changing access and avoid making files world-writable as a shortcut.', 1),
  ('Linux foundations', 'linux-processes-and-logs', 'Processes and logs', 'Inspect running processes and service logs safely.', 'Use process listings and logs to understand what a machine is doing. Record observations before making changes so investigations remain reproducible.', 2),
  ('Automation basics', 'python-safe-automation', 'Safe Python automation', 'Use Python to automate repeatable defensive tasks.', 'Start scripts with clear inputs, predictable outputs and error handling. Never embed secrets in code or automatically run destructive commands.', 1),
  ('Automation basics', 'bash-pipelines', 'Bash pipelines', 'Combine small commands while keeping shell work readable.', 'Pipelines are powerful for analysis. Quote variables, use explicit paths and test commands on sample data before applying them to real systems.', 2),
  ('Security principles', 'fundamentals-cia-triad', 'The CIA triad', 'Use confidentiality, integrity and availability to reason about security.', 'The CIA triad helps you explain what a control protects. Most real decisions involve trade-offs across all three properties.', 1),
  ('Security principles', 'fundamentals-threat-modelling', 'Threat modelling', 'Identify assets, threats and controls before building.', 'A simple threat model names assets, likely misuse cases and practical mitigations. Revisit it when the system or its users change.', 2),
  ('Ethical testing workflow', 'fundamentals-authorisation', 'Authorisation and scope', 'Understand why permission and scope come before testing.', 'Only test systems you are explicitly authorised to assess. Written scope, safe test windows and clear escalation routes protect everyone involved.', 1),
  ('Ethical testing workflow', 'fundamentals-reporting', 'Responsible reporting', 'Turn findings into clear, actionable reports.', 'A useful report explains impact, evidence, reproduction conditions and a realistic remediation. Avoid exposing sensitive details beyond the agreed audience.', 2)
) as v(module_title, slug, title, summary, content, position)
join public.course_modules m on m.title = v.module_title
on conflict (slug) do update set title = excluded.title, summary = excluded.summary, content = excluded.content;

insert into public.quizzes (course_id, title, instructions)
select id, title || ' final quiz', 'Answer the multiple-choice questions. Written and code responses are saved for review; they are not executed or automatically scored.' from public.courses
on conflict (course_id) do update set title = excluded.title, instructions = excluded.instructions;

insert into public.quiz_questions (quiz_id, prompt, question_type, options, position)
select q.id, v.prompt, v.question_type, v.options::jsonb, v.position
from (values
  ('Networking for Cybersecurity final quiz', 'Which protocol provides ordered, reliable delivery?', 'mcq', '["UDP", "TCP", "ICMP", "ARP"]', 1),
  ('Networking for Cybersecurity final quiz', 'In one sentence, explain why network segmentation is useful.', 'written', '[]', 2),
  ('Networking for Cybersecurity final quiz', 'Write a safe command you might use to view local listening ports. Do not run it here.', 'code', '[]', 3),
  ('Linux, Python & Bash for Cybersecurity final quiz', 'Which permission principle gives accounts only the access they need?', 'mcq', '["Least privilege", "Shared root", "Open access", "Security by obscurity"]', 1),
  ('Linux, Python & Bash for Cybersecurity final quiz', 'Describe one safety check before running a Bash command on a production system.', 'written', '[]', 2),
  ('Linux, Python & Bash for Cybersecurity final quiz', 'Write a short pseudocode outline for safely reading a log file. Do not run it here.', 'code', '[]', 3),
  ('Cybersecurity Fundamentals & Ethical Hacking final quiz', 'What must you have before testing a system?', 'mcq', '["Explicit authorisation", "A fast scanner", "Administrator access", "A public IP address"]', 1),
  ('Cybersecurity Fundamentals & Ethical Hacking final quiz', 'Explain the difference between a vulnerability and its impact.', 'written', '[]', 2),
  ('Cybersecurity Fundamentals & Ethical Hacking final quiz', 'Write a safe pseudocode outline for recording a finding. Do not run it here.', 'code', '[]', 3)
) as v(quiz_title, prompt, question_type, options, position)
join public.quizzes q on q.title = v.quiz_title
on conflict (quiz_id, position) do update set prompt = excluded.prompt, question_type = excluded.question_type, options = excluded.options;

insert into public.quiz_question_answer_keys (question_id, correct_answer)
select question.id, v.correct_answer
from (values
  ('Networking for Cybersecurity final quiz', 1, 'TCP'),
  ('Linux, Python & Bash for Cybersecurity final quiz', 1, 'Least privilege'),
  ('Cybersecurity Fundamentals & Ethical Hacking final quiz', 1, 'Explicit authorisation')
) as v(quiz_title, position, correct_answer)
join public.quizzes q on q.title = v.quiz_title
join public.quiz_questions question on question.quiz_id = q.id and question.position = v.position
on conflict (question_id) do update set correct_answer = excluded.correct_answer;
