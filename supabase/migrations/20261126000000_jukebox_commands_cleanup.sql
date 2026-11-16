-- Drop finished jukebox command rows after a day. Pending stays so the
-- music-agent can still drain missed work after a reconnect.

create or replace function public.cleanup_jukebox_commands()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.jukebox_commands
  where status in ('done', 'failed')
    and created_at < timezone('utc', now()) - interval '1 day';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_jukebox_commands() from public;
grant execute on function public.cleanup_jukebox_commands() to postgres;

do $$
begin
  perform cron.unschedule('jukebox-commands-cleanup');
exception when others then
  null;
end $$;

-- Daily at 06:30 UTC (01:30 EST / 02:30 EDT).
select cron.schedule(
  'jukebox-commands-cleanup',
  '30 6 * * *',
  $$select public.cleanup_jukebox_commands();$$
);

-- Trim whatever has already piled up.
select public.cleanup_jukebox_commands();
