-- Allow the kiosk device user to delete lists (was person-only).
-- Parent PIN gating stays in the kiosk UI via pin_protect_deletes.

drop policy if exists lists_delete on public.lists;

create policy lists_delete on public.lists
for delete to authenticated
using (household_id = public.current_household_id());
