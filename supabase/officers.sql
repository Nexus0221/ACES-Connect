-- =====================================================================
-- ACES Connect — officer positions + room creation
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

-- 0) Make sure the older columns exist (your profiles table was missing "role")
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'admin'));
alter table public.profiles add column if not exists avatar_url text;

-- 1) Position column (only admins/you can set it via SQL; members can't edit it)
alter table public.profiles add column if not exists position text;

alter table public.profiles drop constraint if exists profiles_position_check;
alter table public.profiles add constraint profiles_position_check check (
  position is null or position in (
    'President','Vice President','Secretary','Assistant Secretary',
    'Public Relations Officer (P.R.O)','Treasurer','Assistant Treasurer',
    'Auditor','Assistant Auditor',
    '4th Year Representative','3rd Year Representative',
    '2nd Year Representative','1st Year Representative',
    'ODL/Offshore Representative',
    'Snap Coordinator','Media Coordinator','Technical Coordinator','Sports League Coordinator',
    'Snap Committee','Media Committee','Technical Committee','Sports League Committee'
  )
);

-- 2) Who may create rooms: any position holder, or an admin
create or replace function public.can_create_rooms()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or position is not null)
  );
$$;

drop policy if exists "admins create rooms" on public.rooms;
drop policy if exists "officers create rooms" on public.rooms;
create policy "officers create rooms" on public.rooms
  for insert to authenticated
  with check (public.can_create_rooms() and created_by = auth.uid());

-- 3) Give yourself your position (change the email):
update public.profiles set position = 'Sports League Committee'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

-- To give someone else a position:
--   update public.profiles set position = 'Treasurer'
--   where id = (select id from auth.users where email = 'THEIR_EMAIL');
