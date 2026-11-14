-- Workout coach: profiles, activities, daily plans, and point awards.
-- Assumes `members` and `points_ledger(household_id, member_id, delta, reason, created_at)` already exist.

-- What the coach should know about each person. Written by the person (Settings / phone), never inferred.
create table if not exists public.athlete_profiles (
  member_id        uuid primary key references public.members(id) on delete cascade,
  coach_enabled    boolean not null default false,  -- opt-in: only these people get a daily plan
  goals            text,                      -- "Run a 10k in the spring", "Get stronger, feel better"
  days_per_week    int  check (days_per_week between 1 and 7) default 4,
  preferred_cardio text[] default '{run,walk}', -- run | walk | bike | swim
  equipment        text[] default '{}',        -- e.g. {pull-up bar, bands}; empty = bodyweight only
  limitations      text,                       -- free text the person chose to share ("sore left knee"); passed to the coach verbatim
  easy_pace        text,                       -- optional, e.g. "10:15 / mi"
  updated_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  date         date not null,                -- local date
  kind         text not null check (kind in ('run','walk','bike','swim','strength','mobility')),
  title        text not null,
  minutes      int  not null check (minutes between 1 and 600),
  distance_mi  numeric(5,2),
  source       text not null default 'hub' check (source in ('hub','phone','strava','apple_health')),
  external_id  text,                          -- dedupe imports (Strava activity id, HealthKit uuid)
  feel         text check (feel in ('easy','right','hard')),
  plan_part    text check (plan_part in ('cardio','strength')),
  created_at   timestamptz not null default timezone('utc', now()),
  unique (source, external_id)
);
create index if not exists activities_member_date on public.activities (member_id, date desc);
-- Points are awarded once per plan part per day.
create unique index if not exists activities_one_part_per_day
  on public.activities (member_id, date, plan_part)
  where plan_part is not null;

create table if not exists public.coach_plans (
  member_id    uuid not null references public.members(id) on delete cascade,
  date         date not null,
  plan         jsonb not null,                -- CoachPlan shape from apps/kiosk (minus memberId/date)
  model        text not null,
  swap_reason  text,                          -- set when it replaced an earlier plan ("shorter", "easier", ...)
  direction    text check (direction in ('build','hold','ease','return','deload','rest')),  -- from coach-signals.ts, not the model
  signals      jsonb,                         -- the numbers behind the direction (adherence, load ratio, streak, caps)
  created_at   timestamptz not null default timezone('utc', now()),
  primary key (member_id, date)
);

-- Complete a plan part: one activity row + one ledger row, atomically, at most once a day.
-- Points live here, never in the model output.
create or replace function public.complete_plan_part(
  p_member uuid,
  p_part text,
  p_feel text default null
)
returns public.activities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  jsonb;
  v_today date;
  v_tz    text;
  v_hh    uuid;
  v_row   public.activities;
  v_pts   int := case p_part when 'cardio' then 15 when 'strength' then 20 else null end;
begin
  if p_part not in ('cardio', 'strength') then
    raise exception 'Invalid plan part';
  end if;
  if p_feel is not null and p_feel not in ('easy', 'right', 'hard') then
    raise exception 'Invalid feel';
  end if;

  select m.household_id, h.timezone
    into v_hh, v_tz
  from public.members m
  join public.households h on h.id = m.household_id
  where m.id = p_member;

  if v_hh is null then
    raise exception 'Unknown member';
  end if;

  v_today := (timezone(coalesce(v_tz, 'America/New_York'), now()))::date;

  select plan into v_plan
  from public.coach_plans
  where member_id = p_member and date = v_today;

  if v_plan is null then
    raise exception 'No plan for today';
  end if;

  insert into public.activities (member_id, date, kind, title, minutes, distance_mi, source, feel, plan_part)
  values (
    p_member,
    v_today,
    case p_part when 'cardio' then v_plan #>> '{cardio,kind}' else 'strength' end,
    v_plan #>> array[p_part, 'title'],
    (v_plan #>> array[p_part, 'minutes'])::int,
    case p_part when 'cardio' then (v_plan #>> '{cardio,distanceMi}')::numeric end,
    'hub',
    p_feel,
    p_part
  )
  on conflict (member_id, date, plan_part) where plan_part is not null
  do nothing
  returning * into v_row;

  if v_row.id is not null then
    insert into public.points_ledger (household_id, member_id, delta, reason)
    values (v_hh, p_member, v_pts, 'Workout · ' || (v_plan #>> array[p_part, 'title']));
  else
    -- Already completed today; return the existing row (and optionally update feel).
    select * into v_row
    from public.activities
    where member_id = p_member and date = v_today and plan_part = p_part;

    if p_feel is not null and v_row.id is not null and v_row.feel is distinct from p_feel then
      update public.activities set feel = p_feel where id = v_row.id returning * into v_row;
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.complete_plan_part(uuid, text, text) from public, anon;
grant execute on function public.complete_plan_part(uuid, text, text) to authenticated;
grant execute on function public.complete_plan_part(uuid, text, text) to service_role;

alter table public.athlete_profiles enable row level security;
alter table public.activities enable row level security;
alter table public.coach_plans enable row level security;

-- Household-scoped via members.household_id (same pattern as other family tables).
create policy athlete_profiles_select on public.athlete_profiles
for select to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

create policy athlete_profiles_insert on public.athlete_profiles
for insert to authenticated
with check (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

create policy athlete_profiles_update on public.athlete_profiles
for update to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
)
with check (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

create policy activities_select on public.activities
for select to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

-- Hub (kiosk) and phones insert activities; stars for plan parts go through the RPC.
create policy activities_insert on public.activities
for insert to authenticated
with check (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

create policy activities_update on public.activities
for update to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
)
with check (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

-- coach_plans is written only by the service role (edge function). Household can read.
create policy coach_plans_select on public.coach_plans
for select to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_id and m.household_id = public.current_household_id()
  )
);

alter publication supabase_realtime add table public.athlete_profiles;
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.coach_plans;
