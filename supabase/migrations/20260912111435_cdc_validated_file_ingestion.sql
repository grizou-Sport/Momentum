begin;
-- Bytes are validated by a trusted function before any final object is written.
-- No provider Storage metadata is modified directly. Legacy ownership stays valid.
create table private.file_uploads (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null, bucket text not null, resource_id uuid,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 path text not null, original_path text, mime text not null,
 state text not null default 'uploading' check(state in ('uploading','ready','failed')),
 lease uuid not null default gen_random_uuid(), leased_until timestamptz not null default now()+interval '5 minutes',
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id),unique(bucket,path)
);
create table private.validated_files (
 bucket text not null, path text not null, user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null, parent_bucket text, parent_path text,
 primary key(bucket,path),foreign key(user_id,operation_id) references private.file_uploads(user_id,operation_id) on delete cascade
);
create index validated_files_owner on private.validated_files(user_id);
create index validated_files_parent on private.validated_files(parent_bucket,parent_path) where parent_path is not null;
alter table private.file_uploads enable row level security;
alter table private.validated_files enable row level security;
revoke all on private.file_uploads,private.validated_files from public,anon,authenticated;

create function private.file_owner(p_bucket text,p_path text) returns text
language sql stable security definer set search_path='' as $$
 select coalesce((select user_id::text from private.validated_files where bucket=p_bucket and path=p_path),
 (select coalesce(nullif(owner_id,''),owner::text) from storage.objects where bucket_id=p_bucket and name=p_path));
$$;
revoke all on function private.file_owner(text,text) from public,anon,authenticated;
grant execute on function private.file_owner(text,text) to authenticated,service_role;

create policy "final files require server validation" on storage.objects as restrictive for insert to anon,authenticated
 with check(bucket_id not in ('activities','activity-media','moment-media','avatars','club-logos'));
create policy "validated final files cannot be overwritten" on storage.objects as restrictive for update to anon,authenticated
 using(bucket_id not in ('activities','activity-media','moment-media','avatars','club-logos'))
 with check(bucket_id not in ('activities','activity-media','moment-media','avatars','club-logos'));
-- Read/delete permissions still apply to the actual owner or shared resource.
create policy "validated authors delete moment media" on storage.objects for delete to authenticated
 using(bucket_id='moment-media' and private.file_owner(bucket_id,name)=(select auth.uid())::text);
-- SVG originals of safe club logos remain in the author's private folder.
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/svg+xml'] where id='activity-media';

create function private.begin_file_upload(p_user uuid,p_session uuid,p_operation uuid,p_bucket text,p_resource uuid,p_fingerprint text,p_extension text,p_original_extension text,p_mime text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item private.file_uploads%rowtype; object_id uuid:=gen_random_uuid(); object_path text; original_path text;
begin
 -- The same lock as account deletion closes the gap between authorization and registration.
 if p_user is null then raise exception 'upload_forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||p_user::text,0));
 if p_session is null or p_operation is null
  or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user)
  or exists(select 1 from private.account_deletions where user_id=p_user)
  or not exists(select 1 from auth.users where id=p_user)
 then raise exception 'upload_forbidden' using errcode='42501'; end if;
 if p_bucket not in ('activities','activity-media','moment-media','avatars','club-logos') or p_fingerprint !~ '^[a-f0-9]{64}$'
  or p_extension not in ('jpeg','png','webp','svg','fit','gpx')
  or p_original_extension is not null and p_original_extension not in ('jpeg','png','webp','svg')
 then raise exception 'invalid_upload' using errcode='22023'; end if;
 if p_bucket='moment-media' and not private.can_access_moment(p_resource,p_user)
  or p_bucket='club-logos' and not private.can_manage_club(p_resource,p_user)
  or p_bucket='activity-media' and not exists(select 1 from public.activities where id=p_resource and user_id=p_user)
  or p_bucket='avatars' and p_resource is distinct from p_user
 then raise exception 'upload_forbidden' using errcode='42501'; end if;
 select * into item from private.file_uploads where user_id=p_user and operation_id=p_operation for update;
 if found then
  if item.fingerprint<>p_fingerprint or item.bucket<>p_bucket or item.resource_id is distinct from p_resource then raise exception 'upload_conflict' using errcode='40001'; end if;
  if item.state='ready' and not private.storage_is_retired(item.bucket,item.path) then return to_jsonb(item)-'fingerprint'-'user_id'; end if;
  if item.state='uploading' and item.leased_until>now() then raise exception 'upload_in_progress' using errcode='40001'; end if;
  raise exception 'upload_retired' using errcode='23514';
 end if;
 -- A per-account cap bounds overlapping Storage writes; content decoding is separately bounded.
 if (select count(*) from private.file_uploads where user_id=p_user and state='uploading' and leased_until>now())>=3 then raise exception 'upload_in_progress' using errcode='40001'; end if;
 object_path:=case when p_bucket in ('moment-media','club-logos') then p_resource::text else p_user::text end||'/'||object_id::text||'.'||p_extension;
 if p_original_extension is not null then original_path:=p_user::text||'/shared-originals/'||object_id::text||'.'||p_original_extension; end if;
 insert into private.file_uploads(user_id,operation_id,bucket,resource_id,fingerprint,path,original_path,mime)
 values(p_user,p_operation,p_bucket,p_resource,p_fingerprint,object_path,original_path,p_mime) returning * into item;
 insert into private.validated_files(bucket,path,user_id,operation_id) values(p_bucket,object_path,p_user,p_operation);
 if original_path is not null then insert into private.validated_files(bucket,path,user_id,operation_id,parent_bucket,parent_path) values('activity-media',original_path,p_user,p_operation,p_bucket,object_path); end if;
 return to_jsonb(item)-'fingerprint'-'user_id';
end $$;
create function public.begin_file_upload(p_user uuid,p_session uuid,p_operation uuid,p_bucket text,p_resource uuid,p_fingerprint text,p_extension text,p_original_extension text,p_mime text)
returns jsonb language sql security invoker set search_path='' as $$select private.begin_file_upload(p_user,p_session,p_operation,p_bucket,p_resource,p_fingerprint,p_extension,p_original_extension,p_mime);$$;

create function private.finish_file_upload(p_user uuid,p_operation uuid,p_lease uuid,p_success boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item private.file_uploads%rowtype; object record; accepted boolean;
begin
 select * into item from private.file_uploads where user_id=p_user and operation_id=p_operation and lease=p_lease for update;
 if not found or item.state<>'uploading' then raise exception 'upload_conflict' using errcode='40001'; end if;
 accepted:=coalesce(p_success,false) and item.leased_until>now() and not exists(select 1 from private.account_deletions where user_id=p_user)
  and not exists(select 1 from private.validated_files f where f.user_id=p_user and f.operation_id=p_operation and not exists(select 1 from storage.objects o where o.bucket_id=f.bucket and o.name=f.path));
 update private.file_uploads set state=case when accepted then 'ready' else 'failed' end where user_id=p_user and operation_id=p_operation;
 if not accepted then
  for object in select bucket,path from private.validated_files where user_id=p_user and operation_id=p_operation loop
   perform private.enqueue_storage_cleanup(p_user,object.bucket,object.path);
   -- Leave time for a storage request with a lost response to finish before deleting it.
   update private.storage_cleanup set available_at=greatest(available_at,item.leased_until) where bucket=object.bucket and path=object.path and state='pending';
  end loop;
 end if;
 return jsonb_build_object('ready',accepted,'path',case when accepted then item.path end,'mime',item.mime);
end $$;
create function public.finish_file_upload(p_user uuid,p_operation uuid,p_lease uuid,p_success boolean) returns jsonb
language sql security invoker set search_path='' as $$select private.finish_file_upload(p_user,p_operation,p_lease,p_success);$$;
revoke all on function private.begin_file_upload(uuid,uuid,uuid,text,uuid,text,text,text,text),public.begin_file_upload(uuid,uuid,uuid,text,uuid,text,text,text,text),private.finish_file_upload(uuid,uuid,uuid,boolean),public.finish_file_upload(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.begin_file_upload(uuid,uuid,uuid,text,uuid,text,text,text,text),public.begin_file_upload(uuid,uuid,uuid,text,uuid,text,text,text,text),private.finish_file_upload(uuid,uuid,uuid,boolean),public.finish_file_upload(uuid,uuid,uuid,boolean) to service_role;

-- Explicitly registered loopback URLs let local provider tests use the same references.
-- No HTTP origin is registered by this production migration.
create or replace function private.storage_path(p_bucket text,p_reference text) returns text
language plpgsql stable security definer set search_path='' as $$
declare value text:=nullif(btrim(p_reference),''); reference_origin text;
begin
 if value is null then return null; end if;
 -- Only our own legacy public/signed URLs are storage references. Never follow external URLs.
 if value ~ '^https?://' then
  reference_origin:=substring(value from '^(https?://[^/]+)/storage/v1/object/(?:public|sign|authenticated)/');
  if reference_origin is null or not exists(select 1 from private.storage_origins where origin=reference_origin) then return null; end if;
  if reference_origin like 'http:%' and reference_origin not in ('http://127.0.0.1:54321','http://localhost:54321') then return null; end if;
  value:=regexp_replace(substr(value,length(reference_origin)+1),'^/storage/v1/object/(public|sign|authenticated)/','');
  if split_part(value,'/',1)<>p_bucket then return null; end if;
  value:=split_part(substr(value,length(p_bucket)+2),'?',1);
 end if;
 if length(value)>1024 or value ~ '(^/|//|(^|/)\.\.(/|$)|[\\%?#])' then raise exception 'Chemin de fichier non pris en charge' using errcode='23514'; end if;
 return value;
end $$;

-- Updated compatibility functions follow below. They preserve existing paths and authorizations.
create or replace function private.storage_referenced(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_bucket
 when 'activities' then exists(select 1 from public.activities where private.storage_path('activities',source_file_url)=p_path or private.storage_path('activities',gpx_url)=p_path)
 when 'activity-media' then exists(select 1 from public.activity_media where file_path=p_path) or exists(select 1 from private.validated_files f where f.bucket=p_bucket and f.path=p_path and f.parent_path is not null and private.storage_referenced(f.parent_bucket,f.parent_path))
 when 'moment-media' then exists(select 1 from public.moment_media where file_path=p_path)
 when 'avatars' then exists(select 1 from public.passports where private.storage_path('avatars',avatar_url)=p_path)
 when 'club-logos' then exists(select 1 from public.clubs where logo_url=p_path)
 else true end;
$$;

create or replace function private.enqueue_storage_cleanup(p_user uuid,p_bucket text,p_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare object_path text:=private.storage_path(p_bucket,p_reference); object_owner text;
begin
 if object_path is null then return; end if;
 -- Serialize association and retirement of the same object, including concurrent transactions.
 perform pg_advisory_xact_lock(hashtextextended(p_bucket||'/'||object_path,0));
 if private.storage_referenced(p_bucket,object_path) then return; end if;
 select private.file_owner(bucket_id,name) into object_owner from storage.objects where bucket_id=p_bucket and name=object_path;
 if p_user is null or (object_owner is not null and object_owner<>p_user::text)
  or (p_bucket in ('activities','activity-media','avatars') and split_part(object_path,'/',1)<>p_user::text)
  or (p_bucket in ('moment-media','club-logos') and object_owner is null and exists(select 1 from storage.objects where bucket_id=p_bucket and name=object_path))
 then raise exception 'Propriétaire du fichier non confirmé' using errcode='42501'; end if;
 insert into private.storage_cleanup(user_id,bucket,path) values(p_user,p_bucket,object_path) on conflict(bucket,path) do nothing;
end $$;

create or replace function private.protect_storage_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare value jsonb:=to_jsonb(new); reference_bucket text:=tg_argv[0]; field text; object_path text;
begin
 foreach field in array tg_argv[1:] loop
  object_path:=private.storage_path(reference_bucket,value->>field);
  if object_path is not null then
   if (reference_bucket in ('activities','activity-media','avatars') and split_part(object_path,'/',1) is distinct from value->>'user_id')
    or (reference_bucket='moment-media' and (split_part(object_path,'/',1) is distinct from value->>'moment_id' or not exists(select 1 from storage.objects where bucket_id=reference_bucket and name=object_path and private.file_owner(bucket_id,name)=value->>'user_id')))
   then raise exception 'Fichier non autorisé' using errcode='42501'; end if;
   perform pg_advisory_xact_lock(hashtextextended(reference_bucket||'/'||object_path,0));
   if exists(select 1 from private.storage_cleanup c where c.bucket=reference_bucket and c.path=object_path) then
    raise exception 'Ce fichier est en cours de suppression. Téléverse-le à nouveau.' using errcode='23514';
   end if;
  end if;
 end loop;
 return new;
end $$;

create or replace function private.discard_uploaded_file(p_bucket text,p_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); object_path text:=private.storage_path(p_bucket,p_path);
begin
 if actor is null or object_path is null or p_bucket not in ('activities','activity-media','moment-media','avatars','club-logos') then raise exception 'Fichier indisponible' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_bucket||'/'||object_path,0));
 if not exists(select 1 from storage.objects where bucket_id=p_bucket and name=object_path and private.file_owner(bucket_id,name)=actor::text)
  or private.storage_referenced(p_bucket,object_path) then raise exception 'Fichier indisponible ou encore utilisé' using errcode='42501'; end if;
 perform private.enqueue_storage_cleanup(actor,p_bucket,object_path);
 return jsonb_build_object('queued',true);
end $$;

create or replace function private.collect_orphan_uploads() returns integer
language plpgsql security definer set search_path='' as $$
declare item record; collected integer:=0;
begin
 for item in select f.user_id owner_id,f.bucket bucket_id,f.path name from private.validated_files f join private.file_uploads u using(user_id,operation_id) where u.state<>'ready' and u.leased_until<now() and not exists(select 1 from private.storage_cleanup c where c.bucket=f.bucket and c.path=f.path) limit 100 loop
  perform private.enqueue_storage_cleanup(item.owner_id,item.bucket_id,item.name); collected:=collected+1;
 end loop;
 for item in select o.bucket_id,o.name,private.file_owner(o.bucket_id,o.name)::uuid owner_id from storage.objects o
  where o.bucket_id in ('activities','activity-media','moment-media','avatars','club-logos')
  and o.created_at<now()-interval '24 hours'
  and private.file_owner(o.bucket_id,o.name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists(select 1 from private.storage_cleanup c where c.bucket=o.bucket_id and c.path=o.name)
  and not private.storage_referenced(o.bucket_id,o.name)
  order by o.created_at limit 100 loop
  perform private.enqueue_storage_cleanup(item.owner_id,item.bucket_id,item.name); collected:=collected+1;
 end loop;
 -- Expired export snapshots contain personal data and do not wait for the next export.
 delete from private.file_uploads u where u.created_at<now()-interval '7 days' and not exists(select 1 from private.validated_files f join storage.objects o on o.bucket_id=f.bucket and o.name=f.path where f.user_id=u.user_id and f.operation_id=u.operation_id);
 delete from private.personal_exports where expires_at<now();
 delete from private.storage_cleanup c where c.state='complete' and c.completed_at<now()-interval '7 days'
  and not exists(select 1 from private.account_deletions d where d.user_id=c.user_id and d.stage<>'complete');
 delete from private.account_deletions where stage='complete' and completed_at<now()-interval '7 days';
 return collected;
end $$;

create or replace function private.prepare_account_deletion() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
 return jsonb_build_object('activities',(select count(*) from public.activities where user_id=actor),
  'shared_moments',(select count(*) from public.moments where user_id=actor or created_by=actor),
  'clubs',(select count(*) from public.clubs where owner_id=actor),
  'files',(select count(*) from storage.objects where private.file_owner(bucket_id,name)=actor::text or (bucket_id in ('activities','activity-media','avatars') and split_part(name,'/',1)=actor::text)),
  'ready',exists(select 1 from private.cleanup_runtime where configured_at is not null and last_success_at>now()-interval '5 minutes'),
  'pending',exists(select 1 from private.account_deletions where user_id=actor));
end $$;

create or replace function private.purge_account_records(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare job private.account_deletions%rowtype; relation text; item record;
begin
 select * into job from private.account_deletions where id=p_id and lease=p_lease for update;
 if not found then return false; end if;
 if job.stage<>'queued' then return job.stage in ('files','identity','complete'); end if;
 -- Titles and dates already shared remain available, but private narrative, location copies and authorship do not.
 update public.moments set user_id=null,created_by=null,day_id=null,mission_id=null,story=null,emotion=null,
  description=null,location_name=null,latitude=null,longitude=null,location_id=null,cover_image_url=null,
  status=case when status='COMPLETED' then 'COMPLETED' else 'CANCELLED' end,organizer_deleted_at=now()
 where user_id=job.user_id or created_by=job.user_id;
 -- Preserve members and their permissions; no automatic promotion to owner.
 update public.clubs set owner_id=null,status='ARCHIVED',owner_deleted_at=now() where owner_id=job.user_id;
 update public.moment_date_options set created_by=null,location_name=null,location_id=null where created_by=job.user_id;
 -- Personal files can have references in a club edited by this person. Keep other members' files.
 update public.clubs c set logo_url=null where exists(select 1 from storage.objects o where o.bucket_id='club-logos' and o.name=c.logo_url and private.file_owner(o.bucket_id,o.name)=job.user_id::text);
 update public.clubs c set cover_image_url=null where exists(select 1 from storage.objects o where o.name=c.cover_image_url and private.file_owner(o.bucket_id,o.name)=job.user_id::text);
 delete from private.guest_invitations where owner_id=job.user_id;
 delete from private.personal_exports where user_id=job.user_id;
 delete from private.moment_operations where user_id=job.user_id;
 delete from private.shared_moment_operations where user_id=job.user_id;
 -- Parents last: foreign-key cascades and file-retirement triggers remain enabled.
 foreach relation in array array['activity_flow_assessments','activity_media','activity_timeline','moment_media','moment_availability','moment_participants','club_member_preferences','club_members','reactions','daily_wellbeing','user_locations','user_settings','user_sports','user_equipment','wellbeing_profile','user_sport_preferences','user_goals','user_load_estimates','onboarding_progress','circle_preferences','activities','user_missions','days','passports'] loop
  execute format('delete from public.%I where user_id=$1',relation) using job.user_id;
 end loop;
 delete from public.profiles where id=job.user_id;
 delete from public.nutrition_products p where created_by=job.user_id and not exists(select 1 from public.activity_nutrition_items n where n.product_id=p.id);
 update public.nutrition_products set created_by=null,is_active=false,owner_deleted_at=now() where created_by=job.user_id;
 delete from public.invitations where inviter_id=job.user_id or recipient_user_id=job.user_id or accepted_by=job.user_id;
 delete from public.connections where user_low_id=job.user_id or user_high_id=job.user_id;
 delete from public.circle_relationships where requester_id=job.user_id or recipient_id=job.user_id;
 delete from public.blocked_users where blocker_id=job.user_id or blocked_id=job.user_id;
 delete from public.moment_activities where added_by=job.user_id;
 delete from public.locations where owner_user_id=job.user_id;
 update public.locations set created_by=null where created_by=job.user_id;
 update public.club_members set invited_by=null where invited_by=job.user_id;
 -- Enumerate metadata before removing Auth. An unreferenced original upload is included immediately.
 for item in select bucket_id,name from storage.objects where private.file_owner(bucket_id,name)=job.user_id::text or (bucket_id in ('activities','activity-media','avatars') and split_part(name,'/',1)=job.user_id::text) loop
  if item.bucket_id not in ('activities','activity-media','moment-media','avatars','club-logos') then raise exception 'Unmapped storage bucket requires review' using errcode='55000'; end if;
  perform private.enqueue_storage_cleanup(job.user_id,item.bucket_id,item.name);
 end loop;
 -- An in-flight provider request may finish after the metadata enumeration above.
 for item in select f.bucket,f.path from private.validated_files f join private.file_uploads u using(user_id,operation_id) where f.user_id=job.user_id and u.state='uploading' loop
  perform private.enqueue_storage_cleanup(job.user_id,item.bucket,item.path);
 end loop;
 update private.storage_cleanup set available_at=greatest(available_at,(select max(leased_until) from private.file_uploads where user_id=job.user_id and state='uploading')) where user_id=job.user_id and state='pending';
 update private.account_deletions set stage='files',last_error=null where id=p_id;
 return true;
end $$;

create or replace function private.account_ready_for_identity(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare job private.account_deletions%rowtype;
begin
 select * into job from private.account_deletions where id=p_id and lease=p_lease for update;
 if not found or job.stage not in ('files','identity') then return false; end if;
 if exists(select 1 from private.file_uploads where user_id=job.user_id and state='uploading' and leased_until>now())
  or exists(select 1 from private.storage_cleanup where user_id=job.user_id and state<>'complete')
  or exists(select 1 from storage.objects where private.file_owner(bucket_id,name)=job.user_id::text or (bucket_id in ('activities','activity-media','avatars') and split_part(name,'/',1)=job.user_id::text)) then return false; end if;
 update private.account_deletions set stage='identity' where id=p_id;
 return true;
end $$;

create function private.retire_shared_original() returns trigger language plpgsql security definer set search_path='' as $$
declare f record;old_path text:=private.storage_path(tg_argv[0],to_jsonb(old)->>tg_argv[1]);
begin
 if tg_op='UPDATE' and old_path is not distinct from private.storage_path(tg_argv[0],to_jsonb(new)->>tg_argv[1]) then return new; end if;
 for f in select user_id,bucket,path from private.validated_files where parent_bucket=tg_argv[0] and parent_path=old_path loop
  perform private.enqueue_storage_cleanup(f.user_id,f.bucket,f.path);
 end loop;
 return coalesce(new,old);
end $$;
revoke all on function private.retire_shared_original() from public,anon,authenticated;
create trigger retire_shared_original after update of file_path or delete on public.moment_media for each row execute function private.retire_shared_original('moment-media','file_path');
create trigger retire_logo_original after update of logo_url or delete on public.clubs for each row execute function private.retire_shared_original('club-logos','logo_url');
create trigger retire_avatar_original after update of avatar_url or delete on public.passports for each row execute function private.retire_shared_original('avatars','avatar_url');
create or replace function private.begin_personal_export() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); job private.personal_exports%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,4));
  delete from private.personal_exports where user_id=actor and expires_at<=now();
  if (select count(*) from private.personal_exports where user_id=actor)>2 then raise exception 'Un export est déjà prêt. Réessaie après son expiration.' using errcode='54000'; end if;
  insert into private.personal_exports(user_id) values(actor) returning * into job;
  -- All source reads belong to this one SQL statement and therefore one MVCC snapshot.
  insert into private.personal_export_items(export_id,sequence,kind,payload)
    select job.id,row_number() over(order by kind,row_key),kind,payload from (
select 'activities'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'moment_id',t.moment_id,'sport',t.sport,'activity_type',t.activity_type,'status',t.status,'distance_km',t.distance_km,'duration_min',t.duration_min,'elevation_m',t.elevation_m,'avg_hr',t.avg_hr,'rpe',t.rpe,'gear',t.gear,'notes',t.notes,'gpx_url',t.gpx_url,'created_at',t.created_at,'sport_id',t.sport_id,'mission_id',t.mission_id,'activity_date',t.activity_date,'weather',t.weather,'location_name',t.location_name,'route_summary',t.route_summary,'activity_category',t.activity_category,'source_file_url',t.source_file_url,'source_file_type',t.source_file_type,'activity_time',t.activity_time,'location_id',t.location_id,'rpe_source',t.rpe_source,'duration_source',t.duration_source,'timer_duration_seconds',t.timer_duration_seconds,'elapsed_duration_seconds',t.elapsed_duration_seconds,'moving_duration_seconds',t.moving_duration_seconds,'source_instant',t.source_instant,'source_timezone',t.source_timezone,'source_hash',t.source_hash,'qualifiers',t.qualifiers,'is_memorable',t.is_memorable,'practice_variant',t.practice_variant,'revision',t.revision,'updated_at',t.updated_at,'nutrition_note',t.nutrition_note,'nutrition_elapsed_override_seconds',t.nutrition_elapsed_override_seconds)) payload from public.activities t where t.user_id=actor
union all
select 'activity_flow_assessments'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'activity_id',t.activity_id,'user_id',t.user_id,'perceived_challenge',t.perceived_challenge,'perceived_mastery',t.perceived_mastery,'analysis_context',t.analysis_context,'assessment_version',t.assessment_version,'created_at',t.created_at,'updated_at',t.updated_at,'retained_memory',t.retained_memory)) payload from public.activity_flow_assessments t where t.user_id=actor
union all
select 'activity_media'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'activity_id',t.activity_id,'user_id',t.user_id,'media_type',t.media_type,'file_path',t.file_path,'caption',t.caption,'created_at',t.created_at)) payload from public.activity_media t where t.user_id=actor
union all
select 'activity_timeline'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'activity_id',t.activity_id,'user_id',t.user_id,'position',t.position,'timestamp',t.timestamp,'elapsed_seconds',t.elapsed_seconds,'event_type',t.event_type,'metadata',t.metadata,'created_at',t.created_at)) payload from public.activity_timeline t where t.user_id=actor
union all
select 'daily_wellbeing'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'recorded_date',t.recorded_date,'sleep_hours',t.sleep_hours,'motivation',t.motivation,'resting_hr',t.resting_hr,'hrv_ms',t.hrv_ms,'sleep_quality_value',t.sleep_quality_value,'sleep_quality_unit',t.sleep_quality_unit,'source',t.source,'source_label',t.source_label,'raw_data',t.raw_data,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.daily_wellbeing t where t.user_id=actor
union all
select 'days'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'day_date',t.day_date,'title',t.title,'note',t.note,'mood',t.mood,'energy',t.energy,'sleep_hours',t.sleep_hours,'stress',t.stress,'soreness',t.soreness,'rest_hr',t.rest_hr,'hrv',t.hrv,'weight',t.weight,'weather',t.weather,'sunrise',t.sunrise,'sunset',t.sunset,'created_at',t.created_at,'context_annotations',t.context_annotations,'revision',t.revision)) payload from public.days t where t.user_id=actor
union all
select 'passports'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'display_name',t.display_name,'country',t.country,'city',t.city,'quote',t.quote,'avatar_url',t.avatar_url,'height_cm',t.height_cm,'weight_kg',t.weight_kg,'birth_year',t.birth_year,'created_at',t.created_at,'updated_at',t.updated_at,'birth_date',t.birth_date,'sex',t.sex,'sport_level',t.sport_level,'habits',t.habits,'objectives',t.objectives,'connected_sources',t.connected_sources,'personalization',t.personalization)) payload from public.passports t where t.user_id=actor
union all
select 'user_settings'::text kind,t.user_id::text row_key,private.export_redact(jsonb_build_object('user_id',t.user_id,'units',t.units,'language',t.language,'theme',t.theme,'notifications',t.notifications,'created_at',t.created_at,'updated_at',t.updated_at,'experience_preferences',t.experience_preferences)) payload from public.user_settings t where t.user_id=actor
union all
select 'user_sports'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'sport_id',t.sport_id,'role',t.role,'active',t.active,'created_at',t.created_at)) payload from public.user_sports t where t.user_id=actor
union all
select 'user_equipment'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'category_id',t.category_id,'name',t.name,'brand',t.brand,'model',t.model,'description',t.description,'photo_url',t.photo_url,'purchase_date',t.purchase_date,'first_used_at',t.first_used_at,'retired_at',t.retired_at,'active',t.active,'notes',t.notes,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.user_equipment t where t.user_id=actor
union all
select 'wellbeing_profile'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'max_hr',t.max_hr,'resting_hr',t.resting_hr,'vo2max',t.vo2max,'preferred_sleep_hours',t.preferred_sleep_hours,'notes',t.notes,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.wellbeing_profile t where t.user_id=actor
union all
select 'user_locations'::text kind,t.user_id::text row_key,private.export_redact(jsonb_build_object('user_id',t.user_id,'city',t.city,'country',t.country,'latitude',t.latitude,'longitude',t.longitude,'timezone',t.timezone,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.user_locations t where t.user_id=actor
union all
select 'user_missions'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'category',t.category,'subcategory',t.subcategory,'title',t.title,'description',t.description,'sport',t.sport,'distance_km',t.distance_km,'target_time_seconds',t.target_time_seconds,'target_pace_seconds_per_km',t.target_pace_seconds_per_km,'target_date',t.target_date,'status',t.status,'story_note',t.story_note,'result_note',t.result_note,'created_at',t.created_at,'updated_at',t.updated_at,'moved_to_history_at',t.moved_to_history_at,'duration_days',t.duration_days)) payload from public.user_missions t where t.user_id=actor
union all
select 'user_sport_preferences'::text kind,t.user_id::text row_key,private.export_redact(jsonb_build_object('user_id',t.user_id,'experience_code',t.experience_code,'weekly_hours_range',t.weekly_hours_range,'events',t.events,'watch_provider',t.watch_provider,'preferences',t.preferences,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.user_sport_preferences t where t.user_id=actor
union all
select 'user_goals'::text kind,t.user_id::text row_key,private.export_redact(jsonb_build_object('user_id',t.user_id,'primary_goal',t.primary_goal,'status',t.status,'details',t.details,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.user_goals t where t.user_id=actor
union all
select 'user_load_estimates'::text kind,t.user_id::text row_key,private.export_redact(jsonb_build_object('user_id',t.user_id,'chronic_load',t.chronic_load,'weekly_hours',t.weekly_hours,'experience_level',t.experience_level,'sport_distribution',t.sport_distribution,'confidence',t.confidence,'source',t.source,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.user_load_estimates t where t.user_id=actor
union all
select 'onboarding_progress'::text kind,t.user_id::text row_key,private.export_redact(jsonb_build_object('user_id',t.user_id,'current_step',t.current_step,'answers',t.answers,'completed_at',t.completed_at,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.onboarding_progress t where t.user_id=actor
union all
select 'moment_media'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'moment_id',t.moment_id,'user_id',t.user_id,'media_type',t.media_type,'file_path',t.file_path,'caption',t.caption,'taken_at',t.taken_at,'created_at',t.created_at)) payload from public.moment_media t where t.user_id=actor
union all
select 'moment_participants'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'moment_id',t.moment_id,'user_id',t.user_id,'role',t.role,'invitation_status',t.invitation_status,'participation_status',t.participation_status,'created_at',t.created_at,'updated_at',t.updated_at,'confirmed_schedule_revision',t.confirmed_schedule_revision)) payload from public.moment_participants t where t.user_id=actor and private.can_access_moment(t.moment_id,actor)
union all
select 'moment_availability'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'date_option_id',t.date_option_id,'user_id',t.user_id,'availability_status',t.availability_status,'updated_at',t.updated_at)) payload from public.moment_availability t where t.user_id=actor
union all
select 'club_member_preferences'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'club_id',t.club_id,'user_id',t.user_id,'notifications_enabled',t.notifications_enabled,'is_pinned',t.is_pinned,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.club_member_preferences t where t.user_id=actor
union all
select 'club_members'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'club_id',t.club_id,'user_id',t.user_id,'invited_by',t.invited_by,'role',t.role,'membership_status',t.membership_status,'joined_at',t.joined_at,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.club_members t where t.user_id=actor
union all
select 'circle_preferences'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'circle_member_id',t.circle_member_id,'is_pinned',t.is_pinned,'notifications_enabled',t.notifications_enabled,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.circle_preferences t where t.user_id=actor
union all
select 'reactions'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'moment_id',t.moment_id,'user_id',t.user_id,'reaction_type',t.reaction_type,'preset_message_id',t.preset_message_id,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.reactions t where t.user_id=actor
union all
select 'profiles'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'email',t.email,'first_name',t.first_name,'last_name',t.last_name,'display_name',t.display_name,'avatar_url',t.avatar_url,'created_at',t.created_at,'updated_at',t.updated_at,'circle_discoverable',t.circle_discoverable)) payload from public.profiles t where t.id=actor
union all
select 'nutrition_products'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'name',t.name,'brand',t.brand,'category',t.category,'unit_label',t.unit_label,'serving_size',t.serving_size,'serving_volume_ml',t.serving_volume_ml,'carbohydrates_g',t.carbohydrates_g,'sodium_mg',t.sodium_mg,'caffeine_mg',t.caffeine_mg,'potassium_mg',t.potassium_mg,'magnesium_mg',t.magnesium_mg,'calcium_mg',t.calcium_mg,'bicarbonate_mg',t.bicarbonate_mg,'zinc_mg',t.zinc_mg,'extra_nutrients',t.extra_nutrients,'is_approximate',t.is_approximate,'source_url',t.source_url,'is_global',t.is_global,'created_by',t.created_by,'is_active',t.is_active,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.nutrition_products t where t.created_by=actor
union all
select 'moments'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_id',t.user_id,'day_id',t.day_id,'mission_id',t.mission_id,'title',t.title,'story',t.story,'emotion',t.emotion,'location_name',t.location_name,'latitude',t.latitude,'longitude',t.longitude,'visibility',t.visibility,'created_at',t.created_at,'created_by',t.created_by,'club_id',t.club_id,'description',t.description,'moment_type',t.moment_type,'status',t.status,'start_at',t.start_at,'end_at',t.end_at,'cover_image_url',t.cover_image_url,'capacity',t.capacity,'updated_at',t.updated_at,'location_id',t.location_id,'revision',t.revision,'schedule_revision',t.schedule_revision)) payload from public.moments t where t.created_by=actor
union all
select 'clubs'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'owner_id',t.owner_id,'name',t.name,'slug',t.slug,'description',t.description,'category',t.category,'location_name',t.location_name,'logo_url',t.logo_url,'cover_image_url',t.cover_image_url,'visibility',t.visibility,'status',t.status,'created_at',t.created_at,'updated_at',t.updated_at,'default_location_id',t.default_location_id)) payload from public.clubs t where t.owner_id=actor
union all
select 'invitations'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'inviter_id',t.inviter_id,'recipient_user_id',t.recipient_user_id,'recipient_email',t.recipient_email,'recipient_phone',t.recipient_phone,'target_type',t.target_type,'target_id',t.target_id,'channel',t.channel,'status',t.status,'expires_at',t.expires_at,'accepted_by',t.accepted_by,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.invitations t where t.inviter_id=actor or t.recipient_user_id=actor
union all
select 'circle_relationships'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'requester_id',t.requester_id,'recipient_id',t.recipient_id,'status',t.status,'created_at',t.created_at,'accepted_at',t.accepted_at)) payload from public.circle_relationships t where t.requester_id=actor or t.recipient_id=actor
union all
select 'connections'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'user_low_id',t.user_low_id,'user_high_id',t.user_high_id,'status',t.status,'created_from_invitation_id',t.created_from_invitation_id,'created_at',t.created_at,'updated_at',t.updated_at,'ended_at',t.ended_at)) payload from public.connections t where t.user_low_id=actor or t.user_high_id=actor
union all
select 'blocked_users'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'blocker_id',t.blocker_id,'blocked_id',t.blocked_id,'created_at',t.created_at)) payload from public.blocked_users t where t.blocker_id=actor
union all
select 'activity_equipment'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'activity_id',t.activity_id,'equipment_id',t.equipment_id,'created_at',t.created_at)) payload from public.activity_equipment t where exists(select from public.activities a where a.id=t.activity_id and a.user_id=actor)
union all
select 'activity_nutrition_items'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'activity_id',t.activity_id,'product_id',t.product_id,'quantity',t.quantity,'product_name_snapshot',t.product_name_snapshot,'brand_snapshot',t.brand_snapshot,'unit_label_snapshot',t.unit_label_snapshot,'carbohydrates_g_snapshot',t.carbohydrates_g_snapshot,'sodium_mg_snapshot',t.sodium_mg_snapshot,'caffeine_mg_snapshot',t.caffeine_mg_snapshot,'potassium_mg_snapshot',t.potassium_mg_snapshot,'magnesium_mg_snapshot',t.magnesium_mg_snapshot,'calcium_mg_snapshot',t.calcium_mg_snapshot,'bicarbonate_mg_snapshot',t.bicarbonate_mg_snapshot,'zinc_mg_snapshot',t.zinc_mg_snapshot,'extra_nutrients_snapshot',t.extra_nutrients_snapshot,'is_approximate_snapshot',t.is_approximate_snapshot,'created_at',t.created_at,'updated_at',t.updated_at,'phase',t.phase,'snapshot_origin',t.snapshot_origin,'serving_size_snapshot',t.serving_size_snapshot,'serving_volume_ml_snapshot',t.serving_volume_ml_snapshot)) payload from public.activity_nutrition_items t where exists(select from public.activities a where a.id=t.activity_id and a.user_id=actor)
union all
select 'moment_date_options'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'moment_id',t.moment_id,'start_at',t.start_at,'end_at',t.end_at,'location_name',t.location_name,'created_by',t.created_by,'is_selected',t.is_selected,'created_at',t.created_at,'location_id',t.location_id)) payload from public.moment_date_options t where exists(select from public.moments m where m.id=t.moment_id and m.created_by=actor)
union all
select 'moment_activities'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'moment_id',t.moment_id,'activity_id',t.activity_id,'added_by',t.added_by,'created_at',t.created_at)) payload from public.moment_activities t where exists(select from public.activities a where a.id=t.activity_id and a.user_id=actor)
union all
select 'locations'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'name',t.name,'address',t.address,'postal_code',t.postal_code,'city',t.city,'country',t.country,'country_code',t.country_code,'latitude',t.latitude,'longitude',t.longitude,'source',t.source,'provider_place_id',t.provider_place_id,'visibility',t.visibility,'owner_user_id',t.owner_user_id,'created_by',t.created_by,'created_at',t.created_at,'updated_at',t.updated_at)) payload from public.locations t where t.owner_user_id=actor or t.created_by=actor

union all
select 'guest_invitations'::text kind,t.id::text row_key,private.export_redact(jsonb_build_object('id',t.id,'moment_id',t.moment_id,'owner_id',t.owner_id,'response_id',t.response_id,'recipient_label',t.recipient_label,'message',t.message,'shared_location',t.shared_location,'share_location',t.share_location,'responded_schedule_revision',t.responded_schedule_revision,'expires_at',t.expires_at,'revoked_at',t.revoked_at,'display_name',t.display_name,'answer',t.answer,'availability',t.availability,'response_revision',t.response_revision,'response_state',t.response_state,'response_history',t.response_history,'created_at',t.created_at,'updated_at',t.updated_at)) payload from private.guest_invitations t where t.owner_id=actor
union all
select 'media_originals'::text kind,f.path row_key,jsonb_build_object('file_path',f.path,'shared_bucket',f.parent_bucket,'shared_path',f.parent_path) payload from private.validated_files f where f.user_id=actor and f.parent_path is not null and private.storage_referenced(f.parent_bucket,f.parent_path)
    ) snapshot_rows;
  update private.personal_exports set total=(select count(*) from private.personal_export_items where export_id=job.id),
    counts=(select coalesce(jsonb_object_agg(kind,n),'{}') from (select kind,count(*) n from private.personal_export_items where export_id=job.id group by kind) c)
    where id=job.id returning * into job;
  return jsonb_build_object('export_id',job.id,'schema_version',1,'created_at',job.created_at,'expires_at',job.expires_at,'total',job.total,'counts',job.counts,'timezone','Europe/Zurich');
end;
$$;
commit;
