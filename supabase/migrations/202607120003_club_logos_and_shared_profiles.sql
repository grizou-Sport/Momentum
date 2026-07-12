-- MOMENTUM — Club logos and shared profile visibility

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-logos', 'club-logos', false, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_view_club(target_club uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from public.clubs c
    where c.id = target_club and c.status = 'ACTIVE'
      and (c.owner_id = target_user or c.visibility = 'DISCOVERABLE' or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.user_id = target_user
          and cm.membership_status in ('PENDING','ACCEPTED')
      ))
  );
$$;

create or replace function private.is_circle_member(target_user uuid, viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null and target_user is not null and exists (
    select 1 from public.circle_relationships r
    where r.status = 'ACCEPTED'
      and ((r.requester_id = viewer and r.recipient_id = target_user)
        or (r.recipient_id = viewer and r.requester_id = target_user))
  );
$$;

revoke all on function private.can_view_club(uuid, uuid) from public;
revoke all on function private.is_circle_member(uuid, uuid) from public;
grant execute on function private.can_view_club(uuid, uuid) to authenticated;
grant execute on function private.is_circle_member(uuid, uuid) to authenticated;

drop policy if exists "clubs visible to members" on public.clubs;
create policy "clubs visible to members" on public.clubs for select to authenticated
using (private.can_view_club(id));

create policy "circle members can view shared passports" on public.passports for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_circle_member(user_id)
  or exists (
    select 1 from public.club_members mine
    join public.club_members theirs on theirs.club_id = mine.club_id
    where mine.user_id = (select auth.uid()) and mine.membership_status = 'ACCEPTED'
      and theirs.user_id = passports.user_id and theirs.membership_status = 'ACCEPTED'
  )
);

create policy "club members read logos" on storage.objects for select to authenticated
using (
  bucket_id = 'club-logos'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.can_view_club(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "club managers upload logos" on storage.objects for insert to authenticated
with check (
  bucket_id = 'club-logos'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.can_manage_club(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "club managers delete logos" on storage.objects for delete to authenticated
using (
  bucket_id = 'club-logos'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.can_manage_club(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists "users add own availability" on public.moment_availability;
drop policy if exists "users update own availability" on public.moment_availability;
create policy "users add own availability" on public.moment_availability for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id = date_option_id))
);
create policy "users update own availability" on public.moment_availability for update to authenticated
using (
  user_id = (select auth.uid())
  and private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id = date_option_id))
)
with check (
  user_id = (select auth.uid())
  and private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id = date_option_id))
);
