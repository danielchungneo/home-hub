-- Household settings: parent PIN, sleep/idle, weather location label.
-- PIN is bcrypt-hashed; clients verify via verify_parent_pin() and never read the hash.

create table public.household_settings (
  household_id uuid primary key references public.households (id) on delete cascade
    default public.current_household_id(),
  sleep_start time not null default '22:00',
  sleep_end time not null default '06:00',
  idle_minutes integer not null default 5 check (idle_minutes between 1 and 120),
  slide_seconds integer not null default 20 check (slide_seconds between 5 and 120),
  parent_pin_hash text not null,
  weather_units text not null default 'f' check (weather_units in ('f', 'c')),
  location_label text,
  location_zip text,
  pin_protect_rewards boolean not null default true,
  pin_protect_settings boolean not null default true,
  pin_protect_deletes boolean not null default true,
  pin_lock_minutes integer not null default 5 check (pin_lock_minutes between 1 and 60),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger household_settings_set_updated_at
before update on public.household_settings
for each row execute function public.set_updated_at();

alter table public.household_settings enable row level security;

create policy household_settings_select on public.household_settings
for select to authenticated
using (household_id = public.current_household_id());

create policy household_settings_update on public.household_settings
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy household_settings_insert on public.household_settings
for insert to authenticated
with check (household_id = public.current_household_id());

-- White House, TN 37188 (Open-Meteo geocode)
update public.households
set
  location_lat = 36.47032,
  location_lon = -86.65138,
  timezone = 'America/Chicago'
where id = '11111111-1111-1111-1111-111111111111';

-- Seed defaults only when the Chung household already exists (remote / prior seed).
-- Fresh local `supabase start` creates that household in seed.sql after migrations.
insert into public.household_settings (
  household_id,
  parent_pin_hash,
  location_label,
  location_zip,
  sleep_start,
  sleep_end,
  idle_minutes,
  slide_seconds
)
select
  h.id,
  crypt('2717', gen_salt('bf')),
  'White House, TN',
  '37188',
  '22:00',
  '06:00',
  5,
  20
from public.households h
where h.id = '11111111-1111-1111-1111-111111111111'
on conflict (household_id) do update set
  parent_pin_hash = excluded.parent_pin_hash,
  location_label = excluded.location_label,
  location_zip = excluded.location_zip;

create or replace function public.verify_parent_pin(pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  if pin is null or pin !~ '^\d{4}$' then
    return false;
  end if;
  select parent_pin_hash into stored
  from public.household_settings
  where household_id = public.current_household_id();
  if stored is null then
    return false;
  end if;
  return stored = crypt(pin, stored);
end;
$$;

revoke all on function public.verify_parent_pin(text) from public;
grant execute on function public.verify_parent_pin(text) to authenticated;

create or replace function public.set_parent_pin(pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if pin is null or pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  update public.household_settings
  set parent_pin_hash = crypt(pin, gen_salt('bf'))
  where household_id = public.current_household_id();
  if not found then
    insert into public.household_settings (household_id, parent_pin_hash)
    values (public.current_household_id(), crypt(pin, gen_salt('bf')));
  end if;
end;
$$;

revoke all on function public.set_parent_pin(text) from public;
grant execute on function public.set_parent_pin(text) to authenticated;
