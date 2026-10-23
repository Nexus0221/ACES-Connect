-- =====================================================================
-- Invite code is permanently "ACES" (not case-sensitive), enforced in the
-- database. No app_settings lookup, so nothing to get out of sync.
-- Also rebuilds the signup trigger that creates the profile, because a
-- failure there is reported by Supabase as "Database error saving new user".
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

create or replace function public.check_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''))) <> 'ACES' then
    raise exception 'Invalid invite code';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invite_code on auth.users;
create trigger enforce_invite_code
  before insert on auth.users
  for each row execute function public.check_invite_code();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
