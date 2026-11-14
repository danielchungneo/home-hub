-- Schedule the workout coach each morning via pg_cron + pg_net.
-- Requires vault secrets named `project_url` and `service_role_key`
-- (same as calendar-sync). 10:30 UTC ≈ 4:30am Central in winter / 5:30am Eastern.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.invoke_coach_daily()
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
    raise notice 'coach-daily cron skipped: vault secrets project_url / service_role_key not set';
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/coach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{"mode":"daily"}'::jsonb
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_coach_daily() from public;

do $$
begin
  perform cron.unschedule('coach-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'coach-daily',
  '30 10 * * *',
  $$select public.invoke_coach_daily();$$
);
