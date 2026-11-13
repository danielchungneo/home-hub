-- Expand the named accent palette and let members store custom #RRGGBB colors.
-- `slate` is system-only (Family / Home / Up for grabs) and stays in the enum
-- for completeness; member pickers never offer it.

alter type public.member_color add value if not exists 'pine';
alter type public.member_color add value if not exists 'berry';
alter type public.member_color add value if not exists 'sand';
alter type public.member_color add value if not exists 'ocean';
alter type public.member_color add value if not exists 'rose';
alter type public.member_color add value if not exists 'slate';

alter table public.members
  alter column color drop default;

alter table public.members
  alter column color type text using color::text;

alter table public.members
  alter column color set default 'plum';

comment on column public.members.color is
  'Named preset (moss, clay, …) or #RRGGBB. Never slate (system-only).';
