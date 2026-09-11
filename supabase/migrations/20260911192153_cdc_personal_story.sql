-- Les intentions libres restent dans le Passeport. Les Moments marquants sont les activités existantes.
begin;
create or replace function public.save_personal_intention(p_text text, p_status text, p_expected_updated_at timestamptz, p_operation_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actor uuid := auth.uid(); profile public.passports; profile_settings jsonb; previous jsonb; history jsonb; request_hash text;
begin
 if actor is null then raise exception 'Session requise' using errcode='42501'; end if;
 if p_operation_id is null or p_text is null or length(p_text)>2000 or p_status is null or p_status not in ('active','paused','archived') then raise exception 'Intention invalide' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':intention',0));
 select * into profile from public.passports where user_id=actor for update;
 if not found then raise exception 'Passeport indisponible' using errcode='P0002'; end if;
 request_hash := md5(jsonb_build_array(p_text,p_status)::text);
 profile_settings := coalesce(profile.personalization,'{}'::jsonb);
 if profile_settings->'intention_receipt'->>'operation_id'=p_operation_id::text then
  if profile_settings->'intention_receipt'->>'request_hash'<>request_hash then raise exception 'Commande modifiée' using errcode='40001'; end if;
  return to_jsonb(profile);
 end if;
 if p_expected_updated_at is distinct from profile.updated_at then raise exception 'Le profil a changé. Recharge avant de modifier.' using errcode='40001'; end if;
 previous := jsonb_build_object('text',profile_settings->>'open_intention','status',coalesce(profile_settings->>'open_intention_status','active'),'recorded_at',profile.updated_at);
 history := coalesce(profile_settings->'intention_history','[]'::jsonb);
 if nullif(previous->>'text','') is not null and (previous->>'text' is distinct from btrim(p_text) or p_status='archived' and previous->>'status'<>'archived') then history := history||jsonb_build_array(previous); end if;
 update public.passports set personalization=profile_settings||jsonb_build_object('open_intention',btrim(p_text),'open_intention_status',p_status,'intention_history',history,'intention_receipt',jsonb_build_object('operation_id',p_operation_id,'request_hash',request_hash)),updated_at=clock_timestamp() where user_id=actor returning * into profile;
 return to_jsonb(profile);
end $$;
revoke all on function public.save_personal_intention(text,text,timestamptz,uuid) from public,anon;
grant execute on function public.save_personal_intention(text,text,timestamptz,uuid) to authenticated;

create or replace function public.mark_personal_moment(p_activity_id uuid,p_marked boolean,p_expected_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); activity public.activities;
begin
 if actor is null then raise exception 'Session requise' using errcode='42501'; end if;
 if p_marked is null then raise exception 'Choix requis' using errcode='22023'; end if;
 select * into activity from public.activities where id=p_activity_id and user_id=actor for update;
 if not found then raise exception 'Moment indisponible' using errcode='42501'; end if;
 -- Une réponse réseau perdue peut être rejouée sans nouvelle révision si le choix est déjà enregistré.
 if activity.is_memorable=p_marked then return to_jsonb(activity); end if;
 if activity.revision is distinct from p_expected_revision then raise exception 'Ce Moment a changé. Recharge avant de modifier.' using errcode='40001'; end if;
 update public.activities set is_memorable=p_marked where id=p_activity_id and user_id=actor returning * into activity;
 return to_jsonb(activity);
end $$;
revoke all on function public.mark_personal_moment(uuid,boolean,integer) from public,anon;
grant execute on function public.mark_personal_moment(uuid,boolean,integer) to authenticated;
commit;
