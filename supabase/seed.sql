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

-- Rewards (Star Shop catalog)
insert into public.rewards (id, household_id, title, icon, cost, color, sort_order, aisle, blurb) values
  ('44444444-4444-4444-4444-444444444406', '11111111-1111-1111-1111-111111111111', 'Pick movie night', 'sofa', 30, 'fjord', 1, 'Family fun', 'Your pick, no vetoes. Popcorn is on the house.'),
  ('44444444-4444-4444-4444-444444444407', '11111111-1111-1111-1111-111111111111', 'Choose game night', 'sparkle', 25, 'plum', 2, 'Family fun', 'Pick the game and who has to be on your team.'),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', 'Skip one chore', 'broom', 40, 'moss', 3, 'Time off', 'Hand one task to someone else, no questions asked.'),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', 'Coffee shop run', 'mug', 50, 'clay', 4, 'Treats', 'A latte somewhere quiet, on the family budget.'),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', 'Pick the takeout', 'utensils', 60, 'honey', 5, 'Treats', 'Friday night, your restaurant, your order.'),
  ('44444444-4444-4444-4444-444444444408', '11111111-1111-1111-1111-111111111111', 'Breakfast in bed', 'dish', 80, 'honey', 6, 'Treats', 'Pancakes, coffee and the paper, delivered.'),
  ('44444444-4444-4444-4444-444444444409', '11111111-1111-1111-1111-111111111111', 'Solo Target run', 'bag', 90, 'plum', 7, 'Time off', 'An hour to wander the aisles alone. Bliss.'),
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'Sleep in Saturday', 'moon', 100, 'fjord', 8, 'Time off', 'Someone else has the early shift with Noah.'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'Uninterrupted nap', 'bed', 120, 'clay', 9, 'Time off', 'Ninety minutes, door closed, phone on silent.');

insert into public.reward_deals (household_id, reward_id, cost, starts_on, ends_on) values
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444403', 45,
    date_trunc('week', timezone('utc', now()))::date,
    (date_trunc('week', timezone('utc', now())) + interval '6 days')::date);

insert into public.wishlist (member_id, household_id, reward_id) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444401'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444402');

insert into public.reward_redemptions (household_id, reward_id, member_id, status, cost) values
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222202', 'requested', 120);

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

-- Starter recipes (meal plan starts empty; fill it from the kiosk)
insert into public.recipes (household_id, title, servings, prep_min, cook_min, ingredients, steps, tags, color, icon)
values
  ('11111111-1111-1111-1111-111111111111', 'Sheet-pan chicken & veggies', 4, 15, 25,
   '[{"qty":2,"unit":"lb","name":"chicken thighs"},{"qty":2,"unit":"","name":"sweet potatoes, cubed"},{"qty":1,"unit":"head","name":"broccoli"},{"qty":3,"unit":"tbsp","name":"olive oil"},{"qty":1,"unit":"tsp","name":"smoked paprika"},{"qty":1,"unit":"tsp","name":"garlic powder"},{"qty":0,"unit":"","name":"Salt and pepper"}]'::jsonb,
   '[{"text":"Heat the oven to 425°F and line a large sheet pan with parchment.","tip":"Parchment makes cleanup a lot easier."},{"text":"Cube the sweet potatoes and cut the broccoli into bite-size florets.","uses":["sweet potatoes, cubed","broccoli"]},{"text":"Toss the chicken and vegetables with the oil and spices.","uses":["chicken thighs","olive oil","smoked paprika","garlic powder","Salt and pepper"]},{"text":"Spread everything in one layer, with a little space between pieces.","tip":"Crowded pans steam instead of roast. Use two pans if needed."},{"text":"Roast until the chicken reaches 165°F and the potatoes are tender.","tip":"Flip the vegetables halfway through.","timerMin":25},{"text":"Let it rest for 5 minutes, then serve.","timerMin":5}]'::jsonb,
   array['Dinner','Quick','American'], 'clay', 'dish'),
  ('11111111-1111-1111-1111-111111111111', 'Slow-cooker chili', 6, 15, 360,
   '[{"qty":1,"unit":"lb","name":"ground beef"},{"qty":2,"unit":"cans","name":"kidney beans"},{"qty":1,"unit":"can","name":"diced tomatoes"},{"qty":1,"unit":"","name":"onion, diced"},{"qty":2,"unit":"tbsp","name":"chili powder"},{"qty":1,"unit":"tsp","name":"cumin"}]'::jsonb,
   '[{"text":"Brown the beef with the onion in a skillet.","uses":["ground beef","onion, diced"]},{"text":"Add everything to the slow cooker and stir.","uses":["kidney beans","diced tomatoes","chili powder","cumin"]},{"text":"Cook on low for 6 hours.","timerMin":360}]'::jsonb,
   array['Dinner','Long','American'], 'honey', 'pot'),
  ('11111111-1111-1111-1111-111111111111', 'Lemon parmesan pasta', 4, 10, 15,
   '[{"qty":1,"unit":"lb","name":"spaghetti"},{"qty":1,"unit":"","name":"lemon, zest and juice"},{"qty":1,"unit":"cup","name":"grated parmesan"},{"qty":3,"unit":"tbsp","name":"butter"},{"qty":2,"unit":"cloves","name":"garlic"}]'::jsonb,
   '[{"text":"Boil the spaghetti in salted water until al dente.","timerMin":10,"uses":["spaghetti"]},{"text":"Melt the butter with the garlic, then toss in the pasta, lemon and parmesan.","uses":["butter","garlic","lemon, zest and juice","grated parmesan"]}]'::jsonb,
   array['Dinner','Quick','Italian'], 'moss', 'pot'),
  ('11111111-1111-1111-1111-111111111111', 'Banana pancakes', 4, 10, 15,
   '[{"qty":2,"unit":"","name":"ripe bananas"},{"qty":1.5,"unit":"cups","name":"flour"},{"qty":1,"unit":"cup","name":"milk"},{"qty":1,"unit":"","name":"egg"},{"qty":2,"unit":"tsp","name":"baking powder"}]'::jsonb,
   '[{"text":"Mash the bananas, then whisk in the milk and egg.","uses":["ripe bananas","milk","egg"]},{"text":"Fold in the flour and baking powder.","uses":["flour","baking powder"]},{"text":"Cook 1/4 cup at a time on a hot griddle, flipping once."}]'::jsonb,
   array['Breakfast','Quick','American'], 'honey', 'dish'),
  ('11111111-1111-1111-1111-111111111111', 'Overnight oats', 2, 5, 0,
   '[{"qty":1,"unit":"cup","name":"rolled oats"},{"qty":1,"unit":"cup","name":"milk"},{"qty":0.5,"unit":"cup","name":"Greek yogurt"},{"qty":1,"unit":"tbsp","name":"maple syrup"}]'::jsonb,
   '[{"text":"Stir everything together in jars and refrigerate overnight."}]'::jsonb,
   array['Breakfast','Quick','American'], 'fjord', 'mug'),
  ('11111111-1111-1111-1111-111111111111', 'Taco night', 4, 10, 20,
   '[{"qty":1,"unit":"lb","name":"ground turkey"},{"qty":8,"unit":"","name":"taco shells"},{"qty":2,"unit":"tbsp","name":"taco seasoning"},{"qty":1,"unit":"cup","name":"shredded cheese"},{"qty":1,"unit":"","name":"tomato, diced"}]'::jsonb,
   '[{"text":"Brown the turkey, then stir in the seasoning with a splash of water.","uses":["ground turkey","taco seasoning"]},{"text":"Warm the shells and set out the toppings.","uses":["taco shells","shredded cheese","tomato, diced"]}]'::jsonb,
   array['Dinner','Quick','Mexican'], 'clay', 'utensils');

-- Jukebox: empty state row. Speakers are discovered by the Pi music-agent.
-- Favorites are added from the kiosk (♥ on search results), e.g.:
--   insert into jukebox_favorites (kind, uri, title, subtitle, image_url, sort_order)
--   values ('playlist', 'spotify:playlist:…', 'Dinner Jazz', 'Playlist · Shelby', null, 1);
insert into public.jukebox_state (household_id, is_playing, volume, now_playing)
values ('11111111-1111-1111-1111-111111111111', false, 40, '{}'::jsonb)
on conflict (household_id) do nothing;
