-- Cache the preferred Kroger store for aisle lookups.
alter table public.household_settings
  add column if not exists kroger_location_id text;

comment on column public.household_settings.kroger_location_id is
  'Kroger locationId (8 chars) used for Products aisle lookups';
