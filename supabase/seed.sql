-- Chung household, matching the kiosk's original mock data.
-- Run on a fresh database (local `pnpm db:reset`, or once against the hosted project).

insert into public.households (id, name, timezone)
values ('11111111-1111-1111-1111-111111111111', 'Chung Family', 'America/New_York');

insert into public.members (id, household_id, name, color, role, role_label, earns_points, sort_order) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Daniel', 'moss', 'parent', 'Dad', true, 1),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Shelby', 'clay', 'parent', 'Mom', true, 2),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Noah', 'honey', 'child', 'Baby care', false, 3);

-- Tasks (member_id null = shared Home column)
insert into public.tasks (household_id, member_id, routine, title, icon, points, sort_order)
select '11111111-1111-1111-1111-111111111111', m.member_id, t.routine::public.task_routine, t.title, t.icon, t.points, t.ord
from (values
  ('daniel', 'morning', 'Make coffee', 'mug', 0, 1),
  ('daniel', 'morning', 'Workout', 'dumbbell', 10, 2),
  ('daniel', 'morning', 'Make the bed', 'bed', 5, 3),
  ('daniel', 'afternoon', 'Check the mail', 'mail', 0, 4),
  ('daniel', 'afternoon', 'Start dinner', 'pot', 10, 5),
  ('daniel', 'evening', 'Do the dishes', 'dish', 10, 6),
  ('daniel', 'evening', 'Lock up', 'key', 0, 7),
  ('daniel', 'chores', 'Take out trash', 'trash', 10, 8),
  ('daniel', 'chores', 'Mow the lawn', 'leaf', 20, 9),
  ('daniel', 'chores', 'Wash the car', 'car', 15, 10),
  ('shelby', 'morning', 'Water plants', 'plant', 5, 1),
  ('shelby', 'morning', 'Pack diaper bag', 'bag', 5, 2),
  ('shelby', 'morning', 'Make the bed', 'bed', 5, 3),
  ('shelby', 'afternoon', 'Grocery pickup', 'cart', 10, 4),
  ('shelby', 'afternoon', 'Check the mail', 'mail', 0, 5),
  ('shelby', 'evening', 'Fold laundry', 'shirt', 10, 6),
  ('shelby', 'evening', 'Prep lunches', 'pot', 10, 7),
  ('shelby', 'chores', 'Start laundry', 'shirt', 10, 8),
  ('shelby', 'chores', 'Wipe counters', 'sparkle', 5, 9),
  ('shelby', 'chores', 'Clean bathroom', 'droplet', 15, 10),
  ('noah', 'morning', 'Morning bottle', 'bottle', 0, 1),
  ('noah', 'morning', 'Tummy time', 'sun', 0, 2),
  ('noah', 'morning', 'Get dressed', 'shirt', 0, 3),
  ('noah', 'afternoon', 'Nap', 'moon', 0, 4),
  ('noah', 'afternoon', 'Bottle', 'bottle', 0, 5),
  ('noah', 'afternoon', 'Stroller walk', 'stroller', 0, 6),
  ('noah', 'evening', 'Bath time', 'bath', 0, 7),
  ('noah', 'evening', 'Story time', 'book', 0, 8),
  ('noah', 'evening', 'Bedtime', 'moon', 0, 9),
  ('noah', 'chores', 'Wash bottles', 'bottle', 0, 10),
  ('noah', 'chores', 'Baby laundry', 'shirt', 0, 11),
  ('home', 'morning', 'Open the blinds', 'sun', 0, 1),
  ('home', 'morning', 'Unload dishwasher', 'dish', 0, 2),
  ('home', 'afternoon', 'Tidy living room', 'sofa', 0, 3),
  ('home', 'evening', 'Run dishwasher', 'dish', 0, 4),
  ('home', 'evening', 'Lock the doors', 'key', 0, 5),
  ('home', 'chores', 'Vacuum', 'broom', 0, 6),
  ('home', 'chores', 'Change sheets', 'bed', 0, 7),
  ('home', 'chores', 'Trash and recycling', 'trash', 0, 8)
) as t(who, routine, title, icon, points, ord)
left join (values
  ('daniel', '22222222-2222-2222-2222-222222222201'::uuid),
  ('shelby', '22222222-2222-2222-2222-222222222202'::uuid),
  ('noah', '22222222-2222-2222-2222-222222222203'::uuid)
) as m(who, member_id) on m.who = t.who;

-- Point history from before today (today's points come from the completions below)
insert into public.points_ledger (household_id, member_id, delta, reason, created_at) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', -30, 'Pick movie night', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 20, 'Mow the lawn', now() - interval '4 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 10, 'Do the dishes', now() - interval '5 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 125, 'Carried over', now() - interval '8 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 15, 'Clean bathroom', now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', -50, 'Coffee shop run', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 10, 'Fold laundry', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 180, 'Carried over', now() - interval '8 days');

-- Today's completions (the award trigger adds their points to the ledger)
insert into public.task_completions (household_id, task_id, for_date)
select household_id, id, (now() at time zone 'America/New_York')::date
from public.tasks
where (member_id, title) in (
    ('22222222-2222-2222-2222-222222222201'::uuid, 'Make coffee'),
    ('22222222-2222-2222-2222-222222222201'::uuid, 'Workout'),
    ('22222222-2222-2222-2222-222222222201'::uuid, 'Take out trash'),
    ('22222222-2222-2222-2222-222222222202'::uuid, 'Water plants'),
    ('22222222-2222-2222-2222-222222222203'::uuid, 'Morning bottle'),
    ('22222222-2222-2222-2222-222222222203'::uuid, 'Tummy time')
  )
  or (member_id is null and title = 'Vacuum');

-- Rewards
insert into public.rewards (id, household_id, title, icon, cost, color, sort_order) values
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'Sleep in Saturday', 'moon', 100, 'fjord', 1),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'Uninterrupted nap', 'bed', 120, 'clay', 2),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', 'Pick the takeout', 'utensils', 60, 'honey', 3),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', 'Coffee shop run', 'mug', 50, 'clay', 4),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', 'Skip one chore', 'broom', 40, 'moss', 5),
  ('44444444-4444-4444-4444-444444444406', '11111111-1111-1111-1111-111111111111', 'Pick movie night', 'sofa', 30, 'fjord', 6);

insert into public.reward_redemptions (household_id, reward_id, member_id, status) values
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222202', 'requested');

-- Lists
insert into public.lists (id, household_id, name, icon, color, sort_order) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', 'Groceries', 'cart', 'moss', 1),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', 'Costco', 'bag', 'fjord', 2),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', 'Hardware store', 'key', 'clay', 3),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', 'Gift ideas', 'sparkle', 'honey', 4);

insert into public.list_items (household_id, list_id, text, category, quantity, assignee_id, checked_at, sort_order)
select '11111111-1111-1111-1111-111111111111', l.list_id, i.text, i.category, i.qty, m.member_id,
  case when i.checked then now() end, i.ord
from (values
  ('groceries', 'Bananas', 'Produce', '1 bunch', null, false, 1),
  ('groceries', 'Avocados', 'Produce', '3', null, false, 2),
  ('groceries', 'Baby spinach', 'Produce', null, 'shelby', false, 3),
  ('groceries', 'Sweet potatoes', 'Produce', '4', null, false, 4),
  ('groceries', 'Apples', 'Produce', '6', null, true, 5),
  ('groceries', 'Whole milk', 'Dairy & eggs', '1 gal', null, false, 6),
  ('groceries', 'Eggs', 'Dairy & eggs', '2 dozen', null, false, 7),
  ('groceries', 'Greek yogurt', 'Dairy & eggs', null, 'shelby', false, 8),
  ('groceries', 'Butter', 'Dairy & eggs', null, null, true, 9),
  ('groceries', 'Chicken thighs', 'Meat', '2 lb', 'daniel', false, 10),
  ('groceries', 'Coffee beans', 'Pantry', null, 'daniel', false, 11),
  ('groceries', 'Rice', 'Pantry', null, null, false, 12),
  ('groceries', 'Chicken broth', 'Pantry', '2', null, false, 13),
  ('groceries', 'Bread', 'Pantry', null, null, true, 14),
  ('groceries', 'Diapers, size 1', 'Baby', '1 box', 'shelby', false, 15),
  ('groceries', 'Wipes', 'Baby', '2 packs', null, false, 16),
  ('costco', 'Paper towels', 'Household', null, null, false, 1),
  ('costco', 'Diapers, size 1', 'Baby', '1 case', null, false, 2),
  ('costco', 'Olive oil', 'Pantry', null, null, false, 3),
  ('costco', 'Frozen berries', 'Frozen', null, 'daniel', false, 4),
  ('hardware', 'Air filter 20×25', 'Home', '2', 'daniel', false, 1),
  ('hardware', 'LED bulbs', 'Home', '4', null, false, 2),
  ('hardware', 'Outlet covers', 'Baby-proofing', '1 pack', null, false, 3),
  ('gifts', 'Engraved cutting board', 'Christmas', null, 'daniel', false, 1),
  ('gifts', 'Board game night set', 'Christmas', null, null, false, 2),
  ('gifts', 'Photo book of Noah', 'Christmas', null, 'shelby', false, 3),
  ('gifts', 'Cozy slippers', 'Christmas', null, null, false, 4)
) as i(list, text, category, qty, who, checked, ord)
join (values
  ('groceries', '33333333-3333-3333-3333-333333333301'::uuid),
  ('costco', '33333333-3333-3333-3333-333333333302'::uuid),
  ('hardware', '33333333-3333-3333-3333-333333333303'::uuid),
  ('gifts', '33333333-3333-3333-3333-333333333304'::uuid)
) as l(list, list_id) on l.list = i.list
left join (values
  ('daniel', '22222222-2222-2222-2222-222222222201'::uuid),
  ('shelby', '22222222-2222-2222-2222-222222222202'::uuid)
) as m(who, member_id) on m.who = i.who;

-- Jukebox: empty state row. Speakers are discovered by the Pi music-agent.
-- Favorites are added from the kiosk (♥ on search results), e.g.:
--   insert into jukebox_favorites (kind, uri, title, subtitle, image_url, sort_order)
--   values ('playlist', 'spotify:playlist:…', 'Dinner Jazz', 'Playlist · Shelby', null, 1);
insert into public.jukebox_state (household_id, is_playing, volume, now_playing)
values ('11111111-1111-1111-1111-111111111111', false, 40, '{}'::jsonb)
on conflict (household_id) do nothing;
