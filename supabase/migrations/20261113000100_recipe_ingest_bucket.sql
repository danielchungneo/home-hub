-- Public static host for the phone recipe-ingest page.
-- Edge Functions force text/plain + CSP sandbox on HTML responses, so the UI lives in Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-ingest',
  'recipe-ingest',
  true,
  5242880,
  array['text/html', 'text/css', 'application/javascript', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'font/woff2']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists recipe_ingest_public_read on storage.objects;
create policy recipe_ingest_public_read on storage.objects
for select to public
using (bucket_id = 'recipe-ingest');

drop policy if exists recipe_ingest_anon_write on storage.objects;
create policy recipe_ingest_anon_write on storage.objects
for insert to anon
with check (bucket_id = 'recipe-ingest');

drop policy if exists recipe_ingest_anon_update on storage.objects;
create policy recipe_ingest_anon_update on storage.objects
for update to anon
using (bucket_id = 'recipe-ingest')
with check (bucket_id = 'recipe-ingest');
