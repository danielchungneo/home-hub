-- Catalog reset targets + automatic weekly 25% deal (random, not last week's).

-- ---------- seed the household reward catalog ----------
insert into public.rewards (household_id, title, icon, cost, color, sort_order, aisle, blurb, active)
select h.id, v.title, v.icon, v.cost, v.color::public.member_color, v.sort_order, v.aisle, v.blurb, true
from public.households h
cross join (values
  ('Movie Night', 'sofa', 30, 'fjord', 1, 'Family fun', 'Your pick, no vetoes. Popcorn is on the house.'),
  ('Game Night', 'sparkle', 25, 'plum', 2, 'Family fun', 'Pick the game and who has to be on your team.'),
  ('Take Out', 'utensils', 60, 'honey', 3, 'Treats', 'Your restaurant, your order.'),
  ('Breakfast in Bed', 'dish', 80, 'honey', 4, 'Treats', 'Pancakes, coffee, and the paper — delivered.'),
  ('Pick a Homemade Meal this Week', 'mug', 50, 'moss', 5, 'Family fun', 'You choose dinner one night; someone else cooks.')
) as v(title, icon, cost, color, sort_order, aisle, blurb)
where not exists (
  select 1 from public.rewards r
  where r.household_id = h.id and lower(r.title) = lower(v.title)
);

-- ---------- weekly deal rotation ----------
-- Sunday–Saturday weeks in America/New_York. 25% off one random active reward;
-- never the same reward as last week's deal. Idempotent per household per week.

create or replace function public.ensure_weekly_reward_deals()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  today_local date;
  week_start date;
  week_end date;
  last_reward uuid;
  pick record;
  sale_cost integer;
begin
  today_local := (timezone('America/New_York', now()))::date;
  -- Sunday = start of week (dow 0).
  week_start := today_local - extract(dow from today_local)::integer;
  week_end := week_start + 6;

  for h in select id from public.households loop
    last_reward := null;
    pick := null;

    if exists (
      select 1 from public.reward_deals d
      where d.household_id = h.id
        and d.starts_on = week_start
    ) then
      continue;
    end if;

    select d.reward_id into last_reward
    from public.reward_deals d
    where d.household_id = h.id
      and d.starts_on = week_start - 7
    limit 1;

    select r.id, r.cost into pick
    from public.rewards r
    where r.household_id = h.id
      and coalesce(r.active, true)
      and (last_reward is null or r.id is distinct from last_reward)
    order by random()
    limit 1;

    -- Only one active reward (or last week was the only one): allow a repeat.
    if pick.id is null then
      select r.id, r.cost into pick
      from public.rewards r
      where r.household_id = h.id
        and coalesce(r.active, true)
      order by random()
      limit 1;
    end if;

    if pick.id is null then
      continue;
    end if;

    sale_cost := greatest(1, round(pick.cost * 0.75)::integer);

    insert into public.reward_deals (household_id, reward_id, cost, starts_on, ends_on)
    values (h.id, pick.id, sale_cost, week_start, week_end);
  end loop;
end;
$$;

revoke all on function public.ensure_weekly_reward_deals() from public;
grant execute on function public.ensure_weekly_reward_deals() to postgres;

-- Run shortly after Sunday night Eastern (Monday 04:00 UTC ≈ Sun 23:00 EST / Mon 00:00 EDT),
-- plus a daily catch-up so a missed run still opens the week's deal.
do $$
begin
  perform cron.unschedule('weekly-reward-deals-sunday');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('weekly-reward-deals-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'weekly-reward-deals-sunday',
  '0 4 * * 1',
  $$select public.ensure_weekly_reward_deals();$$
);

select cron.schedule(
  'weekly-reward-deals-daily',
  '15 5 * * *',
  $$select public.ensure_weekly_reward_deals();$$
);

-- Realtime so the kiosk flips the deal without a refresh.
do $$
begin
  alter publication supabase_realtime add table public.reward_deals;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rewards;
exception when duplicate_object then
  null;
end $$;

-- Open this week's deal immediately.
select public.ensure_weekly_reward_deals();
