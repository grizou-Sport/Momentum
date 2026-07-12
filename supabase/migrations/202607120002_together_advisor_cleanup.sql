-- MOMENTUM — TOGETHER advisor cleanup

create index if not exists circle_relationships_requester_idx on public.circle_relationships(requester_id);
create index if not exists circle_relationships_recipient_idx on public.circle_relationships(recipient_id);
create index if not exists circle_preferences_member_idx on public.circle_preferences(circle_member_id);
create index if not exists club_members_invited_by_idx on public.club_members(invited_by) where invited_by is not null;
create index if not exists club_member_preferences_user_idx on public.club_member_preferences(user_id);
create index if not exists moment_date_options_created_by_idx on public.moment_date_options(created_by);
create index if not exists moments_user_id_idx on public.moments(user_id);
create index if not exists moments_day_id_idx on public.moments(day_id) where day_id is not null;

drop policy if exists "Users manage own moments" on public.moments;
drop policy if exists "moments visible to authorized users" on public.moments;
drop policy if exists "users create moments" on public.moments;
drop policy if exists "organizers update moments" on public.moments;

create policy "moments visible to authorized users" on public.moments for select to authenticated
using (private.can_access_moment(id));
create policy "users create moments" on public.moments for insert to authenticated
with check (
  user_id = (select auth.uid()) and created_by = (select auth.uid())
  and (club_id is null or private.can_manage_club(club_id))
);
create policy "organizers update moments" on public.moments for update to authenticated
using (user_id = (select auth.uid()) or created_by = (select auth.uid()) or (club_id is not null and private.can_manage_club(club_id)))
with check (
  (user_id = (select auth.uid()) and created_by = (select auth.uid()))
  or (club_id is not null and private.can_manage_club(club_id))
);
create policy "owners delete moments" on public.moments for delete to authenticated
using (user_id = (select auth.uid()) or created_by = (select auth.uid()) or (club_id is not null and private.can_manage_club(club_id)));

drop policy if exists "organizers manage date options" on public.moment_date_options;
create policy "organizers add date options" on public.moment_date_options for insert to authenticated
with check (private.can_manage_moment(moment_id));
create policy "organizers update date options" on public.moment_date_options for update to authenticated
using (private.can_manage_moment(moment_id)) with check (private.can_manage_moment(moment_id));
create policy "organizers delete date options" on public.moment_date_options for delete to authenticated
using (private.can_manage_moment(moment_id));

drop policy if exists "users manage own availability" on public.moment_availability;
create policy "users add own availability" on public.moment_availability for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "users update own availability" on public.moment_availability for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete own availability" on public.moment_availability for delete to authenticated
using (user_id = (select auth.uid()));
