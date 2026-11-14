-- Kid-friendly jukebox: when on, the music-agent skips Spotify tracks marked explicit.

alter table public.household_settings
  add column if not exists jukebox_kid_friendly boolean not null default false;

comment on column public.household_settings.jukebox_kid_friendly is
  'When true, the Pi music-agent skips Spotify tracks with explicit=true before playing.';
