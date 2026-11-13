-- When a calendar_sources.member_id changes, rewrite cached events so the kiosk
-- does not wait for a full Google re-sync to pick up Daniel vs Family colors.
create or replace function public.calendar_sources_propagate_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.member_id is distinct from old.member_id then
    update public.events
    set member_id = new.member_id
    where source_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_sources_propagate_member on public.calendar_sources;
create trigger calendar_sources_propagate_member
after update of member_id on public.calendar_sources
for each row
execute function public.calendar_sources_propagate_member();
