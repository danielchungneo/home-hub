-- Tighten function exposure flagged by the Supabase security advisor.

alter function public.set_updated_at() set search_path = '';

-- Trigger functions only run from their triggers, never through the API
revoke execute on function public.task_completion_fill() from public, anon, authenticated;
revoke execute on function public.task_completion_award() from public, anon, authenticated;
revoke execute on function public.task_completion_unaward() from public, anon, authenticated;
revoke execute on function public.reward_redemption_spend() from public, anon, authenticated;

-- RLS helpers are needed by signed-in users only
revoke execute on function public.current_household_id() from anon;
revoke execute on function public.current_profile_kind() from anon;
