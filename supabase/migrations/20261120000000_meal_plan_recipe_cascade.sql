-- Deleting a recipe should clear meal-plan slots that pointed at it.
-- SET NULL left rows with recipe_id null and title null, which violates
-- meal_plan_entry_check and blocked recipe deletes.

alter table public.meal_plan
  drop constraint if exists meal_plan_recipe_id_fkey;

alter table public.meal_plan
  add constraint meal_plan_recipe_id_fkey
  foreign key (recipe_id) references public.recipes (id) on delete cascade;
