# Beyond the Firewall deployment

The migration is designed for the Supabase SQL Editor and runs in one transaction. It does not drop tables, attendee rows, or unrelated records. Run these read-only checks first in the intended project:

```sql
-- 1. Confirm this is a Supabase database with the required API roles.
select current_database() as database_name,
       exists (select 1 from pg_roles where rolname = 'service_role') as has_service_role,
       exists (select 1 from pg_roles where rolname = 'anon') as has_anon,
       exists (select 1 from pg_roles where rolname = 'authenticated') as has_authenticated;

-- 2. Inventory any earlier event objects. An empty result is expected for a fresh install.
select n.nspname as schema_name, c.relname as object_name, c.relkind as object_kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'event_private'
order by c.relname;

select p.oid::regprocedure as existing_event_function,
       pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = any (array[
    'event_rate_limit', 'event_register_pending', 'event_resend_pending',
    'event_verify_registration', 'event_claim_emails', 'event_finish_email',
    'event_cleanup'
  ])
order by 1;

-- 3. Check the one event row without reading attendee data.
select event_id, ends_at, status
from event_private.events
where to_regclass('event_private.events') is not null
  and event_id = 'beyond-the-firewall';

-- 4. Aggregate-only checks for rows that need review. Run only if the table exists.
select
  count(*) filter (where email_normalized <> lower(btrim(email))) as non_normalized_emails,
  count(*) filter (where status = 'pending' and (token_hash is null or token_expires_at is null)) as invalid_pending_rows,
  count(*) filter (where status <> 'pending' and (token_hash is not null or token_expires_at is not null)) as tokens_on_non_pending_rows
from event_private.registrations
where to_regclass('event_private.registrations') is not null;

select count(*) as case_insensitive_duplicate_groups
from (
  select event_id, lower(btrim(email))
  from event_private.registrations
  where to_regclass('event_private.registrations') is not null
  group by event_id, lower(btrim(email))
  having count(*) > 1
) duplicates;

-- 5. Custom triggers or elevated legacy worker roles require manual review.
select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'event_private' and not t.tgisinternal;

select rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
from pg_roles
where rolname = 'gcs_event_worker';
```

If the private tables do not exist, queries 3 and 4 will fail at parse time even with the `to_regclass` filter; skip them. If they do exist, the event end must be `2026-10-29 16:00:00+00`, all aggregate issue counts must be zero, there must be no case-insensitive duplicate group, no unexpected custom trigger, and any existing `gcs_event_worker` must be a non-login role without elevated privileges.

Then open `supabase/migrations/20261021090000_event_registration.sql`, paste the complete file into a new Supabase SQL Editor query, and run it once. A successful run ends with `Success. No rows returned`. It is safe to rerun. Any `Prerequisite:` error rolls back the whole transaction; resolve that specific conflict before retrying. Do not edit out a preflight check or add `CASCADE`.

Afterward, confirm access without reading attendee rows:

```sql
select
  has_schema_privilege('anon', 'event_private', 'usage') as anon_schema_access,
  has_schema_privilege('authenticated', 'event_private', 'usage') as authenticated_schema_access,
  has_function_privilege('anon', 'public.event_register_pending(text,text,text,text,boolean,text,timestamptz,timestamptz)', 'execute') as anon_register_rpc,
  has_function_privilege('service_role', 'public.event_register_pending(text,text,text,text,boolean,text,timestamptz,timestamptz)', 'execute') as backend_register_rpc;
```

The expected values are `false`, `false`, `false`, `true`.
