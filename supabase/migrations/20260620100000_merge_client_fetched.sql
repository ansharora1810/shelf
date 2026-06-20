-- Merge `client_fetched` into `fetched`.
--
-- The two states only encoded provenance (backend datacenter-IP fetch vs. the
-- app's residential-IP webview fetch), never behaviour — the enrich drainer,
-- enrich-item, and the watchdog treated them identically. Provenance is
-- recoverable from app_fetch_attempts (> 0 ⟺ the app produced the body).
-- fetch_failed is unchanged — it is count-gated, not time-gated.

begin;

-- Fold any in-flight rows (expected: zero in production).
update public.items set status = 'fetched' where status = 'client_fetched';

alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check
  check (status = any (array[
    'awaiting_upload','started','fetched','fetch_failed','ready','failed']));

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
   where status = 'fetched'
     and status_changed_at < now() - interval '90 seconds';

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

create or replace function public.shelf_drain_enrich()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  k_enrich constant int := 1;
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

revoke execute on function public.shelf_watchdog()     from public;
revoke execute on function public.shelf_drain_enrich() from public;

commit;
