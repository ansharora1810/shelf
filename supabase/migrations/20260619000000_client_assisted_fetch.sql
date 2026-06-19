-- Client-assisted fetch fallback (PRD §11.1).
--
-- NOT auto-applied. This repo writes migrations as files; the live project
-- (hpnxuouiyrhlqabkgmis) is migrated by a human via the Supabase MCP /
-- dashboard. Applying this file is a separate, gated step.
--
-- Manual follow-ups (all gated, human-run). ORDER MATTERS — see SEQUENCING below:
--   1. Deploy the THREE edge functions (create-item changed too — it now inserts
--      status 'started', not 'processing'):
--        supabase functions deploy create-item --project-ref hpnxuouiyrhlqabkgmis
--        supabase functions deploy fetch-item  --project-ref hpnxuouiyrhlqabkgmis
--        supabase functions deploy enrich-item --project-ref hpnxuouiyrhlqabkgmis
--   2. Apply this migration right after the deploys (it swaps the status CHECK).
--   3. Set WORKER_SECRET on fetch-item AND enrich-item (must equal Vault
--      `worker_secret`); GEMINI_API_KEY on enrich-item. Vault `worker_secret`
--      already exists (read by the fire triggers) — no change unless rotating.
--   4. The old `process-item` function is now orphaned (no trigger calls it) —
--      delete it after verifying the cutover.
--
-- SEQUENCING WINDOW: this removes 'processing' from the CHECK and adds 'started'.
-- New create-item inserts 'started'; old create-item inserts 'processing'. So the
-- new create-item deploy and this migration must land together — a save in the
-- gap violates the CHECK and the user retries. With ~0 live rows this is
-- negligible; for zero downtime, transitionally keep BOTH 'processing' and
-- 'started' in the CHECK here and drop 'processing' in a later migration.
--
-- `items.status` is a TEXT column with a CHECK constraint (items_status_check),
-- NOT a Postgres enum — so the value set is evolved by replacing the CHECK, and
-- there is no ADD VALUE / RENAME VALUE / cross-txn restriction.

begin;

-- 1. Status values: processing → started; add fetched / fetch_failed /
--    client_fetched; keep ready / failed / awaiting_upload. Backfill existing
--    `processing` rows first so they satisfy the new constraint.
update public.items
set    status = 'started'
where  status = 'processing';

alter table public.items
  drop constraint items_status_check;

alter table public.items
  add constraint items_status_check
  check (status = any (array[
    'awaiting_upload',
    'started',
    'fetched',
    'fetch_failed',
    'client_fetched',
    'ready',
    'failed'
  ]::text[]));

-- 2. New columns. `app_fetch_attempts` bounds the client's claim-then-work
--    retries; `status_changed_at` measures time-in-state for the watchdog.
--    Backfill status_changed_at from the old processing_started_at (or
--    created_at) BEFORE dropping the old column, then drop it.
alter table public.items
  add column app_fetch_attempts int not null default 0;

alter table public.items
  add column status_changed_at timestamptz;

update public.items
set    status_changed_at = coalesce(processing_started_at, created_at, now());

alter table public.items
  drop column processing_started_at;

-- 3. Maintain status_changed_at automatically: set it on insert and whenever
--    `status` actually changes. The app's app_fetch_attempts increment does NOT
--    change status, so it won't bump this — deadlines measure true time-in-state.
create or replace function public.shelf_touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger items_set_status_changed_at
  before insert or update on public.items
  for each row
  execute function public.shelf_touch_status_changed_at();

-- 4. fetch-item kick. Renames the worker target from process-item and switches
--    the mode to 'fetch'. Same Vault-secret pg_net pattern as before. Fires on
--    AFTER INSERT when the row starts in `started` (was `processing`).
create or replace function public.shelf_fire_worker()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'worker_secret';

  perform net.http_post(
    url     => 'https://hpnxuouiyrhlqabkgmis.supabase.co/functions/v1/fetch-item',
    body    => jsonb_build_object('item_id', new.id::text, 'mode', 'fetch'),
    headers => jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-worker-secret', secret
               )
  );
  return new;
end;
$$;

drop trigger if exists items_fire_worker on public.items;

create trigger items_fire_worker
  after insert on public.items
  for each row
  when (new.status = 'started' and new.type = 'link')
  execute function public.shelf_fire_worker();

-- 5. enrich-item kick. AFTER UPDATE when the row enters `fetched` or
--    `client_fetched` (content is now present). `ready` is excluded from the
--    condition so enrich-item's own terminal write can't self-trigger.
create or replace function public.shelf_fire_enrich()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'worker_secret';

  perform net.http_post(
    url     => 'https://hpnxuouiyrhlqabkgmis.supabase.co/functions/v1/enrich-item',
    body    => jsonb_build_object('item_id', new.id::text, 'mode', 'enrich'),
    headers => jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-worker-secret', secret
               )
  );
  return new;
end;
$$;

create trigger items_fire_enrich
  after update on public.items
  for each row
  when (new.status in ('fetched', 'client_fetched')
        and old.status is distinct from new.status)
  execute function public.shelf_fire_enrich();

-- 6. Watchdog — per-state rules (PRD §11.1). Time-gated rules use
--    status_changed_at (time-in-state); the fetch_failed rule is count-gated
--    with no time component. Still scheduled every minute by the existing
--    pg_cron job (select public.shelf_watchdog()) — the schedule is untouched.
create or replace function public.shelf_watchdog()
returns void
language sql
security definer
set search_path to 'public'
as $$
  -- started: backend fetch hung / kick dropped → hand to the app.
  update public.items
  set    status = 'fetch_failed'
  where  status = 'started'
    and  status_changed_at < now() - interval '90 seconds';

  -- fetched / client_fetched: Gemini stage hung → terminal failure (content
  -- discarded; no worker retry in v1).
  update public.items
  set    status = 'failed'
  where  status in ('fetched', 'client_fetched')
    and  status_changed_at < now() - interval '90 seconds';

  -- fetch_failed: count-gated, NO time predicate. Only rows the app has tried N
  -- times (or a claim-then-crash that pushed the count to N) are finalized;
  -- rows with app_fetch_attempts < N can sit for days awaiting the app.
  update public.items
  set    status = 'failed'
  where  status = 'fetch_failed'
    and  app_fetch_attempts >= 3;

  -- awaiting_upload: file-upload orphans (v2) — unchanged 3-minute rule.
  update public.items
  set    status = 'failed'
  where  status = 'awaiting_upload'
    and  status_changed_at < now() - interval '3 minutes';
$$;

commit;
