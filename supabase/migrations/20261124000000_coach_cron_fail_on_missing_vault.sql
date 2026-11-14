-- Fail loudly if vault secrets are missing so cron.job_run_details shows failed
-- instead of a silent skip that still looks like success.

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
    raise exception 'coach-daily cron requires vault secrets project_url and service_role_key';
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/coach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{"mode":"daily"}'::jsonb,
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_coach_daily() from public;
