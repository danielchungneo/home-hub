-- Google Calendar sync: multi-account integrations + calendar_sources + events.

-- ---------- integrations: allow N accounts per provider ----------
-- Spotify tokens still live on the Pi; this table was empty / unused for Spotify.
create table public.integrations_v2 (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  provider text not null,
  account_key text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, provider, account_key)
);

insert into public.integrations_v2 (household_id, provider, account_key, access_token, refresh_token, expires_at, meta, created_at, updated_at)
select
  household_id,
  provider,
  coalesce(nullif(meta->>'email', ''), 'default'),
  access_token,
  refresh_token,
  expires_at,
  meta,
  created_at,
  updated_at
from public.integrations;

drop table public.integrations;
alter table public.integrations_v2 rename to integrations;

create trigger integrations_set_updated_at
before update on public.integrations
for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;
revoke all on public.integrations from anon, authenticated;

-- ---------- calendar_sources ----------
create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  integration_id uuid not null references public.integrations (id) on delete cascade,
  external_id text not null,
  name text not null,
  member_id uuid references public.members (id) on delete set null,
  color public.member_color,
  enabled boolean not null default true,
  sync_token text,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, integration_id, external_id)
);

create index calendar_sources_household_id_idx on public.calendar_sources (household_id);
create index calendar_sources_integration_id_idx on public.calendar_sources (integration_id);

create trigger calendar_sources_set_updated_at
before update on public.calendar_sources
for each row execute function public.set_updated_at();

alter table public.calendar_sources enable row level security;

create policy calendar_sources_select on public.calendar_sources
for select to authenticated
using (household_id = public.current_household_id());

create policy calendar_sources_update on public.calendar_sources
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

-- Kiosk/person may toggle enabled; inserts come from the CLI / service role.
revoke insert, delete on public.calendar_sources from anon, authenticated;
grant select, update on public.calendar_sources to authenticated;

-- ---------- events (cached Google events) ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.current_household_id(),
  source_id uuid not null references public.calendar_sources (id) on delete cascade,
  external_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, external_id)
);

create index events_household_starts_at_idx on public.events (household_id, starts_at);
create index events_source_id_idx on public.events (source_id);

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy events_select on public.events
for select to authenticated
using (household_id = public.current_household_id());

-- Events are written only by the sync edge function (service role).
revoke insert, update, delete on public.events from anon, authenticated;
grant select on public.events to authenticated;

alter publication supabase_realtime add table public.calendar_sources;
alter publication supabase_realtime add table public.events;
