begin;
alter table public.moments add column revision bigint not null default 1;
alter table public.moment_participants add column confirmed_schedule_revision integer;
update public.moment_participants p set confirmed_schedule_revision=m.schedule_revision
 from public.moments m where m.id=p.moment_id and p.invitation_status='ACCEPTED';

create table private.shared_moment_operations(
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null, request_hash bytea not null,
 moment_id uuid not null references public.moments(id) on delete cascade,
 result jsonb not null, created_at timestamptz not null default now(), primary key(user_id,operation_id)
);
create index shared_moment_operations_moment_idx on private.shared_moment_operations(moment_id);
alter table private.shared_moment_operations enable row level security;
revoke all on private.shared_moment_operations from public,anon,authenticated;
create trigger aaa_account_writable before insert or update or delete on private.shared_moment_operations
 for each row execute function private.enforce_account_writable();

-- Draft participant selections are retained, but no invitee or club member can read them.
create or replace function private.can_access_moment(target_moment uuid,target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select target_user is not null and exists(select 1 from public.moments m where m.id=target_moment and (
  m.created_by=target_user or m.user_id=target_user or (m.status<>'DRAFT' and (
   (m.club_id is not null and private.is_club_member(m.club_id,target_user))
   or exists(select 1 from public.moment_participants p where p.moment_id=m.id and p.user_id=target_user and p.invitation_status<>'REMOVED')))));
$$;
create policy "drafts remain private" on public.moments as restrictive for select to authenticated
 using(status<>'DRAFT' or created_by=(select auth.uid()) or user_id=(select auth.uid()));
create policy "draft participants remain private" on public.moment_participants as restrictive for select to authenticated
 using(private.can_access_moment(moment_id));
create policy "availability requires moment access" on public.moment_availability as restrictive to authenticated
 using(exists(select 1 from public.moment_date_options o where o.id=date_option_id and private.can_access_moment(o.moment_id)))
 with check(exists(select 1 from public.moment_date_options o where o.id=date_option_id and private.can_access_moment(o.moment_id)));

create function private.advance_shared_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1; new.updated_at:=clock_timestamp(); return new; end $$;
create trigger cdc_advance_shared_revision before update on public.moments for each row execute function private.advance_shared_revision();
create function private.touch_shared_participants() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.moments set updated_at=clock_timestamp() where id=coalesce(new.moment_id,old.moment_id);
 return coalesce(new,old);
end $$;
create trigger cdc_touch_shared_participants after insert or update or delete on public.moment_participants
 for each row execute function private.touch_shared_participants();
create function private.guard_shared_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' and new.confirmed_schedule_revision is not null)
  or (tg_op='UPDATE' and new.confirmed_schedule_revision is distinct from old.confirmed_schedule_revision and new.confirmed_schedule_revision is not null) then
  if auth.uid() is distinct from new.user_id or new.confirmed_schedule_revision is distinct from (select schedule_revision from public.moments where id=new.moment_id)
   then raise exception 'Chaque participant confirme lui-même la date et le lieu actuels.' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger cdc_guard_shared_confirmation before insert or update on public.moment_participants
 for each row execute function private.guard_shared_confirmation();

-- A changed place is a changed invitation, just like a changed date. Existing opt-outs stay private.
create or replace function private.version_moment_schedule() returns trigger language plpgsql set search_path='' as $$
begin
 if new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at
  or new.location_id is distinct from old.location_id or new.location_name is distinct from old.location_name
 then new.schedule_revision:=old.schedule_revision+1; end if;
 return new;
end $$;
create or replace function private.invalidate_guest_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.schedule_revision is distinct from old.schedule_revision then
  update private.guest_invitations set response_state=case when answer='none' then 'unanswered' else 'pending_validation' end,
   shared_location=case when share_location then new.location_name end,response_revision=response_revision+1,
   response_history=response_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'action','schedule_changed','previous_state',response_state,'previous_schedule_revision',old.schedule_revision)),updated_at=clock_timestamp() where moment_id=new.id;
  -- Keep prior registered places reserved until the participant reconfirms or declines.
  -- confirmed_schedule_revision records which version was actually accepted.
 end if;
 return new;
end $$;

create function private.shared_moment_command(p_action text,p_operation_id uuid,p_data jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; parent public.moments; previous private.shared_moment_operations;
 request_hash bytea; result jsonb; existed boolean; manager boolean; candidate uuid; slot jsonb; slot_id uuid;
 old_slot public.moment_date_options; chosen public.moment_date_options; ids uuid[]; slot_ids uuid[]:='{}';
 status_value text; mode_value text; title_value text; club uuid; place uuid; start_value timestamptz; end_value timestamptz;
 location_value text; capacity_value integer; person public.moment_participants;
begin
 if actor is null or not private.account_writable() then raise exception 'Connexion active requise' using errcode='42501'; end if;
 if p_operation_id is null or jsonb_typeof(p_data) is distinct from 'object' or p_action not in ('save','confirm_date','answer','availability','complete') or p_action is null
 then raise exception 'Demande invalide' using errcode='22023'; end if;
 request_hash:=sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data,'revision',p_expected_revision)::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('shared-op:'||actor::text||p_operation_id::text,0));
 select * into previous from private.shared_moment_operations where user_id=actor and operation_id=p_operation_id;
 if found then
  if previous.request_hash<>request_hash or not private.can_access_moment(previous.moment_id,actor) then raise exception 'Cette opération a changé' using errcode='40001'; end if;
  return previous.result;
 end if;
 target:=(p_data->>'id')::uuid;
 if target is null then raise exception 'Moment requis' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('shared-moment:'||target::text,0));
 select * into parent from public.moments where id=target for update;
 existed:=found; manager:=existed and private.can_manage_moment(target,actor);
 if existed and (not private.can_access_moment(target,actor) or p_action in ('save','confirm_date','complete') and not manager)
  or not existed and p_action<>'save' then raise exception 'Moment indisponible' using errcode='42501'; end if;
 if p_action in ('save','confirm_date','complete') and (
  existed and (p_expected_revision is null or parent.revision<>p_expected_revision)
  or not existed and p_expected_revision is not null) then raise exception 'Le Moment a changé. Recharge-le avant de modifier.' using errcode='40001'; end if;

 if p_action='save' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k<>all(array['id','title','description','moment_type','status','date_mode','start_at','end_at','location_id','location_name','capacity','visibility','club_id','participants','options']))
   or jsonb_typeof(p_data->'participants') is distinct from 'array' or jsonb_typeof(p_data->'options') is distinct from 'array'
   or jsonb_array_length(p_data->'participants')>200 or jsonb_array_length(p_data->'options')>30
   or exists(select 1 from jsonb_each(p_data) f where f.key in ('title','description','moment_type','status','date_mode','start_at','end_at','location_id','location_name','visibility','club_id') and jsonb_typeof(f.value) not in ('string','null'))
  then raise exception 'Champs du Moment invalides' using errcode='22023'; end if;
  title_value:=btrim(coalesce(p_data->>'title','')); status_value:=p_data->>'status'; mode_value:=p_data->>'date_mode';
  club:=nullif(p_data->>'club_id','')::uuid; place:=nullif(p_data->>'location_id','')::uuid;
  location_value:=nullif(btrim(p_data->>'location_name'),'');
  start_value:=nullif(p_data->>'start_at','')::timestamptz; end_value:=nullif(p_data->>'end_at','')::timestamptz;
  capacity_value:=(p_data->>'capacity')::integer;
  if status_value is null or status_value not in ('DRAFT','PLANNING','CONFIRMED') or mode_value is null or mode_value not in ('fixed','options')
   or length(title_value)>120 or status_value<>'DRAFT' and title_value=''
   or length(coalesce(p_data->>'description',''))>5000 or length(location_value)>300
   or capacity_value is not null and (capacity_value<1 or capacity_value>100000)
   or jsonb_typeof(p_data->'capacity') not in ('number','null')
   or start_value is not null and not isfinite(start_value) or end_value is not null and not isfinite(end_value)
   or (p_data->>'moment_type') is null or (p_data->>'moment_type') not in ('SPORT','ADVENTURE','TRAVEL','SOCIAL','OTHER')
   or (p_data->>'visibility') is null or (p_data->>'visibility') not in ('PRIVATE','CIRCLE','PARTICIPANTS')
   or mode_value='options' and (start_value is not null or end_value is not null)
   or status_value='CONFIRMED' and (mode_value<>'fixed' or start_value is null)
   or status_value='PLANNING' and (mode_value<>'options' or jsonb_array_length(p_data->'options')=0)
   or end_value is not null and (start_value is null or end_value<=start_value)
  then raise exception 'Titre et date cohérente requis pour publier ; sinon enregistre un brouillon.' using errcode='22023'; end if;
  if existed and (parent.status in ('COMPLETED','CANCELLED','ONGOING') or parent.status<>'DRAFT' and status_value='DRAFT')
  then raise exception 'Ce Moment ne peut pas revenir en brouillon ni être réorganisé dans cet état.' using errcode='22023'; end if;
  if club is not null and not private.can_manage_club(club,actor) then raise exception 'Organisation du Club requise' using errcode='42501'; end if;
  if place is not null and not exists(select 1 from public.locations l where l.id=place and (l.owner_user_id=actor or l.created_by=actor or l.visibility='public' or existed and parent.location_id=place))
  then raise exception 'Lieu indisponible' using errcode='42501'; end if;
  select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(p_data->'participants');
  if array_position(ids,null) is not null or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Participants invalides' using errcode='22023'; end if;
  foreach candidate in array ids loop
   if candidate=actor then continue; end if;
   -- Existing members survive a change to the Circle. New selections must be known contacts.
   if not exists(select 1 from public.moment_participants where moment_id=target and user_id=candidate and invitation_status<>'REMOVED') and (
    exists(select 1 from public.blocked_users b where (b.blocker_id=actor and b.blocked_id=candidate) or (b.blocker_id=candidate and b.blocked_id=actor))
    or not (private.is_circle_member(candidate,actor)
     or exists(select 1 from public.connections c where c.status='active' and ((c.user_low_id=actor and c.user_high_id=candidate) or (c.user_high_id=actor and c.user_low_id=candidate)))
     or club is not null and private.is_club_member(club,candidate)))
   then raise exception 'Participant indisponible dans ce Cercle ou Club' using errcode='42501'; end if;
  end loop;
  if not existed then
   insert into public.moments(id,user_id,created_by,title,status,moment_type,visibility,club_id,start_at,end_at,description,location_id,location_name,capacity)
    values(target,actor,actor,title_value,status_value,p_data->>'moment_type',p_data->>'visibility',club,start_value,end_value,nullif(btrim(p_data->>'description'),''),place,location_value,capacity_value);
  else
   update public.moments set title=title_value,status=status_value,moment_type=p_data->>'moment_type',visibility=p_data->>'visibility',club_id=club,start_at=start_value,end_at=end_value,
    description=nullif(btrim(p_data->>'description'),''),location_id=place,location_name=location_value,capacity=capacity_value where id=target;
  end if;
  for slot in select value from jsonb_array_elements(p_data->'options') loop
   if jsonb_typeof(slot) is distinct from 'object' or exists(select 1 from jsonb_object_keys(slot) k where k<>all(array['id','start_at','end_at']))
    or jsonb_typeof(slot->'id') is distinct from 'string' or jsonb_typeof(slot->'start_at') is distinct from 'string'
   then raise exception 'Créneau invalide' using errcode='22023'; end if;
   slot_id:=(slot->>'id')::uuid;
   if slot_id is null or slot_id=any(slot_ids) or (slot->>'start_at')::timestamptz is null or not isfinite((slot->>'start_at')::timestamptz)
    or nullif(slot->>'end_at','')::timestamptz is not null and not isfinite(nullif(slot->>'end_at','')::timestamptz)
    or nullif(slot->>'end_at','')::timestamptz <= (slot->>'start_at')::timestamptz then raise exception 'Créneaux distincts et horaires cohérents requis' using errcode='22023'; end if;
   slot_ids:=array_append(slot_ids,slot_id);
   select * into old_slot from public.moment_date_options where id=slot_id;
   if found then
    if old_slot.moment_id<>target then raise exception 'Créneau indisponible' using errcode='42501'; end if;
    if old_slot.start_at is distinct from (slot->>'start_at')::timestamptz or old_slot.end_at is distinct from nullif(slot->>'end_at','')::timestamptz then
     if exists(select 1 from public.moment_availability where date_option_id=slot_id)
      or exists(select 1 from private.guest_invitations where moment_id=target and availability ? slot_id::text)
     then raise exception 'Ce créneau a reçu des réponses. Conserve-le et propose une nouvelle date.' using errcode='22023'; end if;
    end if;
    update public.moment_date_options set start_at=(slot->>'start_at')::timestamptz,end_at=nullif(slot->>'end_at','')::timestamptz,is_selected=false where id=slot_id;
   else
    insert into public.moment_date_options(id,moment_id,created_by,start_at,end_at) values(slot_id,target,actor,(slot->>'start_at')::timestamptz,nullif(slot->>'end_at','')::timestamptz);
   end if;
  end loop;
  if exists(select 1 from public.moment_date_options o where o.moment_id=target and not(o.id=any(slot_ids)) and (
   exists(select 1 from public.moment_availability a where a.date_option_id=o.id)
   or exists(select 1 from private.guest_invitations g where g.moment_id=target and g.availability ? o.id::text)))
  then raise exception 'Un créneau ayant reçu des réponses doit être conservé.' using errcode='22023'; end if;
  delete from public.moment_date_options where moment_id=target and not(id=any(slot_ids));
  if status_value='CONFIRMED' or status_value='DRAFT' and mode_value='fixed' and start_value is not null then
   select * into chosen from public.moment_date_options where moment_id=target and start_at=start_value and end_at is not distinct from end_value order by id limit 1;
   if not found then raise exception 'Le créneau confirmé manque à la proposition' using errcode='22023'; end if;
   update public.moment_date_options set is_selected=true where id=chosen.id;
  end if;
  if not existed then
   insert into public.moment_participants(moment_id,user_id,role,invitation_status,participation_status)
    values(target,actor,'OWNER','ACCEPTED','REGISTERED');
  end if;
  for person in select * from public.moment_participants where moment_id=target and role<>'OWNER' loop
   if not(person.user_id=any(ids)) and person.invitation_status<>'REMOVED' then
    update public.moment_participants set invitation_status='REMOVED',participation_status='DECLINED' where id=person.id;
   end if;
  end loop;
  foreach candidate in array ids loop
   if candidate=actor then continue; end if;
   select * into person from public.moment_participants where moment_id=target and user_id=candidate;
   if not found then
    insert into public.moment_participants(moment_id,user_id,role,invitation_status,participation_status) values(target,candidate,'PARTICIPANT','PENDING','INVITED');
   elsif person.invitation_status='REMOVED' then
    update public.moment_participants set invitation_status='PENDING',participation_status='INVITED',confirmed_schedule_revision=null where id=person.id;
   end if;
  end loop;
  -- The creator has just chosen this version; other members must answer for themselves.
  update public.moment_participants set confirmed_schedule_revision=(select schedule_revision from public.moments where id=target)
   where moment_id=target and user_id=actor and invitation_status='ACCEPTED';
 elsif p_action='confirm_date' then
  if parent.status not in ('PLANNING','CONFIRMED') then raise exception 'Confirmation indisponible' using errcode='22023'; end if;
  select * into chosen from public.moment_date_options where id=(p_data->>'option_id')::uuid and moment_id=target;
  if not found then raise exception 'Créneau indisponible' using errcode='42501'; end if;
  update public.moment_date_options set is_selected=false where moment_id=target and is_selected;
  update public.moment_date_options set is_selected=true where id=chosen.id;
  update public.moments set start_at=chosen.start_at,end_at=chosen.end_at,status='CONFIRMED',
   location_id=coalesce(chosen.location_id,location_id),location_name=coalesce(chosen.location_name,location_name) where id=target;
  update public.moment_participants set confirmed_schedule_revision=(select schedule_revision from public.moments where id=target)
   where moment_id=target and user_id=actor and invitation_status='ACCEPTED';
 elsif p_action='complete' then
  if parent.status<>'CONFIRMED' then raise exception 'Seul un Moment confirmé peut être terminé' using errcode='22023'; end if;
  update public.moments set status='COMPLETED' where id=target;
 elsif p_action='answer' then
  if parent.status not in ('PLANNING','CONFIRMED','ONGOING') or (p_data->>'schedule_revision')::integer is distinct from parent.schedule_revision
   then raise exception 'La date ou le lieu a changé. Relis le Moment avant de répondre.' using errcode='40001'; end if;
  if (p_data->>'answer') is null or (p_data->>'answer') not in ('ACCEPTED','DECLINED') then raise exception 'Réponse invalide' using errcode='22023'; end if;
  update public.moment_participants set invitation_status=p_data->>'answer',
   participation_status=case when p_data->>'answer'='ACCEPTED' then 'REGISTERED' else 'DECLINED' end,confirmed_schedule_revision=parent.schedule_revision
   where moment_id=target and user_id=actor and invitation_status<>'REMOVED' returning * into person;
  if not found then raise exception 'Invitation indisponible' using errcode='42501'; end if;
 elsif p_action='availability' then
  if parent.status not in ('PLANNING','CONFIRMED') or (p_data->>'schedule_revision')::integer is distinct from parent.schedule_revision
   then raise exception 'Les créneaux ont changé. Relis le Moment avant de répondre.' using errcode='40001'; end if;
  if not exists(select 1 from public.moment_participants where moment_id=target and user_id=actor and invitation_status<>'REMOVED')
   or not exists(select 1 from public.moment_date_options where id=(p_data->>'option_id')::uuid and moment_id=target)
   then raise exception 'Créneau indisponible' using errcode='42501'; end if;
  if (p_data->>'answer') is null or (p_data->>'answer') not in ('AVAILABLE','MAYBE','UNAVAILABLE') then raise exception 'Disponibilité invalide' using errcode='22023'; end if;
  update public.moment_availability set availability_status=p_data->>'answer',updated_at=clock_timestamp()
   where date_option_id=(p_data->>'option_id')::uuid and user_id=actor;
  if not found then insert into public.moment_availability(date_option_id,user_id,availability_status) values((p_data->>'option_id')::uuid,actor,p_data->>'answer'); end if;
 end if;
 select jsonb_build_object('id',id,'revision',revision,'schedule_revision',schedule_revision,'status',status,'participation_status',person.participation_status) into result from public.moments where id=target;
 insert into private.shared_moment_operations(user_id,operation_id,request_hash,moment_id,result) values(actor,p_operation_id,request_hash,target,result);
 return result;
end $$;
create function public.save_shared_moment(p_operation_id uuid,p_data jsonb,p_expected_revision bigint default null) returns jsonb
 language sql security invoker set search_path='' as $$select private.shared_moment_command('save',p_operation_id,p_data,p_expected_revision);$$;
create function public.shared_moment_action(p_action text,p_operation_id uuid,p_data jsonb,p_expected_revision bigint default null) returns jsonb
 language sql security invoker set search_path='' as $$select private.shared_moment_command(p_action,p_operation_id,p_data,p_expected_revision);$$;
revoke all on function private.advance_shared_revision(),private.touch_shared_participants(),private.guard_shared_confirmation() from public,anon,authenticated;
revoke all on function private.shared_moment_command(text,uuid,jsonb,bigint),public.save_shared_moment(uuid,jsonb,bigint),public.shared_moment_action(text,uuid,jsonb,bigint) from public,anon;
grant execute on function private.shared_moment_command(text,uuid,jsonb,bigint),public.save_shared_moment(uuid,jsonb,bigint),public.shared_moment_action(text,uuid,jsonb,bigint) to authenticated;
commit;
