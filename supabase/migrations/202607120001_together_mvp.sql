-- MOMENTUM — TOGETHER MVP
-- Apply from the Supabase SQL editor or the project migration workflow.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug = lower(slug)),
  description text,
  category text not null,
  location_name text not null,
  logo_url text,
  cover_image_url text,
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE','DISCOVERABLE')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  role text not null default 'MEMBER' check (role in ('OWNER','ADMIN','ORGANIZER','MEMBER')),
  membership_status text not null default 'PENDING' check (membership_status in ('PENDING','ACCEPTED','DECLINED','REMOVED','BLOCKED')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table if not exists public.circle_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','BLOCKED','REMOVED')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> recipient_id)
);

create unique index if not exists circle_relationship_pair_idx
  on public.circle_relationships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));

create table if not exists public.circle_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_member_id uuid not null references auth.users(id) on delete cascade,
  is_pinned boolean not null default false,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, circle_member_id),
  check (user_id <> circle_member_id)
);

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text,
  moment_type text not null default 'OTHER',
  status text not null default 'PLANNING' check (status in ('DRAFT','PLANNING','CONFIRMED','ONGOING','COMPLETED','CANCELLED')),
  start_at timestamptz,
  end_at timestamptz,
  location_name text,
  cover_image_url text,
  visibility text not null default 'PARTICIPANTS' check (visibility in ('PRIVATE','PARTICIPANTS','CIRCLE','SELECTED_USERS')),
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at)
);

-- HOME already uses `moments` in Momentum Alpha. Extend that table without
-- replacing its story/day/activity relationships.
alter table public.moments add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.moments add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table public.moments add column if not exists description text;
alter table public.moments add column if not exists moment_type text;
alter table public.moments add column if not exists status text;
alter table public.moments add column if not exists start_at timestamptz;
alter table public.moments add column if not exists end_at timestamptz;
alter table public.moments add column if not exists cover_image_url text;
alter table public.moments add column if not exists capacity integer;
alter table public.moments add column if not exists updated_at timestamptz not null default now();
update public.moments set created_by = user_id where created_by is null;
update public.moments set moment_type = 'OTHER' where moment_type is null;
update public.moments set status = 'COMPLETED' where status is null;
update public.moments set visibility = upper(coalesce(visibility, 'PRIVATE'));
alter table public.moments alter column created_by set not null;
alter table public.moments alter column moment_type set default 'OTHER';
alter table public.moments alter column moment_type set not null;
alter table public.moments alter column status set default 'PLANNING';
alter table public.moments alter column status set not null;
alter table public.moments alter column visibility set default 'PARTICIPANTS';
alter table public.moments alter column visibility set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'moments_status_check') then
    alter table public.moments add constraint moments_status_check check (status in ('DRAFT','PLANNING','CONFIRMED','ONGOING','COMPLETED','CANCELLED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'moments_visibility_check') then
    alter table public.moments add constraint moments_visibility_check check (visibility in ('PRIVATE','PARTICIPANTS','CIRCLE','SELECTED_USERS'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'moments_capacity_check') then
    alter table public.moments add constraint moments_capacity_check check (capacity is null or capacity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'moments_dates_check') then
    alter table public.moments add constraint moments_dates_check check (end_at is null or start_at is null or end_at > start_at);
  end if;
end $$;

create table if not exists public.moment_participants (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'PARTICIPANT' check (role in ('OWNER','ORGANIZER','PARTICIPANT','GUEST')),
  invitation_status text not null default 'PENDING' check (invitation_status in ('PENDING','ACCEPTED','DECLINED','REMOVED')),
  participation_status text not null default 'INVITED' check (participation_status in ('INVITED','AVAILABLE','REGISTERED','WAITLISTED','DECLINED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (moment_id, user_id)
);

create table if not exists public.moment_date_options (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  location_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at is null or end_at > start_at)
);

create unique index if not exists one_selected_option_per_moment_idx
  on public.moment_date_options(moment_id) where is_selected;

create table if not exists public.moment_availability (
  id uuid primary key default gen_random_uuid(),
  date_option_id uuid not null references public.moment_date_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  availability_status text not null default 'NO_RESPONSE' check (availability_status in ('AVAILABLE','MAYBE','UNAVAILABLE','NO_RESPONSE')),
  updated_at timestamptz not null default now(),
  unique (date_option_id, user_id)
);

create table if not exists public.club_member_preferences (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create index if not exists clubs_owner_id_idx on public.clubs(owner_id);
create index if not exists club_members_user_active_idx on public.club_members(user_id, club_id) where membership_status = 'ACCEPTED';
create index if not exists moments_created_by_idx on public.moments(created_by, start_at);
create index if not exists moments_club_id_idx on public.moments(club_id, start_at) where club_id is not null;
create index if not exists moment_participants_user_idx on public.moment_participants(user_id, moment_id);
create index if not exists moment_date_options_moment_idx on public.moment_date_options(moment_id, start_at);
create index if not exists moment_availability_user_idx on public.moment_availability(user_id);

create or replace function private.is_club_member(target_club uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from public.club_members cm
    where cm.club_id = target_club and cm.user_id = target_user and cm.membership_status = 'ACCEPTED'
  );
$$;

create or replace function private.can_manage_club(target_club uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from public.club_members cm
    where cm.club_id = target_club and cm.user_id = target_user
      and cm.membership_status = 'ACCEPTED' and cm.role in ('OWNER','ADMIN','ORGANIZER')
  );
$$;

create or replace function private.can_access_moment(target_moment uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from public.moments m
    where m.id = target_moment and (
      m.created_by = target_user
      or (m.club_id is not null and private.is_club_member(m.club_id, target_user))
      or exists (select 1 from public.moment_participants mp where mp.moment_id = m.id and mp.user_id = target_user and mp.invitation_status <> 'REMOVED')
    )
  );
$$;

create or replace function private.can_manage_moment(target_moment uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from public.moments m
    where m.id = target_moment and (
      m.created_by = target_user
      or (m.club_id is not null and private.can_manage_club(m.club_id, target_user))
      or exists (
        select 1 from public.moment_participants mp
        where mp.moment_id = m.id and mp.user_id = target_user
          and mp.role in ('OWNER','ORGANIZER') and mp.invitation_status = 'ACCEPTED'
      )
    )
  );
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_club_member(uuid, uuid) to authenticated;
grant execute on function private.can_manage_club(uuid, uuid) to authenticated;
grant execute on function private.can_access_moment(uuid, uuid) to authenticated;
grant execute on function private.can_manage_moment(uuid, uuid) to authenticated;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.circle_relationships enable row level security;
alter table public.circle_preferences enable row level security;
alter table public.moments enable row level security;
alter table public.moment_participants enable row level security;
alter table public.moment_date_options enable row level security;
alter table public.moment_availability enable row level security;
alter table public.club_member_preferences enable row level security;

create policy "clubs visible to members" on public.clubs for select to authenticated
using (owner_id = (select auth.uid()) or visibility = 'DISCOVERABLE' or private.is_club_member(id));
create policy "users create clubs" on public.clubs for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy "club managers update clubs" on public.clubs for update to authenticated
using (owner_id = (select auth.uid()) or private.can_manage_club(id))
with check (owner_id = (select auth.uid()) or private.can_manage_club(id));

create policy "club memberships visible" on public.club_members for select to authenticated
using (user_id = (select auth.uid()) or private.is_club_member(club_id));
create policy "club managers invite" on public.club_members for insert to authenticated
with check (private.can_manage_club(club_id));
create policy "members answer or managers update" on public.club_members for update to authenticated
using (user_id = (select auth.uid()) or private.can_manage_club(club_id))
with check (user_id = (select auth.uid()) or private.can_manage_club(club_id));

create policy "relationships visible to both sides" on public.circle_relationships for select to authenticated
using ((select auth.uid()) in (requester_id, recipient_id));
create policy "users send circle invitations" on public.circle_relationships for insert to authenticated
with check (requester_id = (select auth.uid()));
create policy "both sides manage relationship" on public.circle_relationships for update to authenticated
using ((select auth.uid()) in (requester_id, recipient_id))
with check ((select auth.uid()) in (requester_id, recipient_id));

create policy "preferences are private" on public.circle_preferences for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "club preferences are private" on public.club_member_preferences for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "moments visible to authorized users" on public.moments for select to authenticated
using (private.can_access_moment(id));
create policy "users create moments" on public.moments for insert to authenticated
with check (created_by = (select auth.uid()) and (club_id is null or private.can_manage_club(club_id)));
create policy "organizers update moments" on public.moments for update to authenticated
using (created_by = (select auth.uid()) or (club_id is not null and private.can_manage_club(club_id)))
with check (created_by = (select auth.uid()) or (club_id is not null and private.can_manage_club(club_id)));

create policy "participants visible with moment" on public.moment_participants for select to authenticated
using (private.can_access_moment(moment_id));
create policy "organizers add participants" on public.moment_participants for insert to authenticated
with check (private.can_manage_moment(moment_id));
create policy "participants answer invitations" on public.moment_participants for update to authenticated
using (user_id = (select auth.uid()) or private.can_manage_moment(moment_id))
with check (user_id = (select auth.uid()) or private.can_manage_moment(moment_id));

create policy "date options visible with moment" on public.moment_date_options for select to authenticated
using (private.can_access_moment(moment_id));
create policy "organizers manage date options" on public.moment_date_options for all to authenticated
using (private.can_manage_moment(moment_id)) with check (private.can_manage_moment(moment_id));
create policy "availability visible with moment" on public.moment_availability for select to authenticated
using (private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id = date_option_id)));
create policy "users manage own availability" on public.moment_availability for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.clubs, public.club_members, public.circle_relationships,
  public.circle_preferences, public.moments, public.moment_participants, public.moment_date_options,
  public.moment_availability, public.club_member_preferences to authenticated;

-- Every new Club must have its owner represented as an accepted member.
create or replace function private.add_club_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'Club owner must be the authenticated user';
  end if;
  insert into public.club_members (club_id, user_id, invited_by, role, membership_status, joined_at)
  values (new.id, new.owner_id, new.owner_id, 'OWNER', 'ACCEPTED', now());
  return new;
end;
$$;
revoke all on function private.add_club_owner_membership() from public;
create trigger add_club_owner_membership
after insert on public.clubs
for each row execute function private.add_club_owner_membership();
