-- Permit only the one system backfill introduced by the following migration.
-- Once cdc_guard_shared_confirmation is installed, it also rejects sessionless edits.
begin;
create or replace function private.guard_moment_participation() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); parent public.moments; manager boolean; occupied integer;
begin
 if actor is null then
  if tg_op='UPDATE'
   and to_jsonb(new) ? 'confirmed_schedule_revision'
   and (to_jsonb(new)-'confirmed_schedule_revision'-'updated_at')
     = (to_jsonb(old)-'confirmed_schedule_revision'-'updated_at')
  then new.updated_at:=old.updated_at; return new;
  end if;
  raise exception 'Session requise' using errcode='42501';
 end if;
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
commit;
