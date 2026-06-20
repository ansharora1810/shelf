-- Shelf — baseline schema (authoritative; single source of truth).
--
-- WHY THIS FILE EXISTS
-- The schema was built by 11 migrations applied directly to the live project
-- (hpnxuouiyrhlqabkgmis) via the Supabase MCP/CLI, but only the last two were
-- ever saved as files (client_assisted_fetch, paced_dispatch). The 9 earlier
-- ones — base tables, RLS, grants, the definer-function lockdown, the tag RPCs,
-- the source classifier — lived only in the live DB. This file consolidates the
-- COMPLETE current schema (original + §11.1 staged pipeline + §11.2 paced
-- dispatch) into one reproducible migration, so the DB can be rebuilt from code.
--
-- It also fixes two latent bugs from the direct-DB era:
--   * items.status default was still 'processing' — invalid under the staged
--     CHECK (the only reason it never bit: create-item always sets status).
--   * the items DELETE policy still keyed on the renamed 'processing' state, so
--     deletes were allowed on every non-terminal state. Now: ready/failed only.
--
-- MANUAL PREREQUISITES (not in this file — by design):
--   * Vault secret `worker_secret` must exist (the drainers read it to auth the
--     pg_net worker calls). It is a secret, never committed; it already exists on
--     the live project and survives a table wipe. A from-zero project recreates it:
--       select vault.create_secret('<value>', 'worker_secret');
--   * Edge functions (create-item, fetch-item, enrich-item) deploy separately
--     (supabase functions deploy …) — not part of this SQL.
--
-- Applies to a clean slate: tables use plain CREATE (run the teardown first if
-- objects already exist). Everything else is idempotent.

begin;

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists pgcrypto    schema extensions;  -- gen_random_uuid()
create extension if not exists moddatetime schema extensions;  -- updated_at maintenance
create extension if not exists pg_net;                          -- async HTTP (drainers → workers)
create extension if not exists pg_cron;                         -- watchdog + drainers + log prune

-- ── Tables ───────────────────────────────────────────────────────────────────
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  name       text not null
               constraint projects_name_check
               check (char_length(name) >= 1 and char_length(name) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  type               text not null default 'link'
                       constraint items_type_check
                       check (type = any (array['link','image','pdf'])),
  url                text,
  normalized_url     text,
  source             text,                       -- real normalized host (tldts); free text
  -- staged-pipeline lifecycle (§11.1): started → fetched|fetch_failed →
  -- ready|failed; awaiting_upload reserved for v2 file uploads. The app's
  -- residential-IP fetch also lands `fetched` (provenance in app_fetch_attempts).
  status             text not null default 'started'
                       constraint items_status_check
                       check (status = any (array[
                         'awaiting_upload','started','fetched',
                         'fetch_failed','ready','failed'])),
  status_changed_at  timestamptz,                 -- time-in-state clock (trigger-maintained)
  dispatched_at      timestamptz,                 -- paced-dispatch claim (§11.2); nulled on status change
  app_fetch_attempts int not null default 0,      -- client-assisted fetch attempt cap (§11.1)
  raw_content        text,                        -- immutable embedding/dedup base (v2)
  name               text,
  summary            text,
  tags               text[] not null default '{}',
  thumbnail_url      text,
  consume_time       int,                         -- seconds; null hides the badge
  project_id         uuid references public.projects (id) on delete set null,
  reminder_enabled   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists items_user_id_created_at_idx
  on public.items (user_id, created_at desc);
create index if not exists items_project_id_idx
  on public.items (project_id) where project_id is not null;
create unique index if not exists items_user_normalized_url_key   -- per-user dedup (§8.3)
  on public.items (user_id, normalized_url)
  where type = 'link' and normalized_url is not null;
create index if not exists projects_user_id_idx
  on public.projects (user_id);

-- ── Row-level security ───────────────────────────────────────────────────────
alter table public.items    enable row level security;
alter table public.projects enable row level security;

drop policy if exists "own items - select" on public.items;
drop policy if exists "own items - insert" on public.items;
drop policy if exists "own items - update" on public.items;
drop policy if exists "own items - delete" on public.items;
create policy "own items - select" on public.items
  for select using (user_id = auth.uid());
create policy "own items - insert" on public.items
  for insert with check (user_id = auth.uid());
create policy "own items - update" on public.items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- delete only on terminal states (was: status <> 'processing' — a dead value).
create policy "own items - delete" on public.items
  for delete using (user_id = auth.uid() and status = any (array['ready','failed']));

drop policy if exists "own projects - select" on public.projects;
drop policy if exists "own projects - insert" on public.projects;
drop policy if exists "own projects - update" on public.projects;
drop policy if exists "own projects - delete" on public.projects;
create policy "own projects - select" on public.projects
  for select using (user_id = auth.uid());
create policy "own projects - insert" on public.projects
  for insert with check (user_id = auth.uid());
create policy "own projects - update" on public.projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own projects - delete" on public.projects
  for delete using (user_id = auth.uid());

-- ── Table grants (RLS is the authz layer; anon gets no DML) ──────────────────
grant select, insert, update, delete on public.items, public.projects
  to authenticated, service_role;
revoke select, insert, update, delete on public.items, public.projects
  from anon;

-- ── Tag-vocabulary RPCs (called by enrich-item) ──────────────────────────────
create or replace function public.get_user_tags(p_user_id uuid, p_exclude_id uuid default null)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct tag), '{}')
  from public.items, unnest(tags) as tag
  where user_id = p_user_id
    and (p_exclude_id is null or id <> p_exclude_id);
$$;

create or replace function public.add_item_tags(p_id uuid, p_tags text[])
returns void
language sql
as $$
  update public.items
  set tags = (select coalesce(array_agg(distinct tag), '{}') from unnest(tags || p_tags) as tag)
  where id = p_id;
$$;

-- ── updated_at maintenance ───────────────────────────────────────────────────
create trigger items_set_updated_at
  before update on public.items
  for each row execute function extensions.moddatetime('updated_at');
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function extensions.moddatetime('updated_at');

-- ── Status lifecycle: time-in-state clock + paced-dispatch claim clearing ────
-- Bumps status_changed_at on insert and on real status changes; a status change
-- also frees the dispatch slot (nulls dispatched_at). A drainer's claim sets
-- dispatched_at WITHOUT changing status, so this trigger leaves it intact.
create or replace function public.shelf_touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.status_changed_at = now();
  elsif old.status is distinct from new.status then
    new.status_changed_at = now();
    new.dispatched_at = null;
  end if;
  return new;
end;
$$;

create trigger items_set_status_changed_at
  before insert or update on public.items
  for each row execute function public.shelf_touch_status_changed_at();

-- ── Watchdog (pg_cron, per-state; §11.1) ─────────────────────────────────────
-- Time-gated rules use status_changed_at (time-in-state); the fetch_failed rule
-- is count-gated (no time component) so offline-app rows can wait indefinitely.
create or replace function public.shelf_watchdog()
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.items set status = 'fetch_failed'
   where status = 'started'
     and status_changed_at < now() - interval '90 seconds';

  update public.items set status = 'failed'
   where status = 'fetched'
     and status_changed_at < now() - interval '90 seconds';

  update public.items set status = 'failed'
   where status = 'fetch_failed'
     and app_fetch_attempts >= 3;

  update public.items set status = 'failed'
   where status = 'awaiting_upload'
     and status_changed_at < now() - interval '3 minutes';
$$;

-- ── Paced-dispatch drainers (pg_cron; §11.2) ─────────────────────────────────
-- The items table IS the queue, partitioned by status (started = fetch queue;
-- fetched = enrich queue). Each drainer counts in-flight rows for
-- its stage and, while below K, claims undispatched rows (FOR UPDATE SKIP LOCKED),
-- stamps dispatched_at, and fires the worker via pg_net. K=1 = serial per stage.
create or replace function public.shelf_drain_fetch()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  k_fetch constant int := 1;   -- TUNE: max concurrent fetch-item invocations
  secret  text;
  in_flight int;
  slots   int;
  r       record;
begin
  select count(*) into in_flight
  from public.items
  where status = 'started' and dispatched_at is not null;

  slots := k_fetch - in_flight;
  if slots <= 0 then
    return;
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'worker_secret';

  for r in
    with claimed as (
      select id
      from public.items
      where status = 'started' and dispatched_at is null
      order by created_at
      for update skip locked
      limit slots
    )
    update public.items i
    set dispatched_at = now()
    from claimed
    where i.id = claimed.id
    returning i.id
  loop
    perform net.http_post(
      url     => 'https://hpnxuouiyrhlqabkgmis.supabase.co/functions/v1/fetch-item',
      body    => jsonb_build_object('item_id', r.id::text, 'mode', 'fetch'),
      headers => jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-worker-secret', secret
                 )
    );
  end loop;
end;
$$;

create or replace function public.shelf_drain_enrich()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  k_enrich constant int := 1;  -- TUNE: max concurrent enrich-item invocations (Gemini rate limit)
  secret   text;
  in_flight int;
  slots    int;
  r        record;
begin
  select count(*) into in_flight
  from public.items
  where status = 'fetched' and dispatched_at is not null;

  slots := k_enrich - in_flight;
  if slots <= 0 then
    return;
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'worker_secret';

  for r in
    with claimed as (
      select id
      from public.items
      where status = 'fetched' and dispatched_at is null
      order by created_at
      for update skip locked
      limit slots
    )
    update public.items i
    set dispatched_at = now()
    from claimed
    where i.id = claimed.id
    returning i.id
  loop
    perform net.http_post(
      url     => 'https://hpnxuouiyrhlqabkgmis.supabase.co/functions/v1/enrich-item',
      body    => jsonb_build_object('item_id', r.id::text, 'mode', 'enrich'),
      headers => jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-worker-secret', secret
                 )
    );
  end loop;
end;
$$;

-- Lock the cron-invoked definer functions to the owner (postgres runs them via
-- pg_cron). Matches the original shelf_lock_down_definer_fns migration.
revoke execute on function public.shelf_watchdog()     from public;
revoke execute on function public.shelf_drain_fetch()  from public;
revoke execute on function public.shelf_drain_enrich() from public;

-- ── Auto-enable RLS on any future public table (safety net) ──────────────────
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog','information_schema')
       and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (system schema or not enforced: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- ── Realtime publication ─────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='items') then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='projects') then
    alter publication supabase_realtime add table public.projects;
  end if;
end $$;

-- ── Scheduled jobs (pg_cron; cron.schedule upserts by name) ──────────────────
-- Requires Postgres ≥ 15 / pg_cron ≥ 1.5 for the seconds-level drainer schedule
-- (live project: PG 17.6, pg_cron 1.6.4 — verified).
select cron.schedule('shelf-watchdog',       '* * * * *', 'select public.shelf_watchdog()');
select cron.schedule('shelf-drain-fetch',    '5 seconds', 'select public.shelf_drain_fetch()');
select cron.schedule('shelf-drain-enrich',   '5 seconds', 'select public.shelf_drain_enrich()');
select cron.schedule('shelf-cron-log-prune', '0 * * * *',
  $prune$delete from cron.job_run_details where end_time < now() - interval '24 hours'$prune$);

commit;
