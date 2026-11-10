-- Jukebox v2: typed favorites with Spotify metadata, app-owned queue, advance command.
-- Tabs read favorites only (no Spotify calls). Queue lives in jukebox_queue.

create type public.jukebox_media_kind as enum ('track', 'album', 'playlist');

alter type public.jukebox_command_type add value if not exists 'advance';

-- ---------- Favorites: replace quick-pick shape ----------
alter table public.jukebox_favorites
  add column if not exists kind public.jukebox_media_kind,
  add column if not exists subtitle text,
  add column if not exists album_title text,
  add column if not exists image_url text,
  add column if not exists duration_ms integer check (duration_ms is null or duration_ms >= 0),
  add column if not exists track_count integer check (track_count is null or track_count >= 0),
  add column if not exists is_owned boolean,
  add column if not exists added_by uuid references public.members (id) on delete set null;

-- Infer kind from existing Spotify URIs (legacy quick picks were mostly playlists).
update public.jukebox_favorites
set kind = case
  when uri like 'spotify:track:%' then 'track'::public.jukebox_media_kind
  when uri like 'spotify:album:%' then 'album'::public.jukebox_media_kind
  else 'playlist'::public.jukebox_media_kind
end
where kind is null;

alter table public.jukebox_favorites
  alter column kind set not null;

-- Drop speaker/color quick-pick columns (per-playlist speaker moves later if needed).
alter table public.jukebox_favorites
  drop constraint if exists jukebox_favorites_speaker_id_fkey;

alter table public.jukebox_favorites
  drop column if exists speaker_id,
  drop column if exists color;

create unique index if not exists jukebox_favorites_household_uri_uidx
  on public.jukebox_favorites (household_id, uri);

-- Kiosk may favorite/unfavorite (same pattern as list_items).
drop policy if exists jukebox_favorites_write on public.jukebox_favorites;

create policy jukebox_favorites_insert on public.jukebox_favorites
for insert to authenticated
with check (household_id = public.current_household_id());

create policy jukebox_favorites_update on public.jukebox_favorites
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy jukebox_favorites_delete on public.jukebox_favorites
for delete to authenticated
using (household_id = public.current_household_id());

-- ---------- App-owned Up next queue ----------
create table if not exists public.jukebox_queue (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  position integer not null,
  spotify_uri text not null,
  title text not null,
  subtitle text,
  image_url text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  added_by uuid references public.members (id) on delete set null,
  added_at timestamptz not null default timezone('utc', now()),
  unique (household_id, position)
);

create index if not exists jukebox_queue_household_position_idx
  on public.jukebox_queue (household_id, position);

alter table public.jukebox_queue enable row level security;

create policy jukebox_queue_select on public.jukebox_queue
for select to authenticated
using (household_id = public.current_household_id());

create policy jukebox_queue_insert on public.jukebox_queue
for insert to authenticated
with check (household_id = public.current_household_id());

create policy jukebox_queue_update on public.jukebox_queue
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy jukebox_queue_delete on public.jukebox_queue
for delete to authenticated
using (household_id = public.current_household_id());

-- Realtime for library + queue tabs
alter publication supabase_realtime add table public.jukebox_favorites;
alter publication supabase_realtime add table public.jukebox_queue;
