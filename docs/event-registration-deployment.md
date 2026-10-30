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
    'event_resend_pending_v2',
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

Then open and run these complete files in separate Supabase SQL Editor queries, in order:

1. `supabase/migrations/20261021090000_event_registration.sql`
2. `supabase/migrations/20261030120000_security_hardening.sql`

A successful run ends with `Success. No rows returned`. Both files are safe to rerun in this order. The hardening migration creates a non-login `gcs_event_worker` role, stops duplicate pending submissions from changing a person's stored details, and replaces the resend RPC with a version that returns those immutable details for the verification email. Any `Prerequisite:` error rolls back the whole transaction; resolve that specific conflict before retrying. Do not edit out a preflight check or add `CASCADE`.

Afterward, confirm access without reading attendee rows:

```sql
select
  has_schema_privilege('anon', 'event_private', 'usage') as anon_schema_access,
  has_schema_privilege('authenticated', 'event_private', 'usage') as authenticated_schema_access,
  has_function_privilege('anon', 'public.event_register_pending(text,text,text,text,boolean,text,timestamptz,timestamptz)', 'execute') as anon_register_rpc,
  has_function_privilege('gcs_event_worker', 'public.event_register_pending(text,text,text,text,boolean,text,timestamptz,timestamptz)', 'execute') as worker_register_rpc,
  has_function_privilege('gcs_event_worker', 'public.event_resend_pending(text,text,text,timestamptz,timestamptz)', 'execute') as worker_legacy_resend_rpc,
  has_function_privilege('gcs_event_worker', 'public.event_resend_pending_v2(text,text,text,timestamptz,timestamptz)', 'execute') as worker_resend_rpc,
  has_table_privilege('gcs_event_worker', 'event_private.registrations', 'select') as worker_table_select;
```

The expected values are `false`, `false`, `false`, `true`, `false`, `true`, `false`.

## Restricted production credential

The website intentionally refuses `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in production. Create a bearer JWT signed by a key trusted by this Supabase project with the claim `role: gcs_event_worker` and a future `exp`. Supabase's current signing-key workflow documents the safe process; with its CLI and your imported private signing key the token command is:

```bash
supabase gen bearer-jwt --role gcs_event_worker
```

Follow [Supabase's JWT signing-key guide](https://supabase.com/docs/guides/auth/signing-keys) rather than pasting a signing key or JWT into source control. Put only the minted token in Vercel as `SUPABASE_EVENT_WORKER_JWT` for Production, redeploy, and verify the event/contact/password-reset flows. Then remove `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from Vercel. Keep the publishable key: Supabase requires it in the `apikey` header while the worker JWT is sent as the bearer token.

Set `PRIVACY_CONTACT_EMAIL` to the private committee mailbox in Vercel Production before deploying the private contact form. It is a recipient setting, not a public `NEXT_PUBLIC_` variable.
