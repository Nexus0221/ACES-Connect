-- =====================================================================
-- Private 1-to-1 chats (direct messages). Run once in Supabase → SQL Editor.
-- Safe to re-run. A DM is a hidden room that only its two people can see,
-- read, post in, or join voice in. Admins can NOT read other people's DMs.
-- =====================================================================

alter table public.rooms add column if not exists is_dm boolean not null default false;
alter table public.rooms add column if not exists dm_user_a uuid references public.profiles(id) on delete cascade;
alter table public.rooms add column if not exists dm_user_b uuid references public.profiles(id) on delete cascade;

create unique index if not exists rooms_dm_pair_idx on public.rooms (dm_user_a, dm_user_b) where is_dm;

-- Can the current user see / use this room?
create or replace function public.can_access_room(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = rid
      and (not r.is_dm or auth.uid() in (r.dm_user_a, r.dm_user_b))
  );
$$;

-- rooms: DMs are visible only to their two people; nobody can hand-create a DM row
drop policy if exists "rooms readable by members" on public.rooms;
create policy "rooms readable by members" on public.rooms
  for select to authenticated
  using (not is_dm or auth.uid() in (dm_user_a, dm_user_b));

drop policy if exists "officers create rooms" on public.rooms;
create policy "officers create rooms" on public.rooms
  for insert to authenticated
  with check (public.can_create_rooms() and created_by = auth.uid() and is_dm = false);

-- messages: only people who can access the room can read / post
drop policy if exists "messages readable by members" on public.messages;
create policy "messages readable by members" on public.messages
  for select to authenticated using (public.can_access_room(room_id));

drop policy if exists "members post as themselves" on public.messages;
create policy "members post as themselves" on public.messages
  for insert to authenticated
  with check (auth.uid() = user_id and public.can_access_room(room_id));

drop policy if exists "delete own or admin" on public.messages;
create policy "delete own or admin" on public.messages
  for delete to authenticated
  using (auth.uid() = user_id or (public.is_admin() and public.can_access_room(room_id)));

-- Open (or create) the DM between me and another member. Returns the room id.
create or replace function public.open_dm(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  rid uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if other is null or other = me then raise exception 'Pick someone else to message'; end if;
  if not exists (select 1 from public.profiles where id = other) then
    raise exception 'That member does not exist';
  end if;

  if me::text < other::text then a := me; b := other; else a := other; b := me; end if;

  select id into rid from public.rooms where is_dm and dm_user_a = a and dm_user_b = b;
  if rid is null then
    insert into public.rooms (name, is_dm, dm_user_a, dm_user_b, created_by)
    values ('dm-' || a::text || '-' || b::text, true, a, b, me)
    on conflict do nothing
    returning id into rid;
    if rid is null then
      select id into rid from public.rooms where is_dm and dm_user_a = a and dm_user_b = b;
    end if;
  end if;
  return rid;
end;
$$;

revoke all on function public.open_dm(uuid) from public, anon;
grant execute on function public.open_dm(uuid) to authenticated;
