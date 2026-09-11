-- CDC §9. No physiological estimate, biometric requirement, or synthetic objective.
begin;
create or replace function public.save_minimal_onboarding(p_step integer,p_values jsonb,p_operation_id uuid,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actor uuid:=auth.uid(); progress public.onboarding_progress%rowtype; passport public.passports%rowtype;
  minimal jsonb; fingerprint text; chosen uuid[];
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_step not between 1 and 3 or p_step is null or p_operation_id is null or p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Invalid setup step' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,3));
  select * into passport from public.passports where user_id=actor for update;
  if passport.personalization->>'onboarding_completed'='true' or coalesce((passport.personalization->>'minimal_onboarding_version')::int,0)>=1 then return jsonb_build_object('complete',true); end if;
  select * into progress from public.onboarding_progress where user_id=actor for update;
  minimal:=coalesce(progress.answers->'minimal','{}');
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('step',p_step,'values',p_values)::text,'UTF8')),'hex');
  if minimal->>'operation_id'=p_operation_id::text then
    if minimal->>'request_hash'<>fingerprint then raise exception 'Setup changed' using errcode='40001'; end if;
    return jsonb_build_object('complete',false,'next_step',progress.current_step,'updated_at',progress.updated_at);
  end if;
  if progress.updated_at is distinct from p_expected_updated_at then raise exception 'Setup changed' using errcode='40001'; end if;
  if p_step>coalesce((minimal->>'next_step')::int,1) then raise exception 'Previous step required' using errcode='22023'; end if;
  if p_step=1 then
    if nullif(trim(p_values->>'display_name'),'') is null or length(p_values->>'display_name')>120 then raise exception 'First name required' using errcode='22023'; end if;
    insert into public.passports(user_id,display_name) values(actor,trim(p_values->>'display_name'))
      on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
    update public.profiles set display_name=trim(p_values->>'display_name'),updated_at=now() where id=actor;
    minimal:=minimal||jsonb_build_object('display_name',trim(p_values->>'display_name'));
  elsif p_step=2 and coalesce((p_values->>'skipped')::boolean,false)=false then
    if not p_values ? 'sport_ids' or jsonb_typeof(p_values->'sport_ids')<>'array' or jsonb_array_length(p_values->'sport_ids')>100 then raise exception 'Invalid practices' using errcode='22023'; end if;
    select coalesce(array_agg(value::uuid),'{}') into chosen from jsonb_array_elements_text(p_values->'sport_ids');
    if exists(select from unnest(chosen) c where not exists(select from public.sports where id=c)) then raise exception 'Practice unavailable' using errcode='22023'; end if;
    update public.user_sports set active=false where user_id=actor and not sport_id=any(chosen);
    insert into public.user_sports(user_id,sport_id,active) select actor,c,true from unnest(chosen) c
      on conflict(user_id,sport_id) do update set active=true;
    minimal:=minimal||jsonb_build_object('sport_ids',to_jsonb(chosen));
  elsif p_step=3 then
    if length(p_values->>'intention')>2000 then raise exception 'Intention too long' using errcode='22023'; end if;
    update public.passports set personalization=personalization||jsonb_build_object('minimal_onboarding_version',1,'minimal_onboarding_completed_at',now(),'open_intention',nullif(trim(p_values->>'intention'),'')),updated_at=now() where user_id=actor;
  end if;
  minimal:=minimal||jsonb_build_object('next_step',least(3,greatest(p_step+1,coalesce((minimal->>'next_step')::int,1))),'operation_id',p_operation_id,'request_hash',fingerprint);
  insert into public.onboarding_progress(user_id,current_step,answers,completed_at)
    values(actor,(minimal->>'next_step')::smallint,coalesce(progress.answers,'{}')||jsonb_build_object('minimal',minimal),case when p_step=3 then now() else null end)
    on conflict(user_id) do update set current_step=excluded.current_step,answers=excluded.answers,completed_at=excluded.completed_at,updated_at=clock_timestamp()
    returning * into progress;
  return jsonb_build_object('complete',p_step=3,'next_step',progress.current_step,'updated_at',progress.updated_at);
end;
$$;
revoke all on function public.save_minimal_onboarding(integer,jsonb,uuid,timestamptz) from public,anon;
grant execute on function public.save_minimal_onboarding(integer,jsonb,uuid,timestamptz) to authenticated;
commit;
