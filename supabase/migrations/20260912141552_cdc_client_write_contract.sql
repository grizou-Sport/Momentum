-- Compatibility label, not an authorization credential. RLS still decides access.
-- Reject an obsolete authenticated writer before any row (including zero-row writes).
-- Server maintenance and anonymous capability-based guest flows retain their guards.
create function private.require_client_write_contract() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and coalesce(
  nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-momentum-client',''
 ) <> 'cdc-2026-09-08' then
  raise exception 'Une nouvelle version est disponible. Conserve ton texte puis recharge la page avant de réessayer.' using errcode='MM001';
 end if;
 return null;
end;
$$;
revoke all on function private.require_client_write_contract() from public,anon,authenticated;

-- Limit the guard to application tables already covered by account-write protection.
-- Do not alter provider schemas or unrelated extension tables.
do $$
declare relation record;
begin
 for relation in
  select distinct c.relname from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid=t.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and t.tgname='aaa_account_writable' and not t.tgisinternal
 loop
  execute format('create trigger aab_client_write_contract before insert or update or delete on public.%I for each statement execute function private.require_client_write_contract()',relation.relname);
 end loop;
end;
$$;
