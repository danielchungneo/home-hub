-- Star Shop: aisle/blurb on rewards, deal + wishlist tables, hold stars on purchase.

-- ---------- rewards: aisle + blurb ----------
alter table public.rewards
  add column aisle text,
  add column blurb text;

update public.rewards set
  aisle = case title
    when 'Pick movie night' then 'Family fun'
    when 'Choose game night' then 'Family fun'
    when 'Skip one chore' then 'Time off'
    when 'Coffee shop run' then 'Treats'
    when 'Pick the takeout' then 'Treats'
    when 'Breakfast in bed' then 'Treats'
    when 'Solo Target run' then 'Time off'
    when 'Sleep in Saturday' then 'Time off'
    when 'Uninterrupted nap' then 'Time off'
    else 'Treats'
  end,
  blurb = case title
    when 'Pick movie night' then 'Your pick, no vetoes. Popcorn is on the house.'
    when 'Choose game night' then 'Pick the game and who has to be on your team.'
    when 'Skip one chore' then 'Hand one task to someone else, no questions asked.'
    when 'Coffee shop run' then 'A latte somewhere quiet, on the family budget.'
    when 'Pick the takeout' then 'Friday night, your restaurant, your order.'
    when 'Breakfast in bed' then 'Pancakes, coffee and the paper, delivered.'
    when 'Solo Target run' then 'An hour to wander the aisles alone. Bliss.'
    when 'Sleep in Saturday' then 'Someone else has the early shift with Noah.'
    when 'Uninterrupted nap' then 'Ninety minutes, door closed, phone on silent.'
    else 'A little treat from the Star Shop.'
  end
where aisle is null or blurb is null;

alter table public.rewards
  alter column aisle set not null,
  alter column blurb set not null,
  add constraint rewards_aisle_check check (aisle in ('Treats', 'Time off', 'Family fun'));

-- Seed any missing catalog items (idempotent by title).
insert into public.rewards (household_id, title, icon, cost, color, sort_order, aisle, blurb)
select h.id, v.title, v.icon, v.cost, v.color::public.member_color, v.sort_order, v.aisle, v.blurb
from public.households h
cross join (values
  ('Choose game night', 'sparkle', 25, 'plum', 7, 'Family fun', 'Pick the game and who has to be on your team.'),
  ('Breakfast in bed', 'dish', 80, 'honey', 8, 'Treats', 'Pancakes, coffee and the paper, delivered.'),
  ('Solo Target run', 'bag', 90, 'plum', 9, 'Time off', 'An hour to wander the aisles alone. Bliss.')
) as v(title, icon, cost, color, sort_order, aisle, blurb)
where not exists (
  select 1 from public.rewards r
  where r.household_id = h.id and r.title = v.title
);

-- ---------- reward_deals ----------
create table public.reward_deals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  reward_id uuid not null references public.rewards (id) on delete cascade,
  cost integer not null check (cost >= 0),
  starts_on date not null default (timezone('utc', now()))::date,
  ends_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on >= starts_on)
);

create index reward_deals_household_id_idx on public.reward_deals (household_id);
create index reward_deals_active_idx on public.reward_deals (household_id, starts_on, ends_on);

create trigger reward_deals_set_updated_at
before update on public.reward_deals
for each row execute function public.set_updated_at();

alter table public.reward_deals enable row level security;

create policy reward_deals_select on public.reward_deals
for select to authenticated
using (household_id = public.current_household_id());

create policy reward_deals_write on public.reward_deals
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

-- Active deal for this week: Pick the takeout at 45 through Sunday.
insert into public.reward_deals (household_id, reward_id, cost, starts_on, ends_on)
select r.household_id, r.id, 45,
  date_trunc('week', timezone('utc', now()))::date,
  (date_trunc('week', timezone('utc', now())) + interval '6 days')::date
from public.rewards r
where r.title = 'Pick the takeout'
  and not exists (
    select 1 from public.reward_deals d
    where d.household_id = r.household_id
      and d.starts_on <= (timezone('utc', now()))::date
      and d.ends_on >= (timezone('utc', now()))::date
  );

-- ---------- wishlist (one goal per person) ----------
create table public.wishlist (
  member_id uuid primary key references public.members (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  reward_id uuid not null references public.rewards (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index wishlist_household_id_idx on public.wishlist (household_id);

create trigger wishlist_set_updated_at
before update on public.wishlist
for each row execute function public.set_updated_at();

alter table public.wishlist enable row level security;

create policy wishlist_select on public.wishlist
for select to authenticated
using (household_id = public.current_household_id());

create policy wishlist_write on public.wishlist
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

insert into public.wishlist (member_id, household_id, reward_id)
select m.id, m.household_id, r.id
from public.members m
join public.rewards r on r.household_id = m.household_id
  and r.title = case m.name
    when 'Daniel' then 'Sleep in Saturday'
    when 'Shelby' then 'Uninterrupted nap'
  end
where m.name in ('Daniel', 'Shelby')
on conflict (member_id) do nothing;

-- ---------- redemptions.cost ----------
alter table public.reward_redemptions
  add column cost integer;

update public.reward_redemptions rr
set cost = r.cost
from public.rewards r
where r.id = rr.reward_id and rr.cost is null;

alter table public.reward_redemptions
  alter column cost set not null;

-- Hold stars for any still-requested redemption that never got a ledger row.
insert into public.points_ledger (household_id, member_id, delta, reason, redemption_id)
select rr.household_id, rr.member_id, -rr.cost, r.title, rr.id
from public.reward_redemptions rr
join public.rewards r on r.id = rr.reward_id
where rr.status = 'requested'
  and not exists (
    select 1 from public.points_ledger pl where pl.redemption_id = rr.id
  );

-- ---------- Buy holds stars; approve is status-only; deny refunds ----------
drop trigger if exists reward_redemptions_spend on public.reward_redemptions;
drop function if exists public.reward_redemption_spend();

-- BEFORE: fill cost and refuse if the wallet can't cover it.
create or replace function public.reward_redemption_prepare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rewards%rowtype;
  bal integer;
begin
  if new.status is distinct from 'requested' then
    return new;
  end if;

  select * into r from public.rewards where id = new.reward_id;
  if r.id is null then
    raise exception 'Reward % not found', new.reward_id;
  end if;

  if new.cost is null then
    new.cost := r.cost;
  end if;

  select coalesce(sum(delta), 0) into bal
  from public.points_ledger
  where member_id = new.member_id;

  if bal < new.cost then
    raise exception 'Not enough stars (have %, need %)', bal, new.cost;
  end if;

  return new;
end;
$$;

create trigger reward_redemptions_prepare
before insert on public.reward_redemptions
for each row execute function public.reward_redemption_prepare();

-- AFTER: hold the stars (ledger FK needs the redemption row).
create or replace function public.reward_redemption_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rewards%rowtype;
begin
  if new.status is distinct from 'requested' then
    return null;
  end if;

  select * into r from public.rewards where id = new.reward_id;
  insert into public.points_ledger (household_id, member_id, delta, reason, redemption_id)
  values (new.household_id, new.member_id, -new.cost, coalesce(r.title, 'reward'), new.id);

  return null;
end;
$$;

create trigger reward_redemptions_hold
after insert on public.reward_redemptions
for each row execute function public.reward_redemption_hold();

create or replace function public.reward_redemption_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rewards%rowtype;
begin
  if new.status = 'denied' and old.status is distinct from 'denied' then
    select * into r from public.rewards where id = new.reward_id;
    insert into public.points_ledger (household_id, member_id, delta, reason, redemption_id)
    values (new.household_id, new.member_id, new.cost, 'Refund · ' || coalesce(r.title, 'reward'), new.id);
  end if;
  return null;
end;
$$;

create trigger reward_redemptions_refund
after update of status on public.reward_redemptions
for each row execute function public.reward_redemption_refund();
