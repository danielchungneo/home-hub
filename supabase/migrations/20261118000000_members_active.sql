-- Soft-hide people from the hub without deleting their history.
alter table public.members
  add column if not exists active boolean not null default true;

create index if not exists members_household_active_idx
  on public.members (household_id, active);

-- Settings runs on the kiosk (PIN-gated in UI), same pattern as rewards.
drop policy if exists members_write on public.members;

create policy members_write on public.members
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

-- Live updates when family roster changes in Settings.
do $$
begin
  alter publication supabase_realtime add table public.members;
exception
  when duplicate_object then null;
end $$;
