-- Jukebox: speakers, command queue, now-playing state, favorites.
-- Playback is handled by the Pi music-agent (Spotify Connect + Cast wake).

create type public.speaker_provider as enum ('spotify_connect', 'cast', 'alexa');
create type public.jukebox_command_type as enum (
  'play', 'pause', 'resume', 'skip', 'previous', 'volume', 'transfer', 'queue_add', 'refresh_speakers'
);
create type public.jukebox_command_status as enum ('pending', 'done', 'failed');

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  name text not null,
  provider public.speaker_provider not null default 'cast',
  external_id text,
  kind text not null default 'Speaker',
  is_group boolean not null default false,
  cast_host text,
  available boolean not null default false,
  sort_order integer not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index speakers_household_id_idx on public.speakers (household_id);

create table public.jukebox_favorites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  title text not null,
  uri text not null,
  speaker_id uuid references public.speakers (id) on delete set null,
  color public.member_color not null default 'fjord',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index jukebox_favorites_household_id_idx on public.jukebox_favorites (household_id);

create table public.jukebox_commands (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  type public.jukebox_command_type not null,
  payload jsonb not null default '{}'::jsonb,
  speaker_id uuid references public.speakers (id) on delete set null,
  status public.jukebox_command_status not null default 'pending',
  error text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index jukebox_commands_household_id_idx on public.jukebox_commands (household_id);
create index jukebox_commands_pending_idx on public.jukebox_commands (status, created_at)
  where status = 'pending';

-- One now-playing row per household.
create table public.jukebox_state (
  household_id uuid primary key references public.households (id) on delete cascade,
  speaker_id uuid references public.speakers (id) on delete set null,
  is_playing boolean not null default false,
  volume integer not null default 40 check (volume between 0 and 100),
  progress_ms integer not null default 0 check (progress_ms >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  now_playing jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Spotify tokens stay off the client. Only the music-agent (service role) reads/writes this.
create table public.integrations (
  household_id uuid not null references public.households (id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, provider)
);

create trigger speakers_set_updated_at
before update on public.speakers
for each row execute function public.set_updated_at();

create trigger jukebox_favorites_set_updated_at
before update on public.jukebox_favorites
for each row execute function public.set_updated_at();

create trigger jukebox_commands_set_updated_at
before update on public.jukebox_commands
for each row execute function public.set_updated_at();

create trigger jukebox_state_set_updated_at
before update on public.jukebox_state
for each row execute function public.set_updated_at();

create trigger integrations_set_updated_at
before update on public.integrations
for each row execute function public.set_updated_at();

alter table public.speakers enable row level security;
alter table public.jukebox_favorites enable row level security;
alter table public.jukebox_commands enable row level security;
alter table public.jukebox_state enable row level security;
alter table public.integrations enable row level security;

-- Speakers: everyone in the household can read; the agent (and persons) can write.
create policy speakers_select on public.speakers
for select to authenticated
using (household_id = public.current_household_id());

create policy speakers_insert on public.speakers
for insert to authenticated
with check (household_id = public.current_household_id());

create policy speakers_update on public.speakers
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy speakers_delete on public.speakers
for delete to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

create policy jukebox_favorites_select on public.jukebox_favorites
for select to authenticated
using (household_id = public.current_household_id());

create policy jukebox_favorites_write on public.jukebox_favorites
for all to authenticated
using (household_id = public.current_household_id() and public.current_profile_kind() = 'person')
with check (household_id = public.current_household_id() and public.current_profile_kind() = 'person');

-- Commands: clients insert intent; anyone in the household can read status.
create policy jukebox_commands_select on public.jukebox_commands
for select to authenticated
using (household_id = public.current_household_id());

create policy jukebox_commands_insert on public.jukebox_commands
for insert to authenticated
with check (household_id = public.current_household_id());

create policy jukebox_commands_update on public.jukebox_commands
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy jukebox_state_select on public.jukebox_state
for select to authenticated
using (household_id = public.current_household_id());

create policy jukebox_state_upsert on public.jukebox_state
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

-- No client policies on integrations: service-role only.
revoke all on public.integrations from anon, authenticated;

alter publication supabase_realtime add table
  public.speakers,
  public.jukebox_commands,
  public.jukebox_state;
