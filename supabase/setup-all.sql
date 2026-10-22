-- =====================================================================
-- ACES Connect — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run.
-- =====================================================================

-- ---------- Settings (server-side only, no client access) -------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
-- (no policies on purpose: only the database itself can read this table)

-- Registration invite code. Members must enter it when creating an account.
-- Change it here any time. Delete the row (or set it to '') to allow open signup.
insert into public.app_settings (key, value)
values ('invite_code', 'CHANGE-ME')
on conflict (key) do nothing;

-- ---------- Tables -----------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  role         text not null default 'member' check (role in ('member', 'admin')),
  created_at   timestamptz not null default now()
);

-- Repair an older profiles table that may be missing columns
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'admin'));

create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  constraint message_not_empty
    check (length(trim(content)) > 0 or jsonb_array_length(attachments) > 0)
);

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

-- ---------- Helper: is the current user an admin? ---------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- Signup: enforce invite code + create profile --------------
create or replace function public.check_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_code text;
begin
  select value into required_code from public.app_settings where key = 'invite_code';
  if required_code is not null and required_code <> ''
     and coalesce(new.raw_user_meta_data ->> 'invite_code', '') <> required_code then
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
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms    enable row level security;
alter table public.messages enable row level security;

-- profiles
drop policy if exists "profiles readable by members" on public.profiles;
create policy "profiles readable by members" on public.profiles
  for select to authenticated using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- members can only change their name / avatar, never their role
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- rooms
drop policy if exists "rooms readable by members" on public.rooms;
create policy "rooms readable by members" on public.rooms
  for select to authenticated using (true);

drop policy if exists "admins create rooms" on public.rooms;
create policy "admins create rooms" on public.rooms
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins delete rooms" on public.rooms;
create policy "admins delete rooms" on public.rooms
  for delete to authenticated using (public.is_admin());

-- messages
drop policy if exists "messages readable by members" on public.messages;
create policy "messages readable by members" on public.messages
  for select to authenticated using (true);

drop policy if exists "members post as themselves" on public.messages;
create policy "members post as themselves" on public.messages
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own or admin" on public.messages;
create policy "delete own or admin" on public.messages
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

-- ---------- Storage ----------------------------------------------------
-- Private bucket for chat attachments (served through signed URLs, originals kept as-is)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Public bucket for profile pictures
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "members read attachments" on storage.objects;
create policy "members read attachments" on storage.objects
  for select to authenticated using (bucket_id = 'attachments');

drop policy if exists "members upload attachments" on storage.objects;
create policy "members upload attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "members delete own attachments" on storage.objects;
create policy "members delete own attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "members upload own avatar" on storage.objects;
create policy "members upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "members delete own avatar" on storage.objects;
create policy "members delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Realtime ---------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['messages', 'rooms', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Starter rooms ----------------------------------------------
insert into public.rooms (name, description) values
  ('General',       'Everyday chat for the whole alliance'),
  ('Announcements', 'Officer updates and reminders'),
  ('Study Hall',    'Quiet co-working and homework help'),
  ('Project Teams', 'Capstone and group project coordination'),
  ('Random',        'Memes, games and everything else')
on conflict (name) do nothing;

-- =====================================================================
-- AFTER you register your own account in the app, make yourself an admin:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
--
-- Admins can create rooms and delete any message.
-- =====================================================================


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
