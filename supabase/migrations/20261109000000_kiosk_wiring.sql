-- Align the schema with the kiosk UI and move points bookkeeping into the database.

-- Palette colors (design system tokens) instead of hex values
create type public.member_color as enum ('moss', 'clay', 'honey', 'fjord', 'plum');

alter table public.members alter column color drop default;
alter table public.members
  alter column color type public.member_color using 'fjord'::public.member_color;
alter table public.members alter column color set default 'fjord';

alter table public.members
  add column role_label text,
  add column earns_points boolean not null default true,
  add column sort_order integer not null default 0;

alter table public.rewards
  add column color public.member_color not null default 'fjord',
  add column sort_order integer not null default 0;

alter table public.lists
  add column color public.member_color not null default 'fjord';

-- A task with no member is a shared household task (the Home column)
alter table public.tasks alter column member_id drop not null;
alter table public.task_completions alter column member_id drop not null;

-- Clients never send household_id; it comes from the signed-in profile
alter table public.members alter column household_id set default public.current_household_id();
alter table public.tasks alter column household_id set default public.current_household_id();
alter table public.task_completions alter column household_id set default public.current_household_id();
alter table public.rewards alter column household_id set default public.current_household_id();
alter table public.reward_redemptions alter column household_id set default public.current_household_id();
alter table public.points_ledger alter column household_id set default public.current_household_id();
alter table public.lists alter column household_id set default public.current_household_id();
alter table public.list_items alter column household_id set default public.current_household_id();

-- Completions inherit household and member from their task
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
  return new;
end;
$$;

create trigger task_completions_fill
before insert on public.task_completions
for each row execute function public.task_completion_fill();

-- Points are awarded on completion and offset (never deleted) when a task is unchecked
create or replace function public.task_completion_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks%rowtype;
  earns boolean;
begin
  select * into t from public.tasks where id = new.task_id;
  if t.member_id is null or t.points <= 0 then
    return null;
  end if;
  select earns_points into earns from public.members where id = t.member_id;
  if earns then
    insert into public.points_ledger (household_id, member_id, delta, reason, completion_id)
    values (t.household_id, t.member_id, t.points, t.title, new.id);
  end if;
  return null;
end;
$$;

create trigger task_completions_award
after insert on public.task_completions
for each row execute function public.task_completion_award();

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
    select tasks.title into title from public.tasks where id = old.task_id;
    insert into public.points_ledger (household_id, member_id, delta, reason)
    values (old.household_id, old.member_id, -awarded, 'Unchecked: ' || coalesce(title, 'task'));
  end if;
  return old;
end;
$$;

create trigger task_completions_unaward
before delete on public.task_completions
for each row execute function public.task_completion_unaward();

-- Approving a redemption spends the points
create or replace function public.reward_redemption_spend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rewards%rowtype;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select * into r from public.rewards where id = new.reward_id;
    insert into public.points_ledger (household_id, member_id, delta, reason, redemption_id)
    values (new.household_id, new.member_id, -r.cost, r.title, new.id);
  end if;
  return null;
end;
$$;

create trigger reward_redemptions_spend
after update of status on public.reward_redemptions
for each row execute function public.reward_redemption_spend();

-- The kiosk unchecks tasks, so it needs to delete today's completions
drop policy task_completions_delete on public.task_completions;
create policy task_completions_delete on public.task_completions
for delete to authenticated
using (household_id = public.current_household_id());

-- Profiles are created by an admin; self-insert would let any account join any household
drop policy profiles_insert_own on public.profiles;
