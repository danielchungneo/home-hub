-- Multi-person meal calendars: Family (default) + optional per-member plans,
-- each linked to a grocery list. Same household/date/slot can only be filled once.

create table public.meal_calendars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade
    default public.current_household_id(),
  member_id uuid references public.members (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index meal_calendars_household_id_idx on public.meal_calendars (household_id);

-- One Family calendar per household (member_id is null).
create unique index meal_calendars_family_uidx
  on public.meal_calendars (household_id)
  where member_id is null;

-- At most one calendar per member.
create unique index meal_calendars_member_uidx
  on public.meal_calendars (household_id, member_id)
  where member_id is not null;

-- Each list backs at most one meal calendar.
create unique index meal_calendars_list_uidx
  on public.meal_calendars (list_id);

create trigger meal_calendars_set_updated_at
before update on public.meal_calendars
for each row execute function public.set_updated_at();

-- Ensure every household has a Groceries list for the Family calendar.
insert into public.lists (household_id, name, icon, color, sort_order)
select h.id, 'Groceries', 'cart', 'moss', 1
from public.households h
where not exists (
  select 1
  from public.lists l
  where l.household_id = h.id
    and lower(trim(l.name)) in ('groceries', 'grocery')
);

-- Backfill one Family calendar per household.
insert into public.meal_calendars (household_id, member_id, list_id)
select
  h.id,
  null,
  coalesce(
    (
      select l.id
      from public.lists l
      where l.household_id = h.id
        and lower(trim(l.name)) in ('groceries', 'grocery')
      order by l.sort_order
      limit 1
    ),
    (
      select l.id
      from public.lists l
      where l.household_id = h.id
      order by l.sort_order
      limit 1
    )
  )
from public.households h
where exists (select 1 from public.lists l where l.household_id = h.id)
  and not exists (
    select 1 from public.meal_calendars c
    where c.household_id = h.id and c.member_id is null
  );

-- Attach meal_plan rows to their household's Family calendar.
alter table public.meal_plan
  add column calendar_id uuid references public.meal_calendars (id) on delete cascade;

update public.meal_plan mp
set calendar_id = c.id
from public.meal_calendars c
where c.household_id = mp.household_id
  and c.member_id is null
  and mp.calendar_id is null;

-- Drop orphan rows that somehow have no Family calendar (should not happen).
delete from public.meal_plan where calendar_id is null;

alter table public.meal_plan
  alter column calendar_id set not null;

create index meal_plan_calendar_id_idx on public.meal_plan (calendar_id);

-- Per-calendar uniqueness (upsert target). Household uniqueness already exists
-- as meal_plan_household_id_date_slot_key and enforces cross-calendar exclusivity.
create unique index meal_plan_calendar_date_slot_uidx
  on public.meal_plan (calendar_id, date, slot);

alter table public.meal_calendars enable row level security;

create policy meal_calendars_select on public.meal_calendars
for select to authenticated
using (household_id = public.current_household_id());

create policy meal_calendars_insert on public.meal_calendars
for insert to authenticated
with check (household_id = public.current_household_id());

create policy meal_calendars_update on public.meal_calendars
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy meal_calendars_delete on public.meal_calendars
for delete to authenticated
using (household_id = public.current_household_id());

alter publication supabase_realtime add table public.meal_calendars;
