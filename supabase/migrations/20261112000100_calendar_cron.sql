-- Schedule calendar-sync every 5 minutes via pg_cron + pg_net.
-- Requires vault secrets named `project_url` and `service_role_key`
-- (Dashboard → Project Settings → Vault, or supabase secrets / vault.create_secret).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.invoke_calendar_sync()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
  service_key text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if project_url is null or service_key is null then
    raise notice 'calendar-sync cron skipped: vault secrets project_url / service_role_key not set';
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_calendar_sync() from public;

-- Unschedule prior job if re-running.
do $$
begin
  perform cron.unschedule('calendar-sync-every-5-min');
exception when others then
  null;
end $$;

select cron.schedule(
  'calendar-sync-every-5-min',
  '*/5 * * * *',
  $$select public.invoke_calendar_sync();$$
);
