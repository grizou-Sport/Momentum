-- MOMENTUM — TOGETHER phase 1: secure Circle invitations between existing users

create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.profiles
  add column if not exists circle_discoverable boolean not null default true;

create unique index if not exists profiles_normalized_email_idx
  on public.profiles (lower(btrim(email)))
  where email is not null;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_email text,
  recipient_phone text,
  target_type text not null default 'circle' check (target_type in ('circle','club','moment')),
  target_id uuid,
  channel text not null default 'in_app' check (channel in ('in_app','link','email','whatsapp','qr')),
  token_hash text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  expires_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_user_id is null or inviter_id <> recipient_user_id),
  check (target_type <> 'circle' or target_id is null)
);

create unique index if not exists invitations_open_circle_pair_idx
  on public.invitations (
    least(inviter_id, recipient_user_id),
    greatest(inviter_id, recipient_user_id)
  )
  where target_type = 'circle' and recipient_user_id is not null and status = 'pending';
create index if not exists invitations_inviter_created_idx
  on public.invitations (inviter_id, created_at desc);
create index if not exists invitations_recipient_created_idx
  on public.invitations (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','removed','blocked')),
  created_from_invitation_id uuid references public.invitations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);

create index if not exists connections_high_status_idx
  on public.connections (user_high_id, status);
create index if not exists connections_low_status_idx
  on public.connections (user_low_id, status);

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id, blocker_id);

create table if not exists private.circle_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('search','invite')),
  created_at timestamptz not null default now()
);

create index if not exists circle_request_log_limit_idx
  on private.circle_request_log (user_id, action, created_at desc);

-- Preserve accepted relationships already created by the earlier TOGETHER MVP.
insert into public.connections (user_low_id, user_high_id, status, created_at, updated_at, ended_at)
select least(r.requester_id, r.recipient_id), greatest(r.requester_id, r.recipient_id),
  case when r.status = 'ACCEPTED' then 'active' else 'removed' end,
  r.created_at, coalesce(r.accepted_at, r.created_at),
  case when r.status = 'ACCEPTED' then null else coalesce(r.accepted_at, r.created_at) end
from public.circle_relationships r
where r.status <> 'PENDING'
on conflict (user_low_id, user_high_id) do nothing;

insert into public.invitations (
  inviter_id, recipient_user_id, target_type, channel, status, accepted_by, created_at, updated_at
)
select r.requester_id, r.recipient_id, 'circle', 'in_app',
  case r.status
    when 'ACCEPTED' then 'accepted'
    when 'DECLINED' then 'declined'
    else 'cancelled'
  end,
  case when r.status = 'ACCEPTED' then r.recipient_id else null end,
  r.created_at, coalesce(r.accepted_at, r.created_at)
from public.circle_relationships r
where r.status <> 'PENDING'
  and not exists (
    select 1 from public.invitations i
    where i.inviter_id = r.requester_id
      and i.recipient_user_id = r.recipient_id
      and i.created_at = r.created_at
  );

insert into public.invitations (
  inviter_id, recipient_user_id, target_type, channel, status, created_at, updated_at
)
select r.requester_id, r.recipient_id, 'circle', 'in_app', 'pending', r.created_at, r.created_at
from public.circle_relationships r
where r.status = 'PENDING'
on conflict do nothing;

create or replace function private.circle_rate_limit(
  requested_action text,
  maximum_requests integer,
  request_window interval
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recent_count integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_action not in ('search','invite') then
    raise exception 'Unsupported rate-limit action';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || requested_action, 0));
  select count(*) into recent_count
  from private.circle_request_log l
  where l.user_id = actor
    and l.action = requested_action
    and l.created_at >= now() - request_window;

  if recent_count >= maximum_requests then
    raise exception 'Too many requests. Please try again later.' using errcode = 'P0001';
  end if;
  insert into private.circle_request_log (user_id, action) values (actor, requested_action);
end;
$$;

create or replace function private.circle_public_identity(target_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'display_name', coalesce(
      nullif(btrim(concat_ws(' ', p.first_name,
        case when nullif(btrim(p.last_name), '') is null then null
             else left(btrim(p.last_name), 1) || '.' end)), ''),
      nullif(btrim(p.display_name), ''),
      'Membre MOMENTUM'
    ),
    'avatar_url', p.avatar_url
  )
  from public.profiles p
  where p.id = target_user;
$$;

create or replace function private.search_circle_user(target_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(target_email, '')));
  target uuid;
  relationship_status text := 'available';
  identity jsonb;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_email = '' or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;

  perform private.circle_rate_limit('search', 20, interval '15 minutes');

  select p.id into target
  from public.profiles p
  where lower(btrim(p.email)) = normalized_email
    and p.circle_discoverable
    and p.id <> actor
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = actor and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = actor)
    )
  limit 1;

  if target is null then
    return jsonb_build_object('available', false);
  end if;

  if exists (
    select 1 from public.connections c
    where c.user_low_id = least(actor, target)
      and c.user_high_id = greatest(actor, target)
      and c.status = 'active'
  ) then
    relationship_status := 'connected';
  elsif exists (
    select 1 from public.invitations i
    where i.target_type = 'circle' and i.status = 'pending'
      and least(i.inviter_id, i.recipient_user_id) = least(actor, target)
      and greatest(i.inviter_id, i.recipient_user_id) = greatest(actor, target)
  ) then
    relationship_status := 'pending';
  end if;

  identity := private.circle_public_identity(target);
  return coalesce(identity, '{}'::jsonb) || jsonb_build_object(
    'available', true,
    'relationship_status', relationship_status
  );
end;
$$;

create or replace function private.send_circle_invitation(target_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if target_user is null or target_user = actor then
    raise exception 'This invitation is not available';
  end if;

  perform private.circle_rate_limit('invite', 10, interval '1 hour');
  perform pg_advisory_xact_lock(hashtextextended(
    least(actor, target_user)::text || ':' || greatest(actor, target_user)::text, 0
  ));

  if not exists (
    select 1 from public.profiles p
    where p.id = target_user and p.circle_discoverable
  ) or exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = actor and b.blocked_id = target_user)
       or (b.blocker_id = target_user and b.blocked_id = actor)
  ) then
    raise exception 'This invitation is not available';
  end if;

  if exists (
    select 1 from public.connections c
    where c.user_low_id = least(actor, target_user)
      and c.user_high_id = greatest(actor, target_user)
      and c.status = 'active'
  ) then
    return jsonb_build_object('status', 'connected');
  end if;

  select i.id into invitation_id
  from public.invitations i
  where i.target_type = 'circle' and i.status = 'pending'
    and least(i.inviter_id, i.recipient_user_id) = least(actor, target_user)
    and greatest(i.inviter_id, i.recipient_user_id) = greatest(actor, target_user)
  limit 1;
  if invitation_id is not null then
    return jsonb_build_object('status', 'pending', 'invitation_id', invitation_id);
  end if;

  insert into public.invitations (
    inviter_id, recipient_user_id, recipient_email, target_type, channel
  )
  select actor, p.id, lower(btrim(p.email)), 'circle', 'in_app'
  from public.profiles p
  where p.id = target_user
  returning id into invitation_id;

  return jsonb_build_object('status', 'sent', 'invitation_id', invitation_id);
end;
$$;

create or replace function private.answer_circle_invitation(
  target_invitation uuid,
  answer text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.invitations%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if answer not in ('accept','decline','cancel') then
    raise exception 'Unsupported invitation response';
  end if;

  select * into invitation
  from public.invitations i
  where i.id = target_invitation and i.target_type = 'circle'
  for update;

  if invitation.id is null then
    raise exception 'Invitation not found';
  end if;
  if invitation.status <> 'pending' then
    return jsonb_build_object('status', invitation.status);
  end if;
  if answer = 'cancel' and invitation.inviter_id <> actor then
    raise exception 'Only the sender can cancel this invitation' using errcode = '42501';
  end if;
  if answer in ('accept','decline') and invitation.recipient_user_id <> actor then
    raise exception 'Only the recipient can answer this invitation' using errcode = '42501';
  end if;

  if answer = 'accept' then
    if exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = invitation.inviter_id and b.blocked_id = invitation.recipient_user_id)
         or (b.blocker_id = invitation.recipient_user_id and b.blocked_id = invitation.inviter_id)
    ) then
      raise exception 'This invitation is no longer available';
    end if;

    insert into public.connections (
      user_low_id, user_high_id, status, created_from_invitation_id, ended_at, updated_at
    ) values (
      least(invitation.inviter_id, invitation.recipient_user_id),
      greatest(invitation.inviter_id, invitation.recipient_user_id),
      'active', invitation.id, null, now()
    )
    on conflict (user_low_id, user_high_id) do update set
      status = 'active',
      created_from_invitation_id = excluded.created_from_invitation_id,
      ended_at = null,
      updated_at = now();

    update public.invitations
    set status = 'accepted', accepted_by = actor, updated_at = now()
    where id = invitation.id;
    return jsonb_build_object('status', 'accepted');
  end if;

  update public.invitations
  set status = case when answer = 'decline' then 'declined' else 'cancelled' end,
      updated_at = now()
  where id = invitation.id;
  return jsonb_build_object('status', case when answer = 'decline' then 'declined' else 'cancelled' end);
end;
$$;

create or replace function private.end_circle_connection(
  target_user uuid,
  should_block boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if target_user is null or target_user = actor then
    raise exception 'Invalid Circle member';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(actor, target_user)::text || ':' || greatest(actor, target_user)::text, 0
  ));

  update public.connections
  set status = case when should_block then 'blocked' else 'removed' end,
      ended_at = now(), updated_at = now()
  where user_low_id = least(actor, target_user)
    and user_high_id = greatest(actor, target_user)
    and status = 'active';

  if should_block then
    insert into public.blocked_users (blocker_id, blocked_id)
    values (actor, target_user)
    on conflict (blocker_id, blocked_id) do nothing;

    update public.invitations
    set status = 'cancelled', updated_at = now()
    where target_type = 'circle' and status = 'pending'
      and least(inviter_id, recipient_user_id) = least(actor, target_user)
      and greatest(inviter_id, recipient_user_id) = greatest(actor, target_user);
  end if;

  return jsonb_build_object('status', case when should_block then 'blocked' else 'removed' end);
end;
$$;

create or replace function private.get_circle_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (select auth.uid() as id),
  received as (
    select coalesce(jsonb_agg(
      private.circle_public_identity(i.inviter_id) || jsonb_build_object(
        'id', i.id, 'created_at', i.created_at, 'status', i.status
      ) order by i.created_at desc
    ), '[]'::jsonb) as value
    from public.invitations i, actor a
    where a.id is not null and i.recipient_user_id = a.id
      and i.target_type = 'circle' and i.status = 'pending'
  ),
  sent as (
    select coalesce(jsonb_agg(
      private.circle_public_identity(i.recipient_user_id) || jsonb_build_object(
        'id', i.id, 'created_at', i.created_at, 'status', i.status
      ) order by i.created_at desc
    ), '[]'::jsonb) as value
    from public.invitations i, actor a
    where a.id is not null and i.inviter_id = a.id
      and i.target_type = 'circle' and i.status = 'pending'
  ),
  members as (
    select coalesce(jsonb_agg(
      private.circle_public_identity(
        case when c.user_low_id = a.id then c.user_high_id else c.user_low_id end
      ) || jsonb_build_object('connection_id', c.id, 'created_at', c.created_at)
      order by c.created_at desc
    ), '[]'::jsonb) as value
    from public.connections c, actor a
    where a.id is not null and c.status = 'active'
      and a.id in (c.user_low_id, c.user_high_id)
  )
  select jsonb_build_object(
    'received', received.value,
    'sent', sent.value,
    'members', members.value
  )
  from received, sent, members;
$$;

-- Thin invoker wrappers expose only the intended RPC surface to PostgREST.
create or replace function public.search_circle_user(target_email text)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.search_circle_user(target_email); $$;

create or replace function public.send_circle_invitation(target_user uuid)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.send_circle_invitation(target_user); $$;

create or replace function public.answer_circle_invitation(target_invitation uuid, answer text)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.answer_circle_invitation(target_invitation, answer); $$;

create or replace function public.end_circle_connection(target_user uuid, should_block boolean default false)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.end_circle_connection(target_user, should_block); $$;

create or replace function public.get_circle_overview()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.get_circle_overview(); $$;

create or replace function private.is_circle_member(target_user uuid, viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null and target_user is not null and exists (
    select 1 from public.connections c
    where c.status = 'active'
      and c.user_low_id = least(viewer, target_user)
      and c.user_high_id = greatest(viewer, target_user)
  );
$$;

alter table public.invitations enable row level security;
alter table public.connections enable row level security;
alter table public.blocked_users enable row level security;

drop policy if exists "circle invitations visible to participants" on public.invitations;
create policy "circle invitations visible to participants" on public.invitations
for select to authenticated
using ((select auth.uid()) in (inviter_id, recipient_user_id));

drop policy if exists "circle connections visible to participants" on public.connections;
create policy "circle connections visible to participants" on public.connections
for select to authenticated
using ((select auth.uid()) in (user_low_id, user_high_id));

drop policy if exists "blocks visible to blocker" on public.blocked_users;
create policy "blocks visible to blocker" on public.blocked_users
for select to authenticated
using ((select auth.uid()) = blocker_id);

revoke all on public.invitations, public.connections, public.blocked_users from anon, authenticated;

revoke all on function private.circle_rate_limit(text, integer, interval) from public, anon;
revoke all on function private.circle_public_identity(uuid) from public, anon;
revoke all on function private.search_circle_user(text) from public, anon;
revoke all on function private.send_circle_invitation(uuid) from public, anon;
revoke all on function private.answer_circle_invitation(uuid, text) from public, anon;
revoke all on function private.end_circle_connection(uuid, boolean) from public, anon;
revoke all on function private.get_circle_overview() from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.search_circle_user(text) to authenticated;
grant execute on function private.send_circle_invitation(uuid) to authenticated;
grant execute on function private.answer_circle_invitation(uuid, text) to authenticated;
grant execute on function private.end_circle_connection(uuid, boolean) to authenticated;
grant execute on function private.get_circle_overview() to authenticated;
grant execute on function private.is_circle_member(uuid, uuid) to authenticated;

revoke all on function public.search_circle_user(text) from public, anon;
revoke all on function public.send_circle_invitation(uuid) from public, anon;
revoke all on function public.answer_circle_invitation(uuid, text) from public, anon;
revoke all on function public.end_circle_connection(uuid, boolean) from public, anon;
revoke all on function public.get_circle_overview() from public, anon;
grant execute on function public.search_circle_user(text) to authenticated;
grant execute on function public.send_circle_invitation(uuid) to authenticated;
grant execute on function public.answer_circle_invitation(uuid, text) to authenticated;
grant execute on function public.end_circle_connection(uuid, boolean) to authenticated;
grant execute on function public.get_circle_overview() to authenticated;

-- Direct mutation of the legacy relationship table is no longer part of the client API.
revoke insert, update, delete on public.circle_relationships from authenticated;
