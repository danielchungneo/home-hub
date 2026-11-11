-- crypt/gen_salt live in extensions; security definer functions had search_path=public only.
create or replace function public.verify_parent_pin(pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  if pin is null or pin !~ '^\d{4}$' then
    return false;
  end if;
  select parent_pin_hash into stored
  from public.household_settings
  where household_id = public.current_household_id();
  if stored is null then
    return false;
  end if;
  return stored = crypt(pin, stored);
end;
$$;

revoke all on function public.verify_parent_pin(text) from public;
grant execute on function public.verify_parent_pin(text) to authenticated;

create or replace function public.set_parent_pin(pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if pin is null or pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  update public.household_settings
  set parent_pin_hash = crypt(pin, gen_salt('bf'))
  where household_id = public.current_household_id();
  if not found then
    insert into public.household_settings (household_id, parent_pin_hash)
    values (public.current_household_id(), crypt(pin, gen_salt('bf')));
  end if;
end;
$$;

revoke all on function public.set_parent_pin(text) from public;
grant execute on function public.set_parent_pin(text) to authenticated;
