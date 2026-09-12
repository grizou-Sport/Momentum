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
grant usage on schema private to authenticated;
grant execute on function private.is_club_member(uuid,uuid) to authenticated;
grant execute on function private.can_manage_club(uuid,uuid) to authenticated;
grant execute on function private.can_access_moment(uuid,uuid) to authenticated;
grant execute on function private.can_manage_moment(uuid,uuid) to authenticated;
-- Politiques et fonctions de partage vérifiées sur le schéma avant CDC (sans données de production).
drop policy own_rows on public.moment_participants;
drop policy own_rows on public.moments;
create policy "moment activities visible to participants" on public.moment_activities for select to authenticated using (private.can_access_moment(moment_id));
create policy "participants link own activities" on public.moment_activities for insert to authenticated with check (((added_by = ( SELECT auth.uid() AS uid)) AND private.can_access_moment(moment_id) AND (EXISTS ( SELECT 1
   FROM activities a
  WHERE ((a.id = moment_activities.activity_id) AND (a.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "users unlink own activities" on public.moment_activities for delete to authenticated using (((added_by = ( SELECT auth.uid() AS uid)) OR private.can_manage_moment(moment_id)));
create policy "organizers add participants" on public.moment_participants for insert to authenticated with check (private.can_manage_moment(moment_id));
create policy "participants answer invitations" on public.moment_participants for update to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_moment(moment_id))) with check (((user_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_moment(moment_id)));
create policy "participants visible with moment" on public.moment_participants for select to authenticated using (private.can_access_moment(moment_id));
create policy "moments visible to authorized users" on public.moments for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)) OR private.can_access_moment(id)));
create policy "organizers update moments" on public.moments for update to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)) OR ((club_id IS NOT NULL) AND private.can_manage_club(club_id)))) with check ((((user_id = ( SELECT auth.uid() AS uid)) AND (created_by = ( SELECT auth.uid() AS uid))) OR ((club_id IS NOT NULL) AND private.can_manage_club(club_id))));
create policy "owners delete moments" on public.moments for delete to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)) OR ((club_id IS NOT NULL) AND private.can_manage_club(club_id))));
create policy "users create moments" on public.moments for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (created_by = ( SELECT auth.uid() AS uid)) AND ((club_id IS NULL) OR private.can_manage_club(club_id))));
-- Date-option policies captured from the existing project on 2026-09-11.
create policy "date options visible with moment" on public.moment_date_options for select to authenticated using(private.can_access_moment(moment_id));
create policy "organizers add date options" on public.moment_date_options for insert to authenticated with check(private.can_manage_moment(moment_id));
create policy "organizers delete date options" on public.moment_date_options for delete to authenticated using(private.can_manage_moment(moment_id));
create policy "organizers update date options" on public.moment_date_options for update to authenticated using(private.can_manage_moment(moment_id)) with check(private.can_manage_moment(moment_id));
-- Availability policies captured from the existing project on 2026-09-12.
drop policy own_rows on public.moment_availability;
create policy "availability visible with moment" on public.moment_availability for select to authenticated using(private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id=moment_availability.date_option_id)));
create policy "users add own availability" on public.moment_availability for insert to authenticated with check(user_id=(select auth.uid()) and private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id=moment_availability.date_option_id)));
create policy "users update own availability" on public.moment_availability for update to authenticated using(user_id=(select auth.uid()) and private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id=moment_availability.date_option_id))) with check(user_id=(select auth.uid()) and private.can_access_moment((select o.moment_id from public.moment_date_options o where o.id=moment_availability.date_option_id)));
create policy "users delete own availability" on public.moment_availability for delete to authenticated using(user_id=(select auth.uid()));
