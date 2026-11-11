-- List-scoped share tokens for the phone shopping page (QR from kiosk).
-- Phone clients call the list-share edge function with x-list-token; no anon RLS.

create table public.list_share_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade
    default public.current_household_id(),
  list_id uuid not null references public.lists (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index list_share_tokens_list_id_idx on public.list_share_tokens (list_id);
create index list_share_tokens_household_id_idx on public.list_share_tokens (household_id);
create unique index list_share_tokens_active_token_idx
  on public.list_share_tokens (token)
  where revoked_at is null;

alter table public.list_share_tokens enable row level security;

create policy list_share_tokens_select on public.list_share_tokens
for select to authenticated
using (household_id = public.current_household_id());

create policy list_share_tokens_insert on public.list_share_tokens
for insert to authenticated
with check (
  household_id = public.current_household_id()
  and exists (
    select 1 from public.lists l
    where l.id = list_id and l.household_id = public.current_household_id()
  )
);

create policy list_share_tokens_update on public.list_share_tokens
for update to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());
