-- Jukebox: shuffle/repeat commands + persisted playback prefs + recent collections.

alter type public.jukebox_command_type add value if not exists 'shuffle';
alter type public.jukebox_command_type add value if not exists 'repeat';

alter table public.jukebox_state
  add column if not exists shuffle boolean not null default false,
  add column if not exists repeat text not null default 'off'
    check (repeat in ('off', 'track', 'context')),
  add column if not exists recent jsonb not null default '[]'::jsonb;
