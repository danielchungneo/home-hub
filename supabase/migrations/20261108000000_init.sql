-- Smart Home Hub — initial schema (people, tasks/rewards, lists)
-- Calendar, meals, recipes, photos, jukebox, settings come in later migrations.

create extension if not exists "pgcrypto";

-- Enums
create type public.member_role as enum ('parent', 'child');
create type public.profile_kind as enum ('person', 'kiosk');
create type public.task_routine as enum ('morning', 'afternoon', 'evening', 'chores');
create type public.redemption_status as enum ('requested', 'approved', 'denied');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Households / people
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  location_lat double precision,
  location_lon double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  color text not null default '#6b8cae',
  avatar text,
  role public.member_role not null default 'child',
  routine_filters public.task_routine[] not null default array['morning', 'afternoon', 'evening', 'chores']::public.task_routine[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index members_household_id_idx on public.members (household_id);
create index members_user_id_idx on public.members (user_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.profile_kind not null default 'person',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index profiles_household_id_idx on public.profiles (household_id);

-- Tasks / rewards
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  title text not null,
  icon text,
  routine public.task_routine not null,
  points integer not null default 0 check (points >= 0),
  recurrence text,
  due_date date,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index tasks_household_id_idx on public.tasks (household_id);
create index tasks_member_id_idx on public.tasks (member_id);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  for_date date not null,
  completed_at timestamptz not null default timezone('utc', now()),
  approved_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (task_id, for_date)
);

create index task_completions_household_id_idx on public.task_completions (household_id);
create index task_completions_for_date_idx on public.task_completions (for_date);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  icon text,
  cost integer not null check (cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index rewards_household_id_idx on public.rewards (household_id);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  status public.redemption_status not null default 'requested',
  requested_at timestamptz not null default timezone('utc', now()),
  decided_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index reward_redemptions_household_id_idx on public.reward_redemptions (household_id);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  delta integer not null,
  reason text not null,
  completion_id uuid references public.task_completions (id) on delete set null,
  redemption_id uuid references public.reward_redemptions (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index points_ledger_household_id_idx on public.points_ledger (household_id);
create index points_ledger_member_id_idx on public.points_ledger (member_id);

create view public.member_points
with (security_invoker = true)
as
select
  member_id,
  household_id,
  coalesce(sum(delta), 0)::integer as balance
from public.points_ledger
group by member_id, household_id;

-- Lists
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index lists_household_id_idx on public.lists (household_id);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  text text not null,
  quantity text,
  category text,
  checked_at timestamptz,
  assignee_id uuid references public.members (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index list_items_household_id_idx on public.list_items (household_id);
create index list_items_list_id_idx on public.list_items (list_id);

-- updated_at triggers
create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger task_completions_set_updated_at
before update on public.task_completions
for each row execute function public.set_updated_at();

create trigger rewards_set_updated_at
before update on public.rewards
for each row execute function public.set_updated_at();

create trigger reward_redemptions_set_updated_at
before update on public.reward_redemptions
for each row execute function public.set_updated_at();

create trigger lists_set_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

create trigger list_items_set_updated_at
before update on public.list_items
for each row execute function public.set_updated_at();

-- RLS helpers
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.current_profile_kind()
returns public.profile_kind
language sql
stable
security definer
set search_path = public
as $$
  select kind
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated;
revoke all on function public.current_profile_kind() from public;
grant execute on function public.current_profile_kind() to authenticated;

-- Enable RLS
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.points_ledger enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- Household-scoped policies
create policy households_select on public.households
for select to authenticated
using (id = public.current_household_id());

create policy households_update on public.households
for update to authenticated
using (id = public.current_household_id() and public.current_profile_kind() = 'person')
with check (id = public.current_household_id() and public.current_profile_kind() = 'person');

create policy members_select on public.members
for select to authenticated
using (household_id = public.current_household_id());

create policy members_write on public.members
for all to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person')
with check (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

create policy profiles_select on public.profiles
for select to authenticated
using (household_id = public.current_household_id());

create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_person on public.profiles
for update to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person')
with check (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

-- Tasks: person full write; kiosk can write too
create policy tasks_select on public.tasks
for select to authenticated
using (household_id = public.current_household_id());

create policy tasks_insert on public.tasks
for insert to authenticated
with check (household_id = public.current_household_id());

create policy tasks_update on public.tasks
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy tasks_delete on public.tasks
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

create policy task_completions_select on public.task_completions
for select to authenticated
using (household_id = public.current_household_id());

create policy task_completions_insert on public.task_completions
for insert to authenticated
with check (household_id = public.current_household_id());

create policy task_completions_update on public.task_completions
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy task_completions_delete on public.task_completions
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

create policy rewards_select on public.rewards
for select to authenticated
using (household_id = public.current_household_id());

create policy rewards_write on public.rewards
for all to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person')
with check (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

-- Kiosk may request redemptions; persons manage fully
create policy reward_redemptions_select on public.reward_redemptions
for select to authenticated
using (household_id = public.current_household_id());

create policy reward_redemptions_insert on public.reward_redemptions
for insert to authenticated
with check (household_id = public.current_household_id());

create policy reward_redemptions_update on public.reward_redemptions
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy reward_redemptions_delete on public.reward_redemptions
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

-- points_ledger: append-only (select + insert; no update/delete for clients)
create policy points_ledger_select on public.points_ledger
for select to authenticated
using (household_id = public.current_household_id());

create policy points_ledger_insert on public.points_ledger
for insert to authenticated
with check (household_id = public.current_household_id());

create policy lists_select on public.lists
for select to authenticated
using (household_id = public.current_household_id());

create policy lists_insert on public.lists
for insert to authenticated
with check (household_id = public.current_household_id());

create policy lists_update on public.lists
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy lists_delete on public.lists
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

create policy list_items_select on public.list_items
for select to authenticated
using (household_id = public.current_household_id());

create policy list_items_insert on public.list_items
for insert to authenticated
with check (household_id = public.current_household_id());

create policy list_items_update on public.list_items
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy list_items_delete on public.list_items
for delete to authenticated
using (household_id = public.current_household_id());

-- Realtime for tables shown live on screen (subset available in this migration)
alter publication supabase_realtime add table
  public.tasks,
  public.task_completions,
  public.points_ledger,
  public.reward_redemptions,
  public.list_items;
