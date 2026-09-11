-- Le partage d'une activité expose une projection explicite, jamais sa ligne privée complète.
begin;
drop policy if exists "shared linked activities are visible" on public.activities;
alter table public.activities drop constraint if exists activities_moment_id_fkey;
alter table public.activities add constraint activities_moment_id_fkey foreign key(moment_id) references public.moments(id) on delete set null;
alter table public.moments drop constraint if exists moments_day_id_fkey;
alter table public.moments add constraint moments_day_id_fkey foreign key(day_id) references public.days(id) on delete set null;

create or replace function private.shared_moment_activities(p_moment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_access_moment(p_moment_id,auth.uid()) then raise exception 'Moment indisponible' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',ma.id,'activity_id',a.id,'activities',jsonb_build_object('id',a.id,'sport',a.sport,'activity_type',a.activity_type,'activity_date',a.activity_date,'distance_km',a.distance_km,'duration_min',a.duration_min,'elevation_m',a.elevation_m)) order by ma.created_at,ma.id),'[]'::jsonb) from public.moment_activities ma join public.activities a on a.id=ma.activity_id where ma.moment_id=p_moment_id and ma.added_by=a.user_id);
end $$;
revoke all on function private.shared_moment_activities(uuid) from public,anon;
grant execute on function private.shared_moment_activities(uuid) to authenticated;
create or replace function public.shared_moment_activities(p_moment_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.shared_moment_activities(p_moment_id); $$;
revoke all on function public.shared_moment_activities(uuid) from public,anon;
grant execute on function public.shared_moment_activities(uuid) to authenticated;

-- Point commun de comptage : la migration des invités ajoutera leurs places confirmées.
create or replace function private.confirmed_guest_places(p_moment_id uuid) returns integer language sql stable security definer set search_path='' as $$ select 0; $$;
revoke all on function private.confirmed_guest_places(uuid) from public,anon,authenticated;

create or replace function private.guard_moment_participation() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); parent public.moments; manager boolean; occupied integer;
begin
 if actor is null then raise exception 'Session requise' using errcode='42501'; end if;
 select * into parent from public.moments where id=new.moment_id for update;
 if not found then raise exception 'Moment indisponible' using errcode='42501'; end if;
 manager:=private.can_manage_moment(new.moment_id,actor);
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.moment_id is distinct from old.moment_id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at then raise exception 'Identité de participation immuable' using errcode='42501'; end if;
  if not manager and (old.user_id<>actor or new.role is distinct from old.role or old.invitation_status='REMOVED' or new.invitation_status not in ('ACCEPTED','DECLINED')) then raise exception 'Modification non autorisée' using errcode='42501'; end if;
 elsif not manager then raise exception 'Organisation requise' using errcode='42501'; end if;
 if new.invitation_status='DECLINED' then new.participation_status:='DECLINED'; end if;
 if new.participation_status='REGISTERED' then
  if new.invitation_status<>'ACCEPTED' or (parent.status='CANCELLED' or parent.status='DRAFT' and new.role<>'OWNER') then raise exception 'Inscription non disponible' using errcode='22023'; end if;
  select count(*) into occupied from public.moment_participants where moment_id=new.moment_id and id<>new.id and invitation_status='ACCEPTED' and participation_status='REGISTERED';
  occupied:=occupied+private.confirmed_guest_places(new.moment_id);
  if parent.capacity is not null and occupied>=parent.capacity then new.participation_status:='WAITLISTED'; end if;
 end if;
 new.updated_at:=clock_timestamp(); return new;
end $$;
revoke all on function private.guard_moment_participation() from public,anon,authenticated;
create trigger cdc_guard_moment_participation before insert or update on public.moment_participants for each row execute function private.guard_moment_participation();

create or replace function private.guard_moment_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare occupied integer;
begin
 if new.capacity is not null and new.capacity is distinct from old.capacity then
  select count(*) into occupied from public.moment_participants where moment_id=old.id and invitation_status='ACCEPTED' and participation_status='REGISTERED';
  if new.capacity<occupied+private.confirmed_guest_places(old.id) then raise exception 'Des places sont déjà confirmées. Retirer explicitement des inscriptions avant de réduire la capacité.' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_moment_capacity() from public,anon,authenticated;
create trigger cdc_guard_moment_capacity before update on public.moments for each row execute function private.guard_moment_capacity();
commit;
