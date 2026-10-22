-- =====================================================================
-- Role assignment. Run once in Supabase → SQL Editor. Safe to re-run.
-- Who may assign roles: admins, or anyone whose position is NOT a Committee.
-- (Committee members can create rooms but can't give out roles.)
-- =====================================================================
create or replace function public.set_position(target uuid, new_position text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles;
begin
  select * into caller from public.profiles where id = auth.uid();
  if caller.id is null
     or not (caller.role = 'admin'
             or (caller.position is not null and caller.position not like '%Committee')) then
    raise exception 'Only officers and coordinators can assign roles';
  end if;
  if new_position is not null and new_position = '' then
    new_position := null;
  end if;
  update public.profiles set position = new_position where id = target;
end;
$$;

revoke all on function public.set_position(uuid, text) from public, anon;
grant execute on function public.set_position(uuid, text) to authenticated;

-- BOOTSTRAP: someone must hold a non-committee role first. Make yourself (or the
-- President) the first one, then they can assign everyone else from the app:
--   update public.profiles set position = 'President'
--   where id = (select id from auth.users where email = 'PRESIDENT_EMAIL');
