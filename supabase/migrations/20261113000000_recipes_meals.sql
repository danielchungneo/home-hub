-- Recipes, meal plan, import token, and recipe image storage.

create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

alter table public.households
  add column import_token uuid not null default gen_random_uuid();

create unique index households_import_token_uidx on public.households (import_token);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  title text not null,
  image_path text,
  servings integer not null default 4 check (servings > 0),
  prep_min integer not null default 0 check (prep_min >= 0),
  cook_min integer not null default 0 check (cook_min >= 0),
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  source_url text,
  color public.member_color not null default 'fjord',
  icon text not null default 'pot',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recipes_household_id_idx on public.recipes (household_id);
create index recipes_tags_idx on public.recipes using gin (tags);

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  date date not null,
  slot public.meal_slot not null,
  recipe_id uuid references public.recipes (id) on delete set null,
  title text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint meal_plan_entry_check check (recipe_id is not null or title is not null),
  unique (household_id, date, slot)
);

create index meal_plan_household_id_idx on public.meal_plan (household_id);
create index meal_plan_date_idx on public.meal_plan (household_id, date);
create index meal_plan_recipe_id_idx on public.meal_plan (recipe_id);

create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

create trigger meal_plan_set_updated_at
before update on public.meal_plan
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.meal_plan enable row level security;

create policy recipes_select on public.recipes
for select to authenticated
using (household_id = public.current_household_id());

create policy recipes_insert on public.recipes
for insert to authenticated
with check (household_id = public.current_household_id());

create policy recipes_update on public.recipes
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy recipes_delete on public.recipes
for delete to authenticated
using (household_id = public.current_household_id());

create policy meal_plan_select on public.meal_plan
for select to authenticated
using (household_id = public.current_household_id());

create policy meal_plan_insert on public.meal_plan
for insert to authenticated
with check (household_id = public.current_household_id());

create policy meal_plan_update on public.meal_plan
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy meal_plan_delete on public.meal_plan
for delete to authenticated
using (household_id = public.current_household_id());

alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.meal_plan;

-- Private recipe images; clients use signed URLs. Edge functions use service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy recipe_images_select on storage.objects
for select to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = public.current_household_id()::text
);

create policy recipe_images_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = public.current_household_id()::text
);

create policy recipe_images_update on storage.objects
for update to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = public.current_household_id()::text
)
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = public.current_household_id()::text
);

create policy recipe_images_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = public.current_household_id()::text
);
