-- Tasks v2: task library, bounties, schedule columns.
-- Keeps existing tasks / task_completions rows (no DROP). Old title/icon/routine stay for legacy data.

create type public.task_frequency as enum ('daily', 'weekly');

-- ---------- task_templates ----------
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  title text not null check (char_length(title) <= 32),
  icon text not null,
  points integer not null default 0 check (points between 0 and 100),
  frequency public.task_frequency not null,
  uses integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index task_templates_title_key on public.task_templates (household_id, lower(title));
create index task_templates_household_id_idx on public.task_templates (household_id);

create trigger task_templates_set_updated_at
before update on public.task_templates
for each row execute function public.set_updated_at();

alter table public.task_templates enable row level security;

create policy task_templates_select on public.task_templates
for select to authenticated
using (household_id = public.current_household_id());

create policy task_templates_insert on public.task_templates
for insert to authenticated
with check (household_id = public.current_household_id());

create policy task_templates_update on public.task_templates
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy task_templates_delete on public.task_templates
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

-- ---------- bounties ----------
create table public.bounties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  template_id uuid not null references public.task_templates (id) on delete cascade,
  points integer not null check (points > 0),
  due_day integer check (due_day between 0 and 6),
  week_of date not null,
  claimed_by uuid references public.members (id) on delete set null,
  claimed_at timestamptz,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index bounties_household_id_idx on public.bounties (household_id);
create index bounties_template_id_idx on public.bounties (template_id);

create trigger bounties_set_updated_at
before update on public.bounties
for each row execute function public.set_updated_at();

alter table public.bounties enable row level security;

create policy bounties_select on public.bounties
for select to authenticated
using (household_id = public.current_household_id());

create policy bounties_insert on public.bounties
for insert to authenticated
with check (household_id = public.current_household_id());

create policy bounties_update on public.bounties
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy bounties_delete on public.bounties
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

-- ---------- reshape tasks (keep legacy columns + rows) ----------
alter table public.tasks
  add column if not exists template_id uuid references public.task_templates (id) on delete restrict,
  add column if not exists frequency public.task_frequency,
  add column if not exists days integer[],
  add column if not exists once_on date,
  add column if not exists every_weeks integer check (every_weeks in (1, 2)),
  add column if not exists week_of date,
  add column if not exists due_day integer check (due_day between 0 and 6),
  add column if not exists bounty_id uuid references public.bounties (id) on delete set null;

alter table public.tasks alter column title drop not null;
alter table public.tasks alter column routine drop not null;

create index if not exists tasks_template_id_idx on public.tasks (template_id);
create index if not exists tasks_bounty_id_idx on public.tasks (bounty_id);

-- ---------- task_completions: period + who tapped ----------
alter table public.task_completions
  add column if not exists period date,
  add column if not exists completed_by uuid references public.members (id) on delete set null;

update public.task_completions set period = for_date where period is null;
alter table public.task_completions alter column period set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'task_completions_task_id_period_key'
  ) then
    alter table public.task_completions
      add constraint task_completions_task_id_period_key unique (task_id, period);
  end if;
end $$;

-- Completions inherit household; period defaults to for_date for legacy callers
create or replace function public.task_completion_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks%rowtype;
begin
  select * into t from public.tasks where id = new.task_id;
  if t.id is null then
    raise exception 'Task % not found', new.task_id;
  end if;
  if new.household_id is distinct from t.household_id then
    raise exception 'Task % belongs to another household', new.task_id;
  end if;
  new.member_id := t.member_id;
  if new.period is null then
    new.period := coalesce(new.for_date, (timezone('utc', now()))::date);
  end if;
  if new.for_date is null then
    new.for_date := new.period;
  end if;
  return new;
end;
$$;

-- Points: reason from template title when present, else legacy tasks.title
create or replace function public.task_completion_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks%rowtype;
  earns boolean;
  reason text;
begin
  select * into t from public.tasks where id = new.task_id;
  if t.member_id is null or t.points <= 0 then
    return null;
  end if;
  select earns_points into earns from public.members where id = t.member_id;
  if earns then
    select coalesce(
      (select title from public.task_templates where id = t.template_id),
      t.title,
      'task'
    ) into reason;
    insert into public.points_ledger (household_id, member_id, delta, reason, completion_id)
    values (t.household_id, t.member_id, t.points, reason, new.id);
  end if;
  return null;
end;
$$;

create or replace function public.task_completion_unaward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  awarded integer;
  title text;
begin
  select coalesce(sum(delta), 0) into awarded
  from public.points_ledger
  where completion_id = old.id;

  if awarded <> 0 then
    select coalesce(
      (select tt.title from public.tasks t left join public.task_templates tt on tt.id = t.template_id where t.id = old.task_id),
      (select tasks.title from public.tasks where id = old.task_id),
      'task'
    ) into title;
    insert into public.points_ledger (household_id, member_id, delta, reason)
    values (old.household_id, old.member_id, -awarded, 'Unchecked: ' || coalesce(title, 'task'));
  end if;
  return old;
end;
$$;

alter publication supabase_realtime add table public.task_templates;
alter publication supabase_realtime add table public.bounties;
