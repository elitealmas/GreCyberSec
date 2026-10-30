-- Beyond the Firewall: 29 October 2026, 14:00-16:00 Europe/London (UTC).
-- Run the read-only prerequisite checks in docs/event-registration-deployment.md first.
-- Safe to rerun. This transaction neither replaces attendee rows nor deletes data.
-- Incompatible objects, invalid legacy rows, or a conflicting date abort the
-- entire transaction. Investigate the reported prerequisite before retrying.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261021, 90000);

do $preflight$
declare item record; actual record;
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role')
     or not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'Prerequisite: use the intended Supabase database; service_role, anon and authenticated must exist.';
  end if;
  for item in select * from (values
    ('events', 'event_id', 'text', true), ('events', 'ends_at', 'timestamptz', true), ('events', 'status', 'text', true),
    ('registrations', 'id', 'uuid', true), ('registrations', 'event_id', 'text', true),
    ('registrations', 'full_name', 'text', true), ('registrations', 'email', 'text', true),
    ('registrations', 'email_normalized', 'text', true), ('registrations', 'status', 'text', true),
    ('registrations', 'token_hash', 'text', false), ('registrations', 'token_expires_at', 'timestamptz', false),
    ('registrations', 'created_at', 'timestamptz', true), ('registrations', 'updated_at', 'timestamptz', true),
    ('registrations', 'verified_at', 'timestamptz', false),
    ('photography_preferences', 'registration_id', 'uuid', true), ('photography_preferences', 'consent', 'bool', true),
    ('photography_preferences', 'consent_version', 'text', true), ('photography_preferences', 'recorded_at', 'timestamptz', true),
    ('email_outbox', 'id', 'uuid', true), ('email_outbox', 'registration_id', 'uuid', true),
    ('email_outbox', 'created_at', 'timestamptz', true), ('email_outbox', 'leased_until', 'timestamptz', false),
    ('email_outbox', 'attempts', 'int4', true), ('email_outbox', 'delivered_at', 'timestamptz', false),
    ('rate_limits', 'bucket', 'text', true), ('rate_limits', 'window_start', 'timestamptz', true), ('rate_limits', 'requests', 'int4', true)
  ) as expected(table_name, column_name, type_name, is_required) loop
    if to_regclass(format('event_private.%I', item.table_name)) is not null then
      select c.relkind, t.typname, a.attnotnull, a.attidentity, a.attgenerated into actual
      from pg_class c join pg_attribute a on a.attrelid = c.oid join pg_type t on t.oid = a.atttypid
      where c.oid = to_regclass(format('event_private.%I', item.table_name))
        and a.attname = item.column_name and not a.attisdropped;
      if not found or actual.relkind <> 'r' or actual.typname <> item.type_name
         or actual.attnotnull <> item.is_required or actual.attidentity <> '' or actual.attgenerated <> '' then
        raise exception 'Prerequisite: incompatible event_private.%.%; expected % (not null: %). No attendee data was changed.', item.table_name, item.column_name, item.type_name, item.is_required;
      end if;
    end if;
  end loop;
  for item in select * from (values ('email_outbox', 'lease_token', 'uuid'),
    ('email_outbox', 'first_attempt_at', 'timestamptz'), ('rate_limits', 'event_id', 'text'))
    as additions(table_name, column_name, type_name) loop
    select t.typname, a.attnotnull into actual from pg_attribute a join pg_type t on t.oid = a.atttypid
      where a.attrelid = to_regclass(format('event_private.%I', item.table_name)) and a.attname = item.column_name and not a.attisdropped;
    if found and (actual.typname <> item.type_name or actual.attnotnull) then
      raise exception 'Prerequisite: incompatible event_private.%.%; expected nullable %.', item.table_name, item.column_name, item.type_name;
    end if;
  end loop;
  if exists (select 1 from pg_trigger where tgrelid in (
      to_regclass('event_private.events'), to_regclass('event_private.registrations'),
      to_regclass('event_private.photography_preferences'), to_regclass('event_private.email_outbox'),
      to_regclass('event_private.rate_limits')) and not tgisinternal) then
    raise exception 'Prerequisite: review custom event_private triggers before applying this migration.';
  end if;
  if exists (select 1 from pg_roles where rolname = 'gcs_event_worker' and (rolcanlogin or rolsuper or rolcreaterole or rolcreatedb or rolbypassrls)) then
    raise exception 'Prerequisite: existing optional gcs_event_worker role has elevated privileges; review it before applying.';
  end if;
end $preflight$;

create schema if not exists event_private;
create table if not exists event_private.events (
  event_id text primary key, ends_at timestamptz not null,
  status text not null check (status in ('active', 'completed'))
);
create table if not exists event_private.registrations (
  id uuid primary key default gen_random_uuid(), event_id text not null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254), email_normalized text not null,
  status text not null check (status in ('pending', 'verified', 'expired', 'cancelled')),
  token_hash text, token_expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), verified_at timestamptz,
  unique (event_id, email_normalized), unique (token_hash)
);
create table if not exists event_private.photography_preferences (
  registration_id uuid primary key references event_private.registrations(id) on delete cascade,
  consent boolean not null, consent_version text not null, recorded_at timestamptz not null default now()
);
create table if not exists event_private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references event_private.registrations(id) on delete cascade,
  created_at timestamptz not null default now(), leased_until timestamptz,
  attempts integer not null default 0, delivered_at timestamptz
);
create table if not exists event_private.rate_limits (
  bucket text primary key, window_start timestamptz not null, requests integer not null
);
alter table event_private.email_outbox add column if not exists lease_token uuid;
alter table event_private.email_outbox add column if not exists first_attempt_at timestamptz;
-- Legacy unscoped counters remain unscoped and are not deleted by cleanup.
alter table event_private.rate_limits add column if not exists event_id text;

-- Check existing uniqueness and cascade rules instead of replacing them.
do $constraints$
declare item record; relation oid; keys smallint[];
begin
  for item in select * from (values
    ('events', 'p', array['event_id']::text[]),
    ('registrations', 'p', array['id']), ('registrations', 'u', array['event_id','email_normalized']),
    ('registrations', 'u', array['token_hash']), ('photography_preferences', 'p', array['registration_id']),
    ('email_outbox', 'p', array['id']), ('email_outbox', 'u', array['registration_id']), ('rate_limits', 'p', array['bucket'])
  ) as required(table_name, kind, columns) loop
    relation := to_regclass(format('event_private.%I', item.table_name));
    select array_agg(a.attnum order by columns.ordinality) into keys
    from unnest(item.columns) with ordinality as columns(name, ordinality)
    join pg_attribute a on a.attrelid = relation and a.attname = columns.name;
    if not exists (select 1 from pg_constraint where conrelid = relation and contype::text = item.kind and conkey = keys and convalidated and not condeferrable) then
      raise exception 'Prerequisite: event_private.% needs its original nondeferrable % constraint on %. Review existing indexes/duplicates; no data was changed.', item.table_name, item.kind, item.columns;
    end if;
  end loop;
  for item in select * from (values ('photography_preferences'), ('email_outbox')) as required(table_name) loop
    relation := to_regclass(format('event_private.%I', item.table_name));
    if not exists (select 1 from pg_constraint where conrelid = relation and contype = 'f'
      and confrelid = 'event_private.registrations'::regclass and confdeltype = 'c' and convalidated and not condeferrable
      and conkey = array[(select attnum from pg_attribute where attrelid = relation and attname = 'registration_id')]::smallint[]
      and confkey = array[(select attnum from pg_attribute where attrelid = 'event_private.registrations'::regclass and attname = 'id')]::smallint[]) then
      raise exception 'Prerequisite: event_private.% must have its registration_id foreign key with ON DELETE CASCADE. No constraints were replaced.', item.table_name;
    end if;
  end loop;
  if exists (select 1 from event_private.events where event_id = 'beyond-the-firewall' and ends_at <> timestamptz '2026-10-29 16:00:00+00') then
    raise exception 'Prerequisite: beyond-the-firewall already has a different end date. Review the existing event and registrations before deliberately reconciling its date; this migration does not overwrite it.';
  end if;
  if exists (select 1 from event_private.registrations where full_name <> btrim(full_name) or full_name ~ '[[:cntrl:]]'
      or char_length(full_name) not between 1 and 120 or char_length(email) not between 3 and 254
      or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or email_normalized <> lower(btrim(email))
      or (token_hash is not null and token_hash !~ '^[0-9a-f]{64}$')
      or (status = 'pending' and (token_hash is null or token_expires_at is null))
      or (status <> 'pending' and (token_hash is not null or token_expires_at is not null))
      or (status = 'verified' and verified_at is null) or status not in ('pending', 'verified', 'expired', 'cancelled')) then
    raise exception 'Prerequisite: existing registration rows fail normalization, hash, status, or timestamp checks. Review aggregate prerequisite results and reconcile explicitly; this migration never rewrites attendees.';
  end if;
  if exists (select 1 from event_private.registrations r left join event_private.events e on e.event_id = r.event_id where e.event_id is null) then
    raise exception 'Prerequisite: existing registrations reference missing event metadata. Reconcile before applying; no rows were changed.';
  end if;
end $constraints$;

-- Add safeguards without dropping an existing constraint or index.
do $safeguards$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'event_private.registrations'::regclass and conname = 'event_registration_values_v1') then
    alter table event_private.registrations add constraint event_registration_values_v1 check (
      full_name = btrim(full_name) and char_length(full_name) between 1 and 120 and full_name !~ '[[:cntrl:]]'
      and char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and email_normalized = lower(btrim(email)) and status in ('pending', 'verified', 'expired', 'cancelled')
      and (token_hash is null or token_hash ~ '^[0-9a-f]{64}$')
      and ((status = 'pending' and token_hash is not null and token_expires_at is not null)
        or (status <> 'pending' and token_hash is null and token_expires_at is null))
      and (status <> 'verified' or verified_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'event_private.registrations'::regclass and conname = 'registrations_event_id_fkey') then
    alter table event_private.registrations add constraint registrations_event_id_fkey foreign key (event_id) references event_private.events(event_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'event_private.email_outbox'::regclass and conname = 'email_outbox_attempts_nonnegative') then
    alter table event_private.email_outbox add constraint email_outbox_attempts_nonnegative check (attempts >= 0);
  end if;
end $safeguards$;
create index if not exists registrations_pending_expiry_idx on event_private.registrations (event_id, token_expires_at) where status = 'pending';
create index if not exists email_outbox_undelivered_idx on event_private.email_outbox (created_at) where delivered_at is null;
create index if not exists event_rate_limits_cleanup_idx on event_private.rate_limits (event_id, window_start);
insert into event_private.events (event_id, ends_at, status)
values ('beyond-the-firewall', timestamptz '2026-10-29 16:00:00+00', 'active') on conflict (event_id) do nothing;

alter table event_private.events enable row level security;
alter table event_private.registrations enable row level security;
alter table event_private.photography_preferences enable row level security;
alter table event_private.email_outbox enable row level security;
alter table event_private.rate_limits enable row level security;
revoke all on schema event_private from public, anon, authenticated, service_role;
revoke all on all tables in schema event_private from public, anon, authenticated, service_role;
alter default privileges in schema event_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema event_private revoke execute on functions from public, anon, authenticated, service_role;

create or replace function public.event_rate_limit(p_bucket text, p_max integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = pg_catalog, event_private as $$
declare n integer;
begin
  if p_bucket is null or p_bucket !~ '^[0-9a-f]{64}$' or p_max is null or p_max not between 1 and 10000
     or p_seconds is null or p_seconds not between 1 and 86400 then return false; end if;
  insert into event_private.rate_limits as limits (bucket, event_id, window_start, requests)
  values (p_bucket, 'beyond-the-firewall', clock_timestamp(), 1)
  on conflict (bucket) do update set
    window_start = case when limits.window_start + make_interval(secs => p_seconds) <= clock_timestamp() then clock_timestamp() else limits.window_start end,
    requests = case when limits.window_start + make_interval(secs => p_seconds) <= clock_timestamp() then 1 else least(limits.requests, 10000) + 1 end
  where limits.event_id is null or limits.event_id = 'beyond-the-firewall' returning requests into n;
  return coalesce(n <= p_max, false);
end $$;

create or replace function public.event_register_pending(p_event text, p_name text, p_email text, p_normalized text, p_consent boolean, p_hash text, p_expires timestamptz, p_end timestamptz)
returns uuid language plpgsql security definer set search_path = pg_catalog, event_private as $$
declare v_registration_id uuid; v_now timestamptz := clock_timestamp();
begin
  if p_event is distinct from 'beyond-the-firewall' or p_end is distinct from timestamptz '2026-10-29 16:00:00+00'
     or v_now >= p_end or p_consent is null or p_name is null or p_name <> btrim(p_name)
     or char_length(p_name) not between 1 and 120 or p_name ~ '[[:cntrl:]]'
     or p_email is null or char_length(p_email) not between 3 and 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_normalized is distinct from lower(btrim(p_email)) or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
     or p_expires is null or p_expires <= v_now or p_expires > v_now + interval '2 hours' then return null; end if;
  perform 1 from event_private.events e where e.event_id = p_event and e.ends_at = p_end and e.status = 'active' for share;
  if not found then return null; end if;
  insert into event_private.registrations as r (event_id, full_name, email, email_normalized, status, token_hash, token_expires_at)
  select p_event, p_name, p_email, p_normalized, 'pending', p_hash, least(p_expires, p_end) where clock_timestamp() < p_end
  on conflict (event_id, email_normalized) do nothing
  returning id into v_registration_id;
  if v_registration_id is not null then
    insert into event_private.photography_preferences (registration_id, consent, consent_version)
    values (v_registration_id, p_consent, '1')
    on conflict (registration_id) do update set consent = excluded.consent, consent_version = excluded.consent_version, recorded_at = clock_timestamp();
  end if;
  return v_registration_id;
end $$;

create or replace function public.event_resend_pending(p_event text, p_normalized text, p_hash text, p_expires timestamptz, p_end timestamptz)
returns text language plpgsql security definer set search_path = pg_catalog, event_private as $$
declare recipient text; v_now timestamptz := clock_timestamp();
begin
  if p_event is distinct from 'beyond-the-firewall' or p_end is distinct from timestamptz '2026-10-29 16:00:00+00'
     or v_now >= p_end or p_normalized is null or p_normalized <> lower(btrim(p_normalized))
     or char_length(p_normalized) not between 3 and 254 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
     or p_expires is null or p_expires <= v_now or p_expires > v_now + interval '2 hours' then return null; end if;
  perform 1 from event_private.events e where e.event_id = p_event and e.ends_at = p_end and e.status = 'active' for share;
  if not found then return null; end if;
  update event_private.registrations set status = 'pending', token_hash = p_hash, token_expires_at = least(p_expires, p_end), updated_at = clock_timestamp()
  where event_id = p_event and email_normalized = p_normalized and status in ('pending', 'expired') and clock_timestamp() < p_end
  returning email into recipient;
  return recipient;
end $$;

create or replace function public.event_verify_registration(p_event text, p_hash text, p_end timestamptz)
returns boolean language plpgsql security definer set search_path = pg_catalog, event_private as $$
declare v_registration_id uuid;
begin
  if p_event is distinct from 'beyond-the-firewall' or p_end is distinct from timestamptz '2026-10-29 16:00:00+00'
     or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or clock_timestamp() >= p_end then return false; end if;
  perform 1 from event_private.events e where e.event_id = p_event and e.ends_at = p_end and e.status = 'active' for share;
  if not found then return false; end if;
  update event_private.registrations set status = 'verified', token_hash = null, token_expires_at = null, verified_at = clock_timestamp(), updated_at = clock_timestamp()
  where event_id = p_event and token_hash = p_hash and status = 'pending' and token_expires_at > clock_timestamp() and clock_timestamp() < p_end
  returning id into v_registration_id;
  if v_registration_id is null then return false; end if;
  insert into event_private.email_outbox (registration_id) values (v_registration_id) on conflict (registration_id) do nothing;
  return true;
end $$;

-- Only the known legacy return shape needs replacing. The default RESTRICT
-- makes unexpected dependencies abort the transaction; never use CASCADE.
do $upgrade_outbox$
declare result_type text;
begin
  select pg_get_function_result(oid) into result_type from pg_proc where oid = to_regprocedure('public.event_claim_emails(text)');
  if result_type = 'TABLE(job_id uuid, full_name text, email text)' then
    drop function public.event_claim_emails(text);
  elsif result_type is not null and result_type <> 'TABLE(job_id uuid, full_name text, email text, lease_token uuid)' then
    raise exception 'Prerequisite: public.event_claim_emails(text) has an unknown return shape; review it before upgrading.';
  end if;
  if to_regprocedure('public.event_finish_email(uuid,boolean)') is not null then
    drop function public.event_finish_email(uuid, boolean);
  end if;
end $upgrade_outbox$;

create or replace function public.event_claim_emails(p_event text)
returns table(job_id uuid, full_name text, email text, lease_token uuid) language sql security definer set search_path = pg_catalog, event_private as $$
  with jobs as (
    select o.id from event_private.email_outbox o join event_private.registrations r on r.id = o.registration_id
    where p_event = 'beyond-the-firewall' and r.event_id = p_event and r.status = 'verified'
      and o.delivered_at is null and (o.attempts = 0 or coalesce(o.first_attempt_at, o.created_at) > clock_timestamp() - interval '23 hours')
      and (o.leased_until is null or o.leased_until <= clock_timestamp())
    order by o.created_at, o.id limit 20 for update of o skip locked
  ), claimed as (
    update event_private.email_outbox o set leased_until = clock_timestamp() + interval '5 minutes', lease_token = gen_random_uuid(),
      first_attempt_at = case when o.attempts = 0 then clock_timestamp() else coalesce(o.first_attempt_at, o.created_at) end,
      attempts = least(o.attempts, 1000000) + 1
    from jobs where o.id = jobs.id returning o.id, o.registration_id, o.lease_token
  )
  select claimed.id, r.full_name, r.email, claimed.lease_token from claimed join event_private.registrations r on r.id = claimed.registration_id;
$$;

create or replace function public.event_finish_email(p_job uuid, p_accepted boolean, p_lease_token uuid)
returns void language sql security definer set search_path = pg_catalog, event_private as $$
  update event_private.email_outbox o set delivered_at = case when p_accepted then clock_timestamp() else null end,
    leased_until = case when p_accepted then null else clock_timestamp() + interval '5 minutes' end, lease_token = null
  where o.id = p_job and p_accepted is not null and p_lease_token is not null and o.lease_token = p_lease_token
    and o.leased_until > clock_timestamp() and o.delivered_at is null
    and exists (select 1 from event_private.registrations r where r.id = o.registration_id and r.event_id = 'beyond-the-firewall' and r.status = 'verified');
$$;

create or replace function public.event_cleanup(p_event text, p_end timestamptz, p_retention_days integer default 7)
returns table(expired_tokens bigint, removed_registrations bigint, stalled_emails bigint) language plpgsql security definer set search_path = pg_catalog, event_private as $$
declare expired_count bigint; removed_count bigint; stalled_count bigint; v_now timestamptz := clock_timestamp();
begin
  if p_event is distinct from 'beyond-the-firewall' or p_end is distinct from timestamptz '2026-10-29 16:00:00+00'
     or p_retention_days is distinct from 7 then
    raise exception 'Invalid cleanup configuration: expected beyond-the-firewall, 2026-10-29T16:00:00Z, and seven-day retention.';
  end if;
  perform 1 from event_private.events e where e.event_id = p_event and e.ends_at = p_end for update;
  if not found then raise exception 'Event configuration mismatch; cleanup did not run.'; end if;
  update event_private.events set status = 'completed' where event_id = p_event and v_now >= ends_at;
  update event_private.registrations set token_hash = null, token_expires_at = null, status = 'expired', updated_at = v_now
    where event_id = p_event and status = 'pending' and (token_expires_at <= v_now or v_now >= p_end);
  get diagnostics expired_count = row_count;
  select count(*) into stalled_count from event_private.email_outbox o join event_private.registrations r on r.id = o.registration_id
    where r.event_id = p_event and o.delivered_at is null
      and (v_now >= p_end or (o.attempts > 0 and coalesce(o.first_attempt_at, o.created_at) <= v_now - interval '23 hours'));
  delete from event_private.registrations where event_id = p_event and v_now >= p_end + make_interval(days => p_retention_days);
  get diagnostics removed_count = row_count;
  delete from event_private.rate_limits where event_id = p_event and window_start < v_now - interval '2 days';
  return query select expired_count, removed_count, stalled_count;
end $$;

-- Every overload with these names loses public access. Only these supported
-- signatures receive backend execution. No new role, JWT or exposed schema.
do $permissions$
declare item record; executor text;
begin
  for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array['event_rate_limit', 'event_register_pending', 'event_resend_pending', 'event_verify_registration', 'event_claim_emails', 'event_finish_email', 'event_cleanup']) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', item.signature);
    if exists (select 1 from pg_roles where rolname = 'gcs_event_worker') then
      execute format('revoke all on function %s from gcs_event_worker', item.signature);
    end if;
  end loop;
  for executor in select rolname from pg_roles where rolname in ('service_role', 'gcs_event_worker') loop
    execute format('revoke all on schema event_private from %I', executor);
    execute format('revoke all on all tables in schema event_private from %I', executor);
    execute format('grant usage on schema public to %I', executor);
    for item in select signature from (values
      ('public.event_rate_limit(text,integer,integer)'),
      ('public.event_register_pending(text,text,text,text,boolean,text,timestamptz,timestamptz)'),
      ('public.event_verify_registration(text,text,timestamptz)'), ('public.event_claim_emails(text)'),
      ('public.event_finish_email(uuid,boolean,uuid)'), ('public.event_cleanup(text,timestamptz,integer)')
    ) as supported(signature) loop
      execute format('grant execute on function %s to %I', item.signature, executor);
    end loop;
  end loop;
  if has_schema_privilege('anon', 'event_private', 'usage') or has_schema_privilege('authenticated', 'event_private', 'usage') then
    raise exception 'Prerequisite: inherited role membership still grants public users event_private access; review memberships.';
  end if;
end $permissions$;
notify pgrst, 'reload schema';
commit;
