-- Invitations individuelles : secrets uniquement hachés, aucune lecture anonyme des tables métier.
begin;
alter table public.moments add column if not exists schedule_revision integer not null default 1;
create table private.guest_allowed_origins(origin text primary key);
insert into private.guest_allowed_origins values ('https://momentum-alpha-rho.vercel.app');
create table private.guest_invitations(
 id uuid primary key, moment_id uuid not null references public.moments(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade, response_id uuid not null unique default gen_random_uuid(),
 recipient_label text not null, message text not null default '', shared_location text,
 secret_hash text not null, generation integer not null default 1, expires_at timestamptz not null, revoked_at timestamptz,
 display_name text, answer text not null default 'none' check(answer in ('none','yes','maybe','no')),
 availability jsonb not null default '{}', responded_schedule_revision integer, response_revision integer not null default 0,
 response_state text not null default 'unanswered' check(response_state in ('unanswered','pending_validation','confirmed','declined')),
 response_history jsonb not null default '[]', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index guest_secret_hash_idx on private.guest_invitations(secret_hash);
create index guest_invitation_owner_idx on private.guest_invitations(owner_id,created_at);
create index guest_invitation_moment_idx on private.guest_invitations(moment_id,response_state);
create table private.guest_sessions(secret_hash text primary key, invitation_id uuid not null references private.guest_invitations(id) on delete cascade, generation integer not null, expires_at timestamptz not null);
create index guest_session_invitation_idx on private.guest_sessions(invitation_id);
create index guest_session_expiry_idx on private.guest_sessions(expires_at);
create table private.guest_rate_buckets(bucket text primary key, started_at timestamptz not null, attempts integer not null);
create index guest_rate_expiry_idx on private.guest_rate_buckets(started_at);
alter table private.guest_allowed_origins enable row level security;
alter table private.guest_invitations enable row level security;
alter table private.guest_sessions enable row level security;
alter table private.guest_rate_buckets enable row level security;
revoke all on private.guest_allowed_origins,private.guest_invitations,private.guest_sessions,private.guest_rate_buckets from public,anon,authenticated;

create function private.guest_secret() returns text language sql volatile set search_path='' as $$
 -- Trois UUID v4 fournissent 48 octets aléatoires (366 bits après les bits de format), condensés en 32 octets.
 select encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex');
$$;
create function private.guest_hash(value text) returns text language sql immutable set search_path='' as $$ select encode(sha256(convert_to(value,'UTF8')),'hex'); $$;
create function private.guest_rate(p_bucket text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare attempts_now integer;
begin
 delete from private.guest_rate_buckets where started_at<now()-interval '2 days';
 insert into private.guest_rate_buckets(bucket,started_at,attempts) values(p_bucket,clock_timestamp(),1)
 on conflict(bucket) do update set attempts=case when private.guest_rate_buckets.started_at<now()-make_interval(secs=>p_seconds) then 1 else private.guest_rate_buckets.attempts+1 end,
 started_at=case when private.guest_rate_buckets.started_at<now()-make_interval(secs=>p_seconds) then clock_timestamp() else private.guest_rate_buckets.started_at end returning attempts into attempts_now;
 return attempts_now<=p_limit;
end $$;
create function private.guest_view(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('title',m.title,'start_at',m.start_at,'status',m.status,'location',g.shared_location,'message',g.message,'expires_at',g.expires_at,
 'response_needs_refresh',g.answer<>'none' and g.responded_schedule_revision is distinct from m.schedule_revision,'response_state',g.response_state,'response_revision',g.response_revision,'display_name',g.display_name,'answer',g.answer,'availability',g.availability,
 'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'start_at',o.start_at,'end_at',o.end_at) order by o.start_at,o.id) from public.moment_date_options o where o.moment_id=m.id),'[]'::jsonb))
 from private.guest_invitations g join public.moments m on m.id=g.moment_id where g.id=p_id;
$$;
create or replace function private.confirmed_guest_places(p_moment_id uuid) returns integer language sql stable security definer set search_path='' as $$ select count(*)::integer from private.guest_invitations where moment_id=p_moment_id and response_state='confirmed'; $$;

create function private.guest_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); headers jsonb; request_origin text; client_hash text; invitation private.guest_invitations; guest_session private.guest_sessions; parent public.moments;
 target_id uuid; target_moment uuid; raw_secret text; raw_session text; expiry timestamptz; occupied integer; next_state text; new_name text; new_answer text; requested_availability jsonb; response_version integer;
begin
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb); request_origin:=headers->>'origin';
 if request_origin is null or not exists(select 1 from private.guest_allowed_origins o where o.origin=request_origin) then return jsonb_build_object('error','invitation_unavailable'); end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>16384 then return jsonb_build_object('error','invalid_response'); end if;
 client_hash:=private.guest_hash(coalesce(headers->>'x-forwarded-for','unknown'));
 if p_action in ('create','list','renew','revoke','confirm','decline') then
  if actor is null then return jsonb_build_object('error','invitation_unavailable'); end if;
  if not private.guest_rate('manager:'||actor::text,100,3600) then return jsonb_build_object('error','rate_limited'); end if;
  if p_action in ('create','list') then target_moment:=(p_data->>'moment_id')::uuid;
  else select moment_id into target_moment from private.guest_invitations where id=(p_data->>'id')::uuid and owner_id=actor; end if;
  -- Le même verrou protège membres, réponses externes et changements de capacité.
  select * into parent from public.moments where id=target_moment for update;
  if not found or not private.can_manage_moment(target_moment,actor) then return jsonb_build_object('error','invitation_unavailable'); end if;
  if p_action='list' then return jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'label',g.recipient_label,'expires_at',g.expires_at,'revoked',g.revoked_at is not null,'view',private.guest_view(g.id)) order by g.created_at desc) from private.guest_invitations g where g.moment_id=target_moment and g.owner_id=actor),'[]'::jsonb)); end if;
  if p_action='create' then
   if parent.status in ('DRAFT','CANCELLED','COMPLETED') or nullif(btrim(parent.title),'') is null or (parent.start_at is null and not exists(select 1 from public.moment_date_options where moment_id=target_moment)) then return jsonb_build_object('error','invalid_response'); end if;
   if p_data->>'label' is null or length(btrim(p_data->>'label')) not between 1 and 80 or length(coalesce(p_data->>'message',''))>2000 or jsonb_typeof(p_data->'share_location') is distinct from 'boolean' then return jsonb_build_object('error','invalid_response'); end if;
   target_id:=(p_data->>'id')::uuid; if target_id is null then return jsonb_build_object('error','invalid_response'); end if;
   if exists(select 1 from private.guest_invitations where id=target_id) then
    if exists(select 1 from private.guest_invitations where id=target_id and owner_id=actor and moment_id=target_moment) then return jsonb_build_object('id',target_id,'requires_renewal',true); end if;
    return jsonb_build_object('error','invitation_unavailable');
   end if;
   expiry:=least(coalesce((p_data->>'expires_at')::timestamptz,now()+interval '30 days'),now()+interval '30 days',coalesce(parent.end_at,parent.start_at,now()+interval '30 days')+interval '2 days');
   if expiry<=now() then return jsonb_build_object('error','invalid_response'); end if;
   raw_secret:=private.guest_secret();
   insert into private.guest_invitations(id,moment_id,owner_id,recipient_label,message,shared_location,secret_hash,expires_at) values(target_id,target_moment,actor,btrim(p_data->>'label'),coalesce(p_data->>'message',''),case when (p_data->>'share_location')::boolean then parent.location_name end,private.guest_hash(raw_secret),expiry);
   return jsonb_build_object('id',target_id,'secret',raw_secret,'view',private.guest_view(target_id));
  end if;
  select * into invitation from private.guest_invitations where id=(p_data->>'id')::uuid and owner_id=actor for update;
  if not found then return jsonb_build_object('error','invitation_unavailable'); end if;
  if p_action='renew' then
   if parent.status in ('DRAFT','CANCELLED','COMPLETED') then return jsonb_build_object('error','invitation_unavailable'); end if;
   raw_secret:=private.guest_secret();expiry:=least(now()+interval '30 days',coalesce(parent.end_at,parent.start_at,now()+interval '30 days')+interval '2 days');
   if expiry<=now() then return jsonb_build_object('error','invitation_unavailable'); end if;
   update private.guest_invitations set secret_hash=private.guest_hash(raw_secret),generation=generation+1,revoked_at=null,expires_at=expiry,updated_at=clock_timestamp() where id=invitation.id;
   delete from private.guest_sessions where invitation_id=invitation.id;
   return jsonb_build_object('id',invitation.id,'secret',raw_secret,'view',private.guest_view(invitation.id));
  elsif p_action='revoke' then
   update private.guest_invitations set revoked_at=clock_timestamp(),generation=generation+1,updated_at=clock_timestamp() where id=invitation.id;delete from private.guest_sessions where invitation_id=invitation.id;
   return jsonb_build_object('ok',true);
  end if;
  if p_action='confirm' then
   if parent.status in ('DRAFT','CANCELLED','COMPLETED') or invitation.answer<>'yes' or invitation.revoked_at is not null or invitation.expires_at<=now() then return jsonb_build_object('error','invalid_response'); end if;
   if invitation.responded_schedule_revision is distinct from parent.schedule_revision then return jsonb_build_object('error','response_conflict'); end if;
   if invitation.response_state='confirmed' then return jsonb_build_object('view',private.guest_view(invitation.id)); end if;
   if invitation.response_revision is distinct from (p_data->>'revision')::integer then return jsonb_build_object('error','response_conflict'); end if;
   select count(*) into occupied from public.moment_participants where moment_id=parent.id and invitation_status='ACCEPTED' and participation_status='REGISTERED';
   if parent.capacity is not null and occupied+private.confirmed_guest_places(parent.id)>=parent.capacity then return jsonb_build_object('error','capacity_full'); end if;
   next_state:='confirmed';
  else
   if invitation.response_revision is distinct from (p_data->>'revision')::integer then return jsonb_build_object('error','response_conflict'); end if;
   next_state:='declined';
  end if;
  update private.guest_invitations set response_state=next_state,response_revision=response_revision+1,response_history=response_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'action',p_action,'previous_state',response_state)),updated_at=clock_timestamp() where id=invitation.id;
  return jsonb_build_object('view',private.guest_view(invitation.id));
 end if;
 if p_action='exchange' then
  if not private.guest_rate('exchange-ip:'||client_hash,30,60) then return jsonb_build_object('error','rate_limited'); end if;
  if coalesce(p_data->>'secret','')!~'^[a-f0-9]{64}$' then return jsonb_build_object('error','invitation_unavailable'); end if;
  select * into invitation from private.guest_invitations where secret_hash=private.guest_hash(p_data->>'secret');
  if not found or invitation.revoked_at is not null or invitation.expires_at<=now() then return jsonb_build_object('error','invitation_unavailable'); end if;
  if not private.guest_rate('exchange-link:'||invitation.id::text,20,60) then return jsonb_build_object('error','rate_limited'); end if;
  raw_session:=private.guest_secret();delete from private.guest_sessions where expires_at<=now();
  insert into private.guest_sessions(secret_hash,invitation_id,generation,expires_at) values(private.guest_hash(raw_session),invitation.id,invitation.generation,least(invitation.expires_at,now()+interval '1 hour'));
  return jsonb_build_object('session',raw_session,'view',private.guest_view(invitation.id));
 end if;
 if p_action not in ('read','respond') then return jsonb_build_object('error','invitation_unavailable'); end if;
 if not private.guest_rate('session-ip:'||client_hash,120,60) then return jsonb_build_object('error','rate_limited'); end if;
 if coalesce(p_data->>'session','')!~'^[a-f0-9]{64}$' then return jsonb_build_object('error','invitation_unavailable'); end if;
 select * into guest_session from private.guest_sessions where secret_hash=private.guest_hash(p_data->>'session') and expires_at>now();
 if not found then return jsonb_build_object('error','invitation_unavailable'); end if;
 select moment_id into target_moment from private.guest_invitations where id=guest_session.invitation_id;
 select * into parent from public.moments where id=target_moment for update;
 select * into invitation from private.guest_invitations where id=guest_session.invitation_id for update;
 if not found or invitation.revoked_at is not null or invitation.expires_at<=now() or invitation.generation<>guest_session.generation then return jsonb_build_object('error','invitation_unavailable'); end if;
 if p_action='read' then return jsonb_build_object('view',private.guest_view(invitation.id)); end if;
 if not private.guest_rate('respond:'||invitation.id::text,30,600) then return jsonb_build_object('error','rate_limited'); end if;
 if parent.status in ('DRAFT','CANCELLED','COMPLETED') then return jsonb_build_object('error','invitation_unavailable'); end if;
 new_name:=btrim(p_data->>'name');new_answer:=p_data->>'answer';requested_availability:=p_data->'availability';response_version:=(p_data->>'revision')::integer;
 if new_name is null or length(new_name) not between 1 and 80 or new_answer is null or new_answer not in ('yes','maybe','no') or requested_availability is null or jsonb_typeof(requested_availability)<>'object' or (select count(*) from jsonb_object_keys(requested_availability))>20 then return jsonb_build_object('error','invalid_response'); end if;
 if exists(select 1 from jsonb_each_text(requested_availability) v where v.value not in ('yes','maybe','no') or not exists(select 1 from public.moment_date_options o where o.id::text=v.key and o.moment_id=parent.id)) then return jsonb_build_object('error','invalid_response'); end if;
 if invitation.display_name=new_name and invitation.answer=new_answer and invitation.availability=requested_availability and invitation.responded_schedule_revision=parent.schedule_revision then return jsonb_build_object('view',private.guest_view(invitation.id)); end if;
 if invitation.response_revision is distinct from response_version then return jsonb_build_object('error','response_conflict'); end if;
 update private.guest_invitations set display_name=new_name,answer=new_answer,availability=requested_availability,responded_schedule_revision=parent.schedule_revision,response_state='pending_validation',response_revision=response_revision+1,
 response_history=response_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'answer',answer,'availability',guest_invitations.availability,'display_name',display_name,'previous_state',response_state)),updated_at=clock_timestamp() where id=invitation.id;
 return jsonb_build_object('view',private.guest_view(invitation.id));
end $$;
revoke all on function private.guest_secret(),private.guest_hash(text),private.guest_rate(text,integer,integer),private.guest_view(uuid),private.confirmed_guest_places(uuid),private.guest_command(text,jsonb) from public,anon,authenticated;
grant usage on schema private to anon,authenticated;
grant execute on function private.guest_command(text,jsonb) to anon,authenticated;

create function public.create_guest_invitation(p_moment_id uuid,p_id uuid,p_label text,p_message text,p_share_location boolean,p_expires_at timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$ select private.guest_command('create',jsonb_build_object('moment_id',p_moment_id,'id',p_id,'label',p_label,'message',p_message,'share_location',p_share_location,'expires_at',p_expires_at)); $$;
create function public.manage_guest_invitation(p_action text,p_id uuid,p_revision integer default null) returns jsonb language sql security invoker set search_path='' as $$ select private.guest_command(case when p_action in ('renew','revoke','confirm','decline') then p_action else 'invalid' end,jsonb_build_object('id',p_id,'revision',p_revision)); $$;
create function public.list_guest_invitations(p_moment_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.guest_command('list',jsonb_build_object('moment_id',p_moment_id)); $$;
create function public.exchange_guest_invitation(p_secret text) returns jsonb language sql security invoker set search_path='' as $$ select private.guest_command('exchange',jsonb_build_object('secret',p_secret)); $$;
create function public.read_guest_invitation(p_session text) returns jsonb language sql security invoker set search_path='' as $$ select private.guest_command('read',jsonb_build_object('session',p_session)); $$;
create function public.respond_guest_invitation(p_session text,p_name text,p_answer text,p_availability jsonb,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select private.guest_command('respond',jsonb_build_object('session',p_session,'name',p_name,'answer',p_answer,'availability',p_availability,'revision',p_revision)); $$;
revoke all on function public.create_guest_invitation(uuid,uuid,text,text,boolean,timestamptz),public.manage_guest_invitation(text,uuid,integer),public.list_guest_invitations(uuid),public.exchange_guest_invitation(text),public.read_guest_invitation(text),public.respond_guest_invitation(text,text,text,jsonb,integer) from public,anon;
grant execute on function public.create_guest_invitation(uuid,uuid,text,text,boolean,timestamptz),public.manage_guest_invitation(text,uuid,integer),public.list_guest_invitations(uuid) to authenticated;
grant execute on function public.exchange_guest_invitation(text),public.read_guest_invitation(text),public.respond_guest_invitation(text,text,text,jsonb,integer) to anon,authenticated;

create function private.version_moment_schedule() returns trigger language plpgsql set search_path='' as $$
begin
 if new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at then new.schedule_revision:=old.schedule_revision+1; end if;
 return new;
end $$;
create trigger cdc_version_moment_schedule before update on public.moments for each row execute function private.version_moment_schedule();
create function private.invalidate_guest_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.schedule_revision is distinct from old.schedule_revision then
  update private.guest_invitations set response_state=case when answer='none' then 'unanswered' else 'pending_validation' end,response_revision=response_revision+1,
   response_history=response_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'action','schedule_changed','previous_state',response_state,'previous_schedule_revision',old.schedule_revision)),updated_at=clock_timestamp() where moment_id=new.id;
 end if;
 return new;
end $$;
create trigger cdc_invalidate_guest_schedule after update on public.moments for each row execute function private.invalidate_guest_schedule();
create function private.version_moment_options() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if tg_op='UPDATE' and new.start_at is not distinct from old.start_at and new.end_at is not distinct from old.end_at and new.moment_id is not distinct from old.moment_id then return new; end if;
 for target in select distinct value from unnest(array[case when tg_op<>'INSERT' then old.moment_id end,case when tg_op<>'DELETE' then new.moment_id end]) as affected(value) where value is not null order by value loop
  update public.moments set schedule_revision=schedule_revision+1 where id=target;
 end loop;
 return coalesce(new,old);
end $$;
create trigger cdc_version_moment_options after insert or update or delete on public.moment_date_options for each row execute function private.version_moment_options();
revoke all on function private.version_moment_schedule(),private.invalidate_guest_schedule(),private.version_moment_options() from public,anon,authenticated;
commit;
