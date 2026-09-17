begin;
create table private.account_deletions(
 id uuid primary key,user_id uuid not null unique,receipt_hash text not null,
 stage text not null default 'queued' check(stage in ('queued','files','identity','complete')),
 requested_at timestamptz not null default now(),completed_at timestamptz,
 lease uuid,leased_until timestamptz,attempts integer not null default 0,
 available_at timestamptz not null default now(),last_error text
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated;

-- These shared records survive their creator. Existing participants keep their own records and roles.
alter table public.moments alter column user_id drop not null,alter column created_by drop not null;
alter table public.moments drop constraint if exists moments_user_id_fkey,drop constraint if exists moments_created_by_fkey;
alter table public.moments add constraint moments_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null,
 add constraint moments_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;
alter table public.moments add column organizer_deleted_at timestamptz;
alter table public.clubs alter column owner_id drop not null;
alter table public.clubs drop constraint if exists clubs_owner_id_fkey;
alter table public.clubs add constraint clubs_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete set null;
alter table public.clubs add column owner_deleted_at timestamptz;
alter table public.moment_date_options alter column created_by drop not null;
alter table public.moment_date_options drop constraint if exists moment_date_options_created_by_fkey;
alter table public.moment_date_options add constraint moment_date_options_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;
alter table public.locations alter column created_by drop not null;
alter table public.locations drop constraint if exists locations_created_by_fkey;
alter table public.locations add constraint locations_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;

-- A historical snapshot used by someone else must survive deletion of a private catalogue owner.
alter table public.nutrition_products add column owner_deleted_at timestamptz;
alter table public.nutrition_products drop constraint nutrition_products_check;
alter table public.nutrition_products add constraint nutrition_products_ownership check(
 (is_global and created_by is null) or (not is_global and created_by is not null)
 or (not is_global and created_by is null and not is_active and owner_deleted_at is not null));
alter table public.nutrition_products drop constraint nutrition_products_created_by_fkey;
alter table public.nutrition_products add constraint nutrition_products_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;

create function private.account_writable() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or not exists(select 1 from private.account_deletions where user_id=auth.uid());
$$;
create function private.enforce_account_writable() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.account_writable() then raise exception 'Suppression du compte en cours. Les nouvelles modifications sont suspendues.' using errcode='42501'; end if;
 return coalesce(new,old);
end $$;
do $$declare relation record;begin
 for relation in select tablename from pg_catalog.pg_tables where schemaname='public' loop
  execute format('create trigger aaa_account_writable before insert or update or delete on public.%I for each row execute function private.enforce_account_writable()',relation.tablename);
 end loop;
end $$;
create trigger aaa_account_writable before insert or update or delete on private.guest_invitations for each row execute function private.enforce_account_writable();
create trigger aaa_account_writable before insert or update or delete on private.personal_exports for each row execute function private.enforce_account_writable();
create policy "pending account cannot upload" on storage.objects as restrictive for insert to authenticated with check(private.account_writable());
create policy "pending account cannot replace" on storage.objects as restrictive for update to authenticated using(private.account_writable()) with check(private.account_writable());
create policy "pending account cannot delete files" on storage.objects as restrictive for delete to authenticated using(private.account_writable());

create function private.prepare_account_deletion() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
 return jsonb_build_object('activities',(select count(*) from public.activities where user_id=actor),
  'shared_moments',(select count(*) from public.moments where user_id=actor or created_by=actor),
  'clubs',(select count(*) from public.clubs where owner_id=actor),
  'files',(select count(*) from storage.objects where coalesce(nullif(owner_id,''),owner::text)=actor::text or (bucket_id in ('activities','activity-media','avatars') and split_part(name,'/',1)=actor::text)),
  'ready',exists(select 1 from private.cleanup_runtime where configured_at is not null and last_success_at>now()-interval '5 minutes'),
  'pending',exists(select 1 from private.account_deletions where user_id=actor));
end $$;
create function public.prepare_account_deletion() returns jsonb language sql stable security invoker set search_path='' as $$select private.prepare_account_deletion();$$;

-- The Edge Function verifies the current account and password before this server-only call.
create function private.begin_account_deletion(p_user uuid,p_id uuid,p_receipt_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing private.account_deletions%rowtype;
begin
 if p_user is null or p_id is null or p_receipt_hash is null or p_receipt_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid deletion request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||p_user::text,0));
 select * into existing from private.account_deletions where user_id=p_user;
 if found then
  if existing.id<>p_id or existing.receipt_hash<>p_receipt_hash then raise exception 'Deletion already pending' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id,'stage',existing.stage);
 end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Account unavailable' using errcode='42501'; end if;
 if not exists(select 1 from private.cleanup_runtime where configured_at is not null and last_success_at>now()-interval '5 minutes') then raise exception 'Cleanup unavailable' using errcode='55000'; end if;
 -- Revoke capabilities immediately. No new invitation can be written after the receipt commits.
 update private.guest_invitations set revoked_at=now() where owner_id=p_user;
 delete from private.guest_sessions where invitation_id in(select id from private.guest_invitations where owner_id=p_user);
 insert into private.account_deletions(id,user_id,receipt_hash) values(p_id,p_user,p_receipt_hash);
 return jsonb_build_object('id',p_id,'stage','queued');
end $$;
create function public.begin_account_deletion(p_user uuid,p_id uuid,p_receipt_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.begin_account_deletion(p_user,p_id,p_receipt_hash);$$;

create function private.account_deletion_status(p_id uuid,p_receipt_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',d.id,'stage',d.stage,'pending_files',(select count(*) from private.storage_cleanup c where c.user_id=d.user_id and c.state<>'complete'),'completed_at',d.completed_at,'retry_pending',d.last_error is not null)
 from private.account_deletions d where d.id=p_id and d.receipt_hash=p_receipt_hash;
$$;
create function public.account_deletion_status(p_id uuid,p_receipt_hash text) returns jsonb language sql stable security invoker set search_path='' as $$select private.account_deletion_status(p_id,p_receipt_hash);$$;

create function private.claim_account_deletions() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with selected as(select id from private.account_deletions where stage<>'complete' and available_at<=now() and (leased_until is null or leased_until<now()) order by requested_at for update skip locked limit 1),
 claimed as(update private.account_deletions d set lease=gen_random_uuid(),leased_until=now()+interval '5 minutes',attempts=attempts+1 from selected s where d.id=s.id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'stage',stage,'lease',lease)),'[]') into result from claimed;
 return result;
end $$;
create function public.claim_account_deletions() returns jsonb language sql security invoker set search_path='' as $$select private.claim_account_deletions();$$;

create function private.purge_account_records(p_id uuid,p_lease uuid) returns boolean
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
 update public.clubs c set logo_url=null where exists(select 1 from storage.objects o where o.bucket_id='club-logos' and o.name=c.logo_url and coalesce(nullif(o.owner_id,''),o.owner::text)=job.user_id::text);
 update public.clubs c set cover_image_url=null where exists(select 1 from storage.objects o where o.name=c.cover_image_url and coalesce(nullif(o.owner_id,''),o.owner::text)=job.user_id::text);
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
 for item in select bucket_id,name from storage.objects where coalesce(nullif(owner_id,''),owner::text)=job.user_id::text or (bucket_id in ('activities','activity-media','avatars') and split_part(name,'/',1)=job.user_id::text) loop
  if item.bucket_id not in ('activities','activity-media','moment-media','avatars','club-logos') then raise exception 'Unmapped storage bucket requires review' using errcode='55000'; end if;
  perform private.enqueue_storage_cleanup(job.user_id,item.bucket_id,item.name);
 end loop;
 update private.account_deletions set stage='files',last_error=null where id=p_id;
 return true;
end $$;
create function public.purge_account_records(p_id uuid,p_lease uuid) returns boolean language sql security invoker set search_path='' as $$select private.purge_account_records(p_id,p_lease);$$;

create function private.account_ready_for_identity(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare job private.account_deletions%rowtype;
begin
 select * into job from private.account_deletions where id=p_id and lease=p_lease for update;
 if not found or job.stage not in ('files','identity') then return false; end if;
 if exists(select 1 from private.storage_cleanup where user_id=job.user_id and state<>'complete')
  or exists(select 1 from storage.objects where coalesce(nullif(owner_id,''),owner::text)=job.user_id::text or (bucket_id in ('activities','activity-media','avatars') and split_part(name,'/',1)=job.user_id::text)) then return false; end if;
 update private.account_deletions set stage='identity' where id=p_id;
 return true;
end $$;
create function public.account_ready_for_identity(p_id uuid,p_lease uuid) returns boolean language sql security invoker set search_path='' as $$select private.account_ready_for_identity(p_id,p_lease);$$;
create function private.finish_account_deletion(p_id uuid,p_lease uuid,p_success boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare job private.account_deletions%rowtype;
begin
 select * into job from private.account_deletions where id=p_id and lease=p_lease for update;
 if not found then return false; end if;
 if p_success and (job.stage<>'identity' or exists(select 1 from auth.users where id=job.user_id)) then raise exception 'Identity deletion not confirmed' using errcode='55000'; end if;
 update private.account_deletions set stage=case when p_success then 'complete' else stage end,completed_at=case when p_success then now() end,
  last_error=case when p_success then null else 'cleanup_pending' end,lease=null,leased_until=null,
  available_at=now()+interval '1 minute' where id=p_id;
 return true;
end $$;
create function public.finish_account_deletion(p_id uuid,p_lease uuid,p_success boolean) returns boolean language sql security invoker set search_path='' as $$select private.finish_account_deletion(p_id,p_lease,p_success);$$;

revoke all on function private.account_writable(),private.enforce_account_writable(),private.prepare_account_deletion(),public.prepare_account_deletion(),private.begin_account_deletion(uuid,uuid,text),public.begin_account_deletion(uuid,uuid,text),private.account_deletion_status(uuid,text),public.account_deletion_status(uuid,text),private.claim_account_deletions(),public.claim_account_deletions(),private.purge_account_records(uuid,uuid),public.purge_account_records(uuid,uuid),private.account_ready_for_identity(uuid,uuid),public.account_ready_for_identity(uuid,uuid),private.finish_account_deletion(uuid,uuid,boolean),public.finish_account_deletion(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.account_writable(),private.prepare_account_deletion(),public.prepare_account_deletion() to authenticated;
grant execute on function private.begin_account_deletion(uuid,uuid,text),public.begin_account_deletion(uuid,uuid,text),private.account_deletion_status(uuid,text),public.account_deletion_status(uuid,text),private.claim_account_deletions(),public.claim_account_deletions(),private.purge_account_records(uuid,uuid),public.purge_account_records(uuid,uuid),private.account_ready_for_identity(uuid,uuid),public.account_ready_for_identity(uuid,uuid),private.finish_account_deletion(uuid,uuid,boolean),public.finish_account_deletion(uuid,uuid,boolean) to service_role;
commit;
