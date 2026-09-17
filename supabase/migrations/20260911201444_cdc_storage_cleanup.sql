begin;
-- Business deletion and its cleanup receipt commit together. No SQL deletes storage.objects.
create table private.storage_origins(origin text primary key);
insert into private.storage_origins values('https://njcqcpyiiibudlalnzoa.supabase.co');
alter table private.storage_origins enable row level security;
revoke all on private.storage_origins from public,anon,authenticated;
create table private.storage_cleanup (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 bucket text not null check(bucket in ('activities','activity-media','moment-media','avatars','club-logos')),
 path text not null, state text not null default 'pending' check(state in ('pending','leased','complete')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease uuid, leased_until timestamptz, last_error text,
 created_at timestamptz not null default now(), completed_at timestamptz,
 unique(bucket,path)
);
alter table private.storage_cleanup enable row level security;
revoke all on private.storage_cleanup from public,anon,authenticated;
create index storage_cleanup_due on private.storage_cleanup(available_at) where state<>'complete';
create index storage_cleanup_owner on private.storage_cleanup(user_id,state);

create function private.storage_path(p_bucket text,p_reference text) returns text
language plpgsql stable security definer set search_path='' as $$
declare value text:=nullif(btrim(p_reference),''); reference_origin text;
begin
 if value is null then return null; end if;
 -- Only our own legacy public/signed URLs are storage references. Never follow external URLs.
 if value ~ '^https?://' then
  reference_origin:=substring(value from '^(https://[^/]+)/storage/v1/object/(?:public|sign|authenticated)/');
  if reference_origin is null or not exists(select 1 from private.storage_origins where origin=reference_origin) then return null; end if;
  value:=regexp_replace(substr(value,length(reference_origin)+1),'^/storage/v1/object/(public|sign|authenticated)/','');
  if split_part(value,'/',1)<>p_bucket then return null; end if;
  value:=split_part(substr(value,length(p_bucket)+2),'?',1);
 end if;
 if length(value)>1024 or value ~ '(^/|//|(^|/)\.\.(/|$)|[\\%?#])' then raise exception 'Chemin de fichier non pris en charge' using errcode='23514'; end if;
 return value;
end $$;

create function private.storage_referenced(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_bucket
 when 'activities' then exists(select 1 from public.activities where private.storage_path('activities',source_file_url)=p_path or private.storage_path('activities',gpx_url)=p_path)
 when 'activity-media' then exists(select 1 from public.activity_media where file_path=p_path)
 when 'moment-media' then exists(select 1 from public.moment_media where file_path=p_path)
 when 'avatars' then exists(select 1 from public.passports where private.storage_path('avatars',avatar_url)=p_path)
 when 'club-logos' then exists(select 1 from public.clubs where logo_url=p_path)
 else true end;
$$;

create function private.enqueue_storage_cleanup(p_user uuid,p_bucket text,p_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare object_path text:=private.storage_path(p_bucket,p_reference); object_owner text;
begin
 if object_path is null then return; end if;
 -- Serialize association and retirement of the same object, including concurrent transactions.
 perform pg_advisory_xact_lock(hashtextextended(p_bucket||'/'||object_path,0));
 if private.storage_referenced(p_bucket,object_path) then return; end if;
 select coalesce(nullif(owner_id,''),owner::text) into object_owner from storage.objects where bucket_id=p_bucket and name=object_path;
 if p_user is null or (object_owner is not null and object_owner<>p_user::text)
  or (p_bucket in ('activities','activity-media','avatars') and split_part(object_path,'/',1)<>p_user::text)
  or (p_bucket in ('moment-media','club-logos') and object_owner is null and exists(select 1 from storage.objects where bucket_id=p_bucket and name=object_path))
 then raise exception 'Propriétaire du fichier non confirmé' using errcode='42501'; end if;
 insert into private.storage_cleanup(user_id,bucket,path) values(p_user,p_bucket,object_path) on conflict(bucket,path) do nothing;
end $$;

create function private.retire_storage_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_row jsonb:=to_jsonb(old); new_row jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 bucket text:=tg_argv[0]; owner_column text:=tg_argv[1]; field text;
begin
 foreach field in array tg_argv[2:] loop
  if nullif(old_row->>field,'') is not null and (old_row->>field) is distinct from (new_row->>field) then
   perform private.enqueue_storage_cleanup((old_row->>owner_column)::uuid,bucket,old_row->>field);
  end if;
 end loop;
 return coalesce(new,old);
end $$;
create function private.protect_storage_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare value jsonb:=to_jsonb(new); reference_bucket text:=tg_argv[0]; field text; object_path text;
begin
 foreach field in array tg_argv[1:] loop
  object_path:=private.storage_path(reference_bucket,value->>field);
  if object_path is not null then
   if (reference_bucket in ('activities','activity-media','avatars') and split_part(object_path,'/',1) is distinct from value->>'user_id')
    or (reference_bucket='moment-media' and (split_part(object_path,'/',1) is distinct from value->>'moment_id' or not exists(select 1 from storage.objects where bucket_id=reference_bucket and name=object_path and coalesce(nullif(owner_id,''),owner::text)=value->>'user_id')))
   then raise exception 'Fichier non autorisé' using errcode='42501'; end if;
   perform pg_advisory_xact_lock(hashtextextended(reference_bucket||'/'||object_path,0));
   if exists(select 1 from private.storage_cleanup c where c.bucket=reference_bucket and c.path=object_path) then
    raise exception 'Ce fichier est en cours de suppression. Téléverse-le à nouveau.' using errcode='23514';
   end if;
  end if;
 end loop;
 return new;
end $$;

create trigger retire_activity_sources after update of source_file_url,gpx_url or delete on public.activities for each row execute function private.retire_storage_reference('activities','user_id','source_file_url','gpx_url');
create trigger protect_activity_sources before insert or update of source_file_url,gpx_url on public.activities for each row execute function private.protect_storage_reference('activities','source_file_url','gpx_url');
create trigger retire_activity_photos after update of file_path or delete on public.activity_media for each row execute function private.retire_storage_reference('activity-media','user_id','file_path');
create trigger protect_activity_photos before insert or update of file_path on public.activity_media for each row execute function private.protect_storage_reference('activity-media','file_path');
create trigger retire_moment_photos after update of file_path or delete on public.moment_media for each row execute function private.retire_storage_reference('moment-media','user_id','file_path');
create trigger protect_moment_photos before insert or update of file_path on public.moment_media for each row execute function private.protect_storage_reference('moment-media','file_path');
create trigger retire_avatar after update of avatar_url or delete on public.passports for each row execute function private.retire_storage_reference('avatars','user_id','avatar_url');
create trigger protect_avatar before insert or update of avatar_url on public.passports for each row execute function private.protect_storage_reference('avatars','avatar_url');

create function private.storage_is_retired(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$select exists(select 1 from private.storage_cleanup where bucket=p_bucket and path=p_path);$$;
-- Restrictive policies add to existing ownership policies. Signed URLs already issued expire normally.
create policy "retired objects cannot be read" on storage.objects as restrictive for select to authenticated using(not private.storage_is_retired(bucket_id,name));
create policy "retired paths cannot be uploaded" on storage.objects as restrictive for insert to authenticated with check(not private.storage_is_retired(bucket_id,name));
create policy "retired objects cannot be replaced" on storage.objects as restrictive for update to authenticated using(not private.storage_is_retired(bucket_id,name)) with check(not private.storage_is_retired(bucket_id,name));

create function private.delete_personal_activity(p_id uuid,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item public.activities%rowtype; pending integer;
begin
 if actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
 select * into item from public.activities where id=p_id for update;
 if not found then return jsonb_build_object('deleted',true,'pending_files',(select count(*) from private.storage_cleanup where user_id=actor and state<>'complete')); end if;
 if item.user_id<>actor then raise exception 'Moment indisponible' using errcode='42501'; end if;
 if p_expected_revision is null or item.revision<>p_expected_revision then raise exception 'Moment modifié ailleurs. Rouvre-le avant suppression.' using errcode='40001'; end if;
 delete from public.activities where id=p_id;
 select count(*) into pending from private.storage_cleanup where user_id=actor and state<>'complete';
 return jsonb_build_object('deleted',true,'pending_files',pending);
end $$;
create function public.delete_personal_activity(p_id uuid,p_expected_revision bigint) returns jsonb language sql security invoker set search_path='' as $$select private.delete_personal_activity(p_id,p_expected_revision);$$;

create function private.discard_uploaded_file(p_bucket text,p_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); object_path text:=private.storage_path(p_bucket,p_path);
begin
 if actor is null or object_path is null or p_bucket not in ('activities','activity-media','moment-media','avatars') then raise exception 'Fichier indisponible' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_bucket||'/'||object_path,0));
 if not exists(select 1 from storage.objects where bucket_id=p_bucket and name=object_path and coalesce(nullif(owner_id,''),owner::text)=actor::text)
  or private.storage_referenced(p_bucket,object_path) then raise exception 'Fichier indisponible ou encore utilisé' using errcode='42501'; end if;
 perform private.enqueue_storage_cleanup(actor,p_bucket,object_path);
 return jsonb_build_object('queued',true);
end $$;
create function public.discard_uploaded_file(p_bucket text,p_path text) returns jsonb language sql security invoker set search_path='' as $$select private.discard_uploaded_file(p_bucket,p_path);$$;

create function private.claim_storage_cleanup(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item private.storage_cleanup%rowtype; result jsonb:='[]'; lease_id uuid;
begin
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid batch' using errcode='22023'; end if;
 for item in select * from private.storage_cleanup where (state='pending' and available_at<=now()) or (state='leased' and leased_until<=now()) order by available_at,id for update skip locked limit p_limit loop
  if private.storage_referenced(item.bucket,item.path) then
   update private.storage_cleanup set state='pending',available_at=now()+interval '1 hour',last_error='still_referenced',lease=null,leased_until=null where id=item.id;
  else
   lease_id:=gen_random_uuid();
   update private.storage_cleanup set state='leased',lease=lease_id,leased_until=now()+interval '5 minutes',attempts=attempts+1 where id=item.id;
   result:=result||jsonb_build_array(jsonb_build_object('id',item.id,'bucket',item.bucket,'path',item.path,'lease',lease_id));
  end if;
 end loop;
 return result;
end $$;
create function public.claim_storage_cleanup(p_limit integer default 20) returns jsonb language sql security invoker set search_path='' as $$select private.claim_storage_cleanup(p_limit);$$;
create function private.finish_storage_cleanup(p_id uuid,p_lease uuid,p_success boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_success is null then raise exception 'Result required' using errcode='22023'; end if;
 update private.storage_cleanup set state=case when p_success then 'complete' else 'pending' end,
  completed_at=case when p_success then now() end,
  available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,8))::integer*10)),
  last_error=case when p_success then null else 'storage_request_failed' end,lease=null,leased_until=null
 where id=p_id and lease=p_lease and state='leased';
 return found;
end $$;
create function public.finish_storage_cleanup(p_id uuid,p_lease uuid,p_success boolean) returns boolean language sql security invoker set search_path='' as $$select private.finish_storage_cleanup(p_id,p_lease,p_success);$$;

create function private.collect_orphan_uploads() returns integer
language plpgsql security definer set search_path='' as $$
declare item record; collected integer:=0;
begin
 for item in select o.bucket_id,o.name,coalesce(nullif(o.owner_id,''),o.owner::text)::uuid owner_id from storage.objects o
  where o.bucket_id in ('activities','activity-media','moment-media','avatars','club-logos')
  and o.created_at<now()-interval '24 hours'
  and coalesce(nullif(o.owner_id,''),o.owner::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists(select 1 from private.storage_cleanup c where c.bucket=o.bucket_id and c.path=o.name)
  and not private.storage_referenced(o.bucket_id,o.name)
  order by o.created_at limit 100 loop
  perform private.enqueue_storage_cleanup(item.owner_id,item.bucket_id,item.name); collected:=collected+1;
 end loop;
 -- Expired export snapshots contain personal data and do not wait for the next export.
 delete from private.personal_exports where expires_at<now();
 delete from private.storage_cleanup c where c.state='complete' and c.completed_at<now()-interval '7 days'
  and not exists(select 1 from private.account_deletions d where d.user_id=c.user_id and d.stage<>'complete');
 delete from private.account_deletions where stage='complete' and completed_at<now()-interval '7 days';
 return collected;
end $$;
create function public.collect_orphan_uploads() returns integer language sql security invoker set search_path='' as $$select private.collect_orphan_uploads();$$;

revoke all on function private.storage_path(text,text),private.storage_referenced(text,text),private.enqueue_storage_cleanup(uuid,text,text),private.retire_storage_reference(),private.protect_storage_reference(),private.storage_is_retired(text,text),private.delete_personal_activity(uuid,bigint),public.delete_personal_activity(uuid,bigint),private.discard_uploaded_file(text,text),public.discard_uploaded_file(text,text),private.claim_storage_cleanup(integer),public.claim_storage_cleanup(integer),private.finish_storage_cleanup(uuid,uuid,boolean),public.finish_storage_cleanup(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.storage_is_retired(text,text),private.delete_personal_activity(uuid,bigint),public.delete_personal_activity(uuid,bigint),private.discard_uploaded_file(text,text),public.discard_uploaded_file(text,text) to authenticated;
grant usage on schema private to service_role;
grant execute on function private.claim_storage_cleanup(integer),public.claim_storage_cleanup(integer),private.finish_storage_cleanup(uuid,uuid,boolean),public.finish_storage_cleanup(uuid,uuid,boolean) to service_role;
revoke all on function private.collect_orphan_uploads(),public.collect_orphan_uploads() from public,anon,authenticated;
grant execute on function private.collect_orphan_uploads(),public.collect_orphan_uploads() to service_role;
commit;
