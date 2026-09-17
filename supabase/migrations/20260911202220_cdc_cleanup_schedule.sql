begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table private.cleanup_runtime (
 singleton boolean primary key default true check(singleton), configured_at timestamptz,
 last_success_at timestamptz, last_attempt_at timestamptz, pending_files integer not null default 0
);
insert into private.cleanup_runtime(singleton) values(true);
alter table private.cleanup_runtime enable row level security;
revoke all on private.cleanup_runtime from public,anon,authenticated;

-- Deployment-only operation. The credential is passed by a server environment, never committed or returned.
create function private.configure_storage_cleanup(p_project_url text,p_worker_secret text) returns boolean
language plpgsql security definer set search_path='' as $$
declare secret_id uuid; setting_name text; setting_value text;
begin
 if p_project_url is null or p_project_url !~ '^https://[a-z0-9]{20}[.]supabase[.]co$'
  or p_worker_secret is null or p_worker_secret !~ '^[a-f0-9]{64}$' then raise exception 'Invalid cleanup configuration' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('momentum-cleanup-configuration',0));
 insert into private.storage_origins(origin) values(p_project_url) on conflict do nothing;
 foreach setting_name in array array['momentum_cleanup_url','momentum_cleanup_secret'] loop
  setting_value:=case setting_name when 'momentum_cleanup_url' then p_project_url else p_worker_secret end;
  select id into secret_id from vault.secrets where name=setting_name;
  if secret_id is null then perform vault.create_secret(setting_value,setting_name,'MOMENTUM storage cleanup');
  else perform vault.update_secret(secret_id,setting_value,setting_name,'MOMENTUM storage cleanup'); end if;
 end loop;
 perform cron.schedule('momentum-storage-cleanup','* * * * *',$job$
  select net.http_post(
   url:=(select decrypted_secret from vault.decrypted_secrets where name='momentum_cleanup_url')||'/functions/v1/storage-cleanup',
   headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-secret',(select decrypted_secret from vault.decrypted_secrets where name='momentum_cleanup_secret')),
   body:='{}'::jsonb,timeout_milliseconds:=60000
  );
 $job$);
 update private.cleanup_runtime set configured_at=now() where singleton;
 return true;
end $$;
create function public.configure_storage_cleanup(p_project_url text,p_worker_secret text) returns boolean language sql security invoker set search_path='' as $$select private.configure_storage_cleanup(p_project_url,p_worker_secret);$$;

create function private.record_storage_cleanup_run(p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 update private.cleanup_runtime set last_attempt_at=now(),last_success_at=case when p_success then now() else last_success_at end,
  pending_files=(select count(*) from private.storage_cleanup where state<>'complete') where singleton;
end $$;
create function public.record_storage_cleanup_run(p_success boolean) returns void language sql security invoker set search_path='' as $$select private.record_storage_cleanup_run(p_success);$$;

revoke all on function private.configure_storage_cleanup(text,text),public.configure_storage_cleanup(text,text),private.record_storage_cleanup_run(boolean),public.record_storage_cleanup_run(boolean) from public,anon,authenticated;
grant execute on function private.configure_storage_cleanup(text,text),public.configure_storage_cleanup(text,text),private.record_storage_cleanup_run(boolean),public.record_storage_cleanup_run(boolean) to service_role;
commit;
