-- Allow the kiosk to stock the shop (create / edit / retire rewards).
-- Parent PIN gating stays in the kiosk UI ("Stock the shop").

drop policy if exists rewards_write on public.rewards;

create policy rewards_write on public.rewards
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());
