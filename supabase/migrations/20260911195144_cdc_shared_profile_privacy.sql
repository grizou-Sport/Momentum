begin;
drop policy if exists "circle members can view shared passports" on public.passports;
create or replace function private.shared_profiles(p_user_ids uuid[],p_moment_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or p_user_ids is null or cardinality(p_user_ids)>200 then raise exception 'Profils indisponibles' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'avatar_url',p.avatar_url)),'[]'::jsonb) from public.passports p where p.user_id=any(p_user_ids) and (
  p.user_id=actor or private.is_circle_member(p.user_id,actor)
  or exists(select 1 from public.club_members mine join public.club_members theirs on theirs.club_id=mine.club_id where mine.user_id=actor and mine.membership_status='ACCEPTED' and theirs.user_id=p.user_id and theirs.membership_status='ACCEPTED')
  or (p_moment_id is not null and private.can_access_moment(p_moment_id,actor) and exists(select 1 from public.moment_participants mp where mp.moment_id=p_moment_id and mp.user_id=p.user_id and mp.invitation_status<>'REMOVED'))
 ));
end $$;
revoke all on function private.shared_profiles(uuid[],uuid) from public,anon;
grant execute on function private.shared_profiles(uuid[],uuid) to authenticated;
create or replace function public.shared_profiles(p_user_ids uuid[],p_moment_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.shared_profiles(p_user_ids,p_moment_id);$$;
revoke all on function public.shared_profiles(uuid[],uuid) from public,anon;
grant execute on function public.shared_profiles(uuid[],uuid) to authenticated;
-- Trois tables avaient RLS actif sans aucune politique : leur propriétaire ne pouvait pas les utiliser.
create policy "equipment catalog readable" on public.equipment_categories for select to authenticated using(true);
create policy "owners manage equipment" on public.user_equipment to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "owners manage activity equipment" on public.activity_equipment to authenticated
 using(exists(select 1 from public.activities a where a.id=activity_id and a.user_id=(select auth.uid())))
 with check(exists(select 1 from public.activities a where a.id=activity_id and a.user_id=(select auth.uid())) and exists(select 1 from public.user_equipment e where e.id=equipment_id and e.user_id=(select auth.uid())));
commit;
