-- Expose the Google account email on sources (integrations is service-role only).
alter table public.calendar_sources
  add column if not exists account_email text;
