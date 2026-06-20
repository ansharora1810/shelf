-- Client-assisted fetch: make `dispatched_at` the single claim marker for the
-- client stage too (matching the backend drainers), and give the watchdog one
-- new job — releasing a stale client claim.
--
-- The app claims a fetch_failed row by stamping dispatched_at (set-if-null) and
-- bumping app_fetch_attempts in one atomic UPDATE, fetches the body, then writes
-- client_fetched (the status change auto-nulls dispatched_at via the existing
-- trigger). The set-if-null gate is the exclusion: a second pickup (remount,
-- reordered realtime) hits dispatched_at already set and updates zero rows, so
-- the fetch and the increment happen exactly once. A failed attempt leaves the
-- claim in place; the watchdog releases it after a lease so the app retries.
--
-- The lease (45s) MUST exceed the client's webview fetch timeout
-- (WEBVIEW_FETCH_TIMEOUT_MS = 20s, app/src/constants/pipeline.ts) so an in-flight
-- fetch is never released out from under itself — that would re-introduce the
-- double fetch this change removes.
create or replace function public.shelf_watchdog()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.items set status = 'fetch_failed'
   where status = 'started'
     and status_changed_at < now() - interval '90 seconds';

  update public.items set status = 'failed'
   where status in ('fetched','client_fetched')
     and status_changed_at < now() - interval '90 seconds';

  -- Release a stale client claim so the row is re-claimable; the count-gate below
  -- finalizes it instead once the attempt cap is reached.
  update public.items set dispatched_at = null
   where status = 'fetch_failed'
     and dispatched_at < now() - interval '45 seconds'
     and app_fetch_attempts < 3;

  update public.items set status = 'failed'
   where status = 'fetch_failed'
     and app_fetch_attempts >= 3;

  update public.items set status = 'failed'
   where status = 'awaiting_upload'
     and status_changed_at < now() - interval '3 minutes';
$function$;
