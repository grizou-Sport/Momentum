-- Inactive until reviewed documents are installed. Never seed an acceptance.
begin;
create table private.legal_documents (
 kind text not null check (kind in ('terms','privacy','guest')),
 version text not null check (version ~ '^[a-zA-Z0-9._-]{1,40}$'),
 content text not null check (length(content)>0),
 sha256 text not null,
 public_path text not null check (public_path ~ '^legal/versions/[a-zA-Z0-9._-]+[.]html$'),
 effective_at timestamptz not null, approved_at timestamptz not null,
 primary key(kind,version), unique(public_path)
);
create table private.legal_release (
 singleton boolean primary key default true check (singleton),
 terms_version text not null, privacy_version text not null, guest_version text not null,
 enabled boolean not null default false
);
create table private.legal_events (
 event_id uuid primary key default gen_random_uuid(),
 subject_type text not null default 'user' check (subject_type='user'),
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null check (event_type in ('terms_accept','notice_delivered')),
 scope text not null check(scope in ('terms','privacy')),
 version text not null, document_sha256 text not null,
 occurred_at timestamptz not null default clock_timestamp(),
 origin text not null default 'account-finalization',
 ui_version text not null default 'legal-2026-09-23',
 state text not null default 'recorded' check(state='recorded'),
 foreign key(scope,version) references private.legal_documents(kind,version),
 unique(user_id,event_type,scope,version)
);
alter table private.legal_documents enable row level security;
alter table private.legal_release enable row level security;
alter table private.legal_events enable row level security;
revoke all on private.legal_documents,private.legal_release,private.legal_events from public,anon,authenticated;

create function private.legal_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Legal history is immutable' using errcode='42501'; end $$;
create function private.stamp_legal_document() returns trigger language plpgsql set search_path='' as $$
begin new.sha256:=encode(sha256(convert_to(new.content,'UTF8')),'hex'); return new; end $$;
revoke all on function private.stamp_legal_document() from public,anon,authenticated;
create trigger stamp_legal_text before insert on private.legal_documents for each row execute function private.stamp_legal_document();
create trigger immutable_legal_text before update or delete on private.legal_documents for each row execute function private.legal_immutable();
create trigger immutable_legal_event before update on private.legal_events for each row execute function private.legal_immutable();

create function private.legal_public_status() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('enabled',r.enabled and t.effective_at<=now() and p.effective_at<=now() and g.effective_at<=now(),
  'terms',jsonb_build_object('version',t.version,'sha256',t.sha256,'path',t.public_path,'effective_at',t.effective_at),
  'privacy',jsonb_build_object('version',p.version,'sha256',p.sha256,'path',p.public_path,'effective_at',p.effective_at),
  'guest',jsonb_build_object('version',g.version,'sha256',g.sha256,'path',g.public_path,'effective_at',g.effective_at))
 from private.legal_release r
 join private.legal_documents t on t.kind='terms' and t.version=r.terms_version
 join private.legal_documents p on p.kind='privacy' and p.version=r.privacy_version
 join private.legal_documents g on g.kind='guest' and g.version=r.guest_version
 where r.singleton),'{"enabled":false}'::jsonb);
$$;
create function public.legal_public_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.legal_public_status();$$;

create function private.legal_session_user() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); session_id text:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id';
begin
 if actor is null or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.user_id=actor and s.id::text=session_id)
 then raise exception 'Active session required' using errcode='42501'; end if;
 return actor;
end $$;
create function private.legal_user_accepted(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((private.legal_public_status()->>'enabled')::boolean,false) and exists(
 select 1 from private.legal_events e join private.legal_release r on r.terms_version=e.version
 join private.legal_documents d on d.kind='terms' and d.version=e.version and d.sha256=e.document_sha256
 where e.user_id=p_user and e.event_type='terms_accept' and e.scope='terms');
$$;
create function private.legal_account_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.legal_session_user();
begin return private.legal_public_status()||jsonb_build_object('accepted',private.legal_user_accepted(actor),
 'history',coalesce((select jsonb_agg((to_jsonb(e)-'user_id')||jsonb_build_object('path',d.public_path,'effective_at',d.effective_at) order by e.occurred_at)
 from private.legal_events e join private.legal_documents d on d.kind=e.scope and d.version=e.version where e.user_id=actor),'[]'::jsonb)); end $$;
create function public.legal_account_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.legal_account_status();$$;

create function private.accept_current_terms(p_version text,p_sha256 text,p_privacy_version text,p_privacy_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.legal_session_user(); status jsonb;
begin
 -- Serialize acceptance with release changes and concurrent retries.
 perform 1 from private.legal_release where singleton for share;
 status:=private.legal_public_status();
 if (status->>'enabled')::boolean is distinct from true or not private.account_writable() then raise exception 'Legal release unavailable' using errcode='42501'; end if;
 if p_version is distinct from status#>>'{terms,version}' or p_sha256 is distinct from status#>>'{terms,sha256}'
 or p_privacy_version is distinct from status#>>'{privacy,version}' or p_privacy_sha256 is distinct from status#>>'{privacy,sha256}'
 then raise exception 'Legal version changed; review it again' using errcode='40001'; end if;
 insert into private.legal_events(user_id,event_type,scope,version,document_sha256)
 values(actor,'terms_accept','terms',p_version,p_sha256), (actor,'notice_delivered','privacy',p_privacy_version,p_privacy_sha256)
 on conflict(user_id,event_type,scope,version) do nothing;
 return private.legal_account_status();
end $$;
create function public.accept_current_terms(p_version text,p_sha256 text,p_privacy_version text,p_privacy_sha256 text) returns jsonb
language sql security invoker set search_path='' as $$select private.accept_current_terms(p_version,p_sha256,p_privacy_version,p_privacy_sha256);$$;

create function private.require_legal_acceptance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not private.legal_user_accepted(private.legal_session_user())
 then raise exception 'Consulte et accepte les conditions depuis Confidentialité et données. Export et suppression restent accessibles.' using errcode='ML001'; end if;
 return null;
end $$;
do $$declare item record;begin
 for item in select distinct c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and t.tgname='aaa_account_writable' and not t.tgisinternal loop
 execute format('create trigger aac_legal_acceptance before insert or update or delete on public.%I for each statement execute function private.require_legal_acceptance()',item.relname);
 end loop;
end $$;
-- Protect capability creation and updates by signed-in organizers; anonymous withdrawal remains possible.
create trigger aac_legal_acceptance before insert or update or delete on private.guest_invitations for each statement execute function private.require_legal_acceptance();
-- File ingestion uses service credentials and therefore needs an explicit subject check.
create function private.require_upload_legal_acceptance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' or new.state='ready') and not private.legal_user_accepted(new.user_id)
 then raise exception 'Legal acceptance required' using errcode='42501'; end if;
 return new;
end $$;
create trigger aac_upload_legal_acceptance before insert or update on private.file_uploads for each row execute function private.require_upload_legal_acceptance();
create function private.require_signup_legal_release() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (private.legal_public_status()->>'enabled')::boolean is distinct from true then raise exception 'Registrations are temporarily closed' using errcode='42501'; end if;
 return new;
end $$;
create trigger momentum_legal_signup before insert on auth.users for each row execute function private.require_signup_legal_release();

-- The legacy response RPC cannot bypass the versioned notice.
create or replace function public.respond_guest_invitation(p_session text,p_name text,p_answer text,p_availability jsonb,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select jsonb_build_object('error','legal_notice_required');$$;
create function private.respond_guest_with_notice(p_session text,p_name text,p_answer text,p_availability jsonb,p_revision integer,p_notice_version text,p_notice_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare status jsonb:=private.legal_public_status();
begin
 if (status->>'enabled')::boolean is distinct from true or p_notice_version is distinct from status#>>'{guest,version}' or p_notice_sha256 is distinct from status#>>'{guest,sha256}'
 then return jsonb_build_object('error','legal_notice_required'); end if;
 return private.guest_command('respond',jsonb_build_object('session',p_session,'name',p_name,'answer',p_answer,'availability',p_availability,'revision',p_revision));
end $$;
create function public.respond_guest_with_notice(p_session text,p_name text,p_answer text,p_availability jsonb,p_revision integer,p_notice_version text,p_notice_sha256 text) returns jsonb
language sql security invoker set search_path='' as $$select private.respond_guest_with_notice(p_session,p_name,p_answer,p_availability,p_revision,p_notice_version,p_notice_sha256);$$;
-- The original private router had direct execute grants. Expose only a restricted router.
alter function private.guest_command(text,jsonb) rename to guest_command_internal;
create function private.guest_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_action='respond' then return jsonb_build_object('error','legal_notice_required'); end if;
 return private.guest_command_internal(p_action,p_data);
end $$;
-- Privileged notice wrapper calls the original router; callers cannot call it themselves.
create or replace function private.respond_guest_with_notice(p_session text,p_name text,p_answer text,p_availability jsonb,p_revision integer,p_notice_version text,p_notice_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare status jsonb;
begin
 perform 1 from private.legal_release where singleton for share;
 status:=private.legal_public_status();
 if (status->>'enabled')::boolean is distinct from true or p_notice_version is distinct from status#>>'{guest,version}' or p_notice_sha256 is distinct from status#>>'{guest,sha256}'
 then return jsonb_build_object('error','legal_notice_required'); end if;
 return private.guest_command_internal('respond',jsonb_build_object('session',p_session,'name',p_name,'answer',p_answer,'availability',p_availability,'revision',p_revision));
end $$;
create function private.withdraw_guest_response(p_session text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; target uuid; parent uuid; invitation private.guest_invitations;
begin
 result:=private.guest_command_internal('read',jsonb_build_object('session',p_session));
 if result ? 'error' then return result; end if;
 select s.invitation_id,g.moment_id into target,parent from private.guest_sessions s join private.guest_invitations g on g.id=s.invitation_id where s.secret_hash=private.guest_hash(p_session) and s.expires_at>now();
 perform 1 from public.moments where id=parent for update;
 select * into invitation from private.guest_invitations where id=target for update;
 if not found or invitation.revoked_at is not null or invitation.expires_at<=now() or not exists(select 1 from private.guest_sessions where secret_hash=private.guest_hash(p_session) and generation=invitation.generation and expires_at>now())
 then return jsonb_build_object('error','invitation_unavailable'); end if;
 if invitation.answer<>'none' or invitation.display_name is not null then
 update private.guest_invitations set display_name=null,answer='none',availability='{}',response_history='[]',response_state='unanswered',responded_schedule_revision=null,response_revision=response_revision+1,updated_at=clock_timestamp() where id=target;
 end if;
 return jsonb_build_object('view',private.guest_view(target));
end $$;
create function public.withdraw_guest_response(p_session text) returns jsonb language sql security invoker set search_path='' as $$select private.withdraw_guest_response(p_session);$$;

revoke all on function private.legal_immutable(),private.legal_public_status(),public.legal_public_status(),private.legal_session_user(),private.legal_user_accepted(uuid),private.legal_account_status(),public.legal_account_status(),private.accept_current_terms(text,text,text,text),public.accept_current_terms(text,text,text,text),private.require_legal_acceptance(),private.require_upload_legal_acceptance(),private.require_signup_legal_release(),private.respond_guest_with_notice(text,text,text,jsonb,integer,text,text),public.respond_guest_with_notice(text,text,text,jsonb,integer,text,text),private.guest_command_internal(text,jsonb),private.guest_command(text,jsonb),private.withdraw_guest_response(text),public.withdraw_guest_response(text) from public,anon,authenticated;
grant execute on function private.legal_public_status(),public.legal_public_status(),private.guest_command(text,jsonb),private.respond_guest_with_notice(text,text,text,jsonb,integer,text,text),public.respond_guest_with_notice(text,text,text,jsonb,integer,text,text),private.withdraw_guest_response(text),public.withdraw_guest_response(text) to anon,authenticated;
grant execute on function private.legal_account_status(),public.legal_account_status(),private.accept_current_terms(text,text,text,text),public.accept_current_terms(text,text,text,text) to authenticated;

-- Add only this account's proof to the existing paginated export, with updated counts.
alter function private.begin_personal_export() rename to begin_personal_export_without_legal;
revoke all on function private.begin_personal_export_without_legal() from public,anon,authenticated;
create function private.begin_personal_export() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.legal_session_user(); manifest jsonb; job private.personal_exports; offset_value bigint;
begin
 manifest:=private.begin_personal_export_without_legal();
 select * into job from private.personal_exports where id=(manifest->>'export_id')::uuid and user_id=actor for update;
 offset_value:=job.total;
 insert into private.personal_export_items(export_id,sequence,kind,payload)
 select job.id,offset_value+row_number() over(order by e.occurred_at,e.event_id),'legal_events',to_jsonb(e)-'user_id'
 from private.legal_events e where e.user_id=actor;
 update private.personal_exports set total=(select count(*) from private.personal_export_items where export_id=job.id),
 counts=(select coalesce(jsonb_object_agg(kind,n),'{}') from (select kind,count(*) n from private.personal_export_items where export_id=job.id group by kind) c)
 where id=job.id returning * into job;
 return manifest||jsonb_build_object('total',job.total,'counts',job.counts);
end $$;
revoke all on function private.begin_personal_export() from public,anon,authenticated;
grant execute on function private.begin_personal_export() to authenticated;
commit;
