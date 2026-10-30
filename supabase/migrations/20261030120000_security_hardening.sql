-- Security hardening for public workflows and authenticated quiz submissions.
-- Apply after 20261021090000_event_registration.sql. Safe to rerun.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 120000);

-- A no-login PostgREST role limits the web application to the explicitly
-- granted RPCs. A signed JWT with {"role":"gcs_event_worker"} selects it.
do $worker$
begin
  if not exists (select 1 from pg_roles where rolname = 'gcs_event_worker') then
    create role gcs_event_worker nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role gcs_event_worker nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant gcs_event_worker to authenticator;
  end if;
end $worker$;

-- A duplicate registration never overwrites an unverified person's name,
-- photography choice, or active token. The separate resend flow is the only
-- operation allowed to rotate a pending token.
create or replace function public.event_register_pending(
  p_event text, p_name text, p_email text, p_normalized text, p_consent boolean,
  p_hash text, p_expires timestamptz, p_end timestamptz
)
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
  insert into event_private.registrations (event_id, full_name, email, email_normalized, status, token_hash, token_expires_at)
  select p_event, p_name, p_email, p_normalized, 'pending', p_hash, least(p_expires, p_end)
  where clock_timestamp() < p_end
  on conflict (event_id, email_normalized) do nothing
  returning id into v_registration_id;
  if v_registration_id is not null then
    insert into event_private.photography_preferences (registration_id, consent, consent_version)
    values (v_registration_id, p_consent, '1');
  end if;
  return v_registration_id;
end $$;

-- Return the immutable pending details with a rotated token so every email can
-- tell the recipient exactly what they are being asked to confirm.
create or replace function public.event_resend_pending_v2(
  p_event text, p_normalized text, p_hash text, p_expires timestamptz, p_end timestamptz
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, event_private as $$
declare v_registration_id uuid; v_email text; v_name text; v_consent boolean; v_now timestamptz := clock_timestamp();
begin
  if p_event is distinct from 'beyond-the-firewall' or p_end is distinct from timestamptz '2026-10-29 16:00:00+00'
     or v_now >= p_end or p_normalized is null or p_normalized <> lower(btrim(p_normalized))
     or char_length(p_normalized) not between 3 and 254 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
     or p_expires is null or p_expires <= v_now or p_expires > v_now + interval '2 hours' then return null; end if;
  perform 1 from event_private.events e where e.event_id = p_event and e.ends_at = p_end and e.status = 'active' for share;
  if not found then return null; end if;
  update event_private.registrations set status = 'pending', token_hash = p_hash,
    token_expires_at = least(p_expires, p_end), updated_at = clock_timestamp()
  where event_id = p_event and email_normalized = p_normalized and status in ('pending', 'expired') and clock_timestamp() < p_end
  returning id, email, full_name into v_registration_id, v_email, v_name;
  if v_registration_id is null then return null; end if;
  select consent into v_consent from event_private.photography_preferences where registration_id = v_registration_id;
  if v_consent is null then return null; end if;
  return jsonb_build_object('email', v_email, 'full_name', v_name, 'consent', v_consent);
end $$;

-- The old resend RPC returned only an address and cannot support an auditable
-- confirmation summary. It remains present for safe migration rollback but has
-- no executable grants.
revoke all on function public.event_resend_pending(text,text,text,timestamptz,timestamptz) from public, anon, authenticated, service_role, gcs_event_worker;
revoke all on function public.event_resend_pending_v2(text,text,text,timestamptz,timestamptz) from public, anon, authenticated, service_role, gcs_event_worker;

do $permissions$
declare item text;
begin
  revoke all on schema event_private from gcs_event_worker;
  revoke all on all tables in schema event_private from gcs_event_worker;
  grant usage on schema public to gcs_event_worker;
  foreach item in array array[
    'public.event_rate_limit(text,integer,integer)',
    'public.event_register_pending(text,text,text,text,boolean,text,timestamptz,timestamptz)',
    'public.event_verify_registration(text,text,timestamptz)',
    'public.event_claim_emails(text)',
    'public.event_finish_email(uuid,boolean,uuid)',
    'public.event_cleanup(text,timestamptz,integer)',
    'public.event_resend_pending_v2(text,text,text,timestamptz,timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, gcs_event_worker', item);
    execute format('grant execute on function %s to service_role, gcs_event_worker', item);
  end loop;
end $permissions$;

notify pgrst, 'reload schema';
commit;
