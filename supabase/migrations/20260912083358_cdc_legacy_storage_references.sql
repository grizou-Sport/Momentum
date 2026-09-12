-- Compatible edits of legacy Storage URLs; no rewrite of historical rows.
begin;
create or replace function private.save_personal_moment(
  p_operation_id uuid, p_activity jsonb, p_assessment jsonb,
  p_nutrition jsonb, p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  activity_id uuid;
  previous public.activities%rowtype;
  candidate public.activities%rowtype;
  receipt private.moment_operations%rowtype;
  request_hash bytea;
  response jsonb;
  is_existing boolean;
  columns_sql text;
  accepted_keys text[] := array['id','user_id','activity_date','activity_time','activity_category','sport','activity_type','status','distance_km','duration_min','elevation_m','avg_hr','rpe','rpe_source','duration_source','timer_duration_seconds','elapsed_duration_seconds','moving_duration_seconds','source_instant','source_timezone','source_hash','qualifiers','is_memorable','practice_variant','gear','notes','location_name','location_id','route_summary','source_file_url','source_file_type','gpx_url'];
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_operation_id is null or p_activity is null or jsonb_typeof(p_activity) <> 'object' then raise exception 'Invalid operation' using errcode = '22023'; end if;
  if octet_length(p_activity::text) > 5000000 or exists(select from jsonb_object_keys(p_activity) k where not k = any(accepted_keys)) then raise exception 'Invalid activity fields' using errcode = '22023'; end if;
  if p_activity ? 'user_id' and (p_activity->>'user_id')::uuid is distinct from actor then raise exception 'Activity unavailable' using errcode = '42501'; end if;
  activity_id := (p_activity->>'id')::uuid;
  if activity_id is null then raise exception 'Activity identifier required' using errcode = '22023'; end if;
  request_hash := sha256(convert_to(jsonb_build_object('activity',p_activity,'assessment',p_assessment,'nutrition',p_nutrition,'revision',p_expected_revision)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_operation_id::text, 0));
  select * into receipt from private.moment_operations where user_id = actor and operation_id = p_operation_id;
  if found then
    if receipt.request_hash <> request_hash or not exists(select from public.activities where id = receipt.activity_id and user_id = actor) then raise exception 'Operation conflict' using errcode = '40001'; end if;
    return receipt.result;
  end if;
  -- Row and operation locks cover independent requests and retries respectively.
  perform pg_advisory_xact_lock(hashtextextended(activity_id::text, 1));
  select * into previous from public.activities where id = activity_id for update;
  is_existing := found;
  if is_existing and previous.user_id <> actor then raise exception 'Activity unavailable' using errcode = '42501'; end if;
  if is_existing and (p_expected_revision is null or p_expected_revision <> previous.revision)
    or not is_existing and p_expected_revision is not null then raise exception 'Activity changed' using errcode = '40001'; end if;
  if not is_existing then
    previous.id := activity_id; previous.user_id := actor; previous.created_at := now(); previous.updated_at := now();
    previous.revision := 1; previous.rpe_source := 'undocumented'; previous.duration_source := 'undocumented';
    previous.qualifiers := '{}'; previous.is_memorable := false; previous.activity_category := 'sport';
  end if;
  if p_activity ? 'rpe' and p_activity->'rpe' <> 'null'::jsonb and (jsonb_typeof(p_activity->'rpe') <> 'number' or (p_activity->>'rpe')::numeric <> trunc((p_activity->>'rpe')::numeric)) then raise exception 'Invalid effort' using errcode = '22023'; end if;
  candidate := jsonb_populate_record(previous, p_activity - 'user_id');
  if candidate.activity_date is null or candidate.status is null or candidate.status not in ('done','planned','cancelled')
    or candidate.status = 'done' and candidate.activity_date > (now() at time zone 'Europe/Zurich')::date
    or nullif(trim(candidate.activity_type),'') is null
    or candidate.activity_category not in ('sport','wellbeing','adventure')
    or candidate.duration_min <= 0 or candidate.distance_km < 0 or candidate.avg_hr <= 0
    or length(candidate.notes) > 10000 or length(candidate.activity_type) > 160 then raise exception 'Invalid activity' using errcode = '22023'; end if;
  -- Private paths and referenced objects must belong to this account; public keys are not authorization.
  if (candidate.source_file_url is not null and private.storage_path('activities',candidate.source_file_url) is null)
    or (candidate.gpx_url is not null and private.storage_path('activities',candidate.gpx_url) is null) then raise exception 'File unavailable' using errcode = '42501'; end if;
  candidate.source_file_url := private.storage_path('activities',candidate.source_file_url);
  candidate.gpx_url := private.storage_path('activities',candidate.gpx_url);
  if (candidate.source_file_url is not null and split_part(candidate.source_file_url,'/',1) <> actor::text)
    or (candidate.gpx_url is not null and split_part(candidate.gpx_url,'/',1) <> actor::text) then raise exception 'File unavailable' using errcode = '42501'; end if;
  if candidate.location_id is not null and not exists(select from public.locations where id = candidate.location_id and (visibility = 'public' or owner_user_id = actor or created_by = actor)) then raise exception 'Location unavailable' using errcode = '42501'; end if;
  -- Populate from the existing row to retain columns not edited by this form.
  if is_existing then
    select string_agg(format('%I', attname), ',') into columns_sql from pg_attribute where attrelid = 'public.activities'::regclass and attnum > 0 and not attisdropped;
    execute format('update public.activities set (%s) = (select %s from jsonb_populate_record(null::public.activities, $1)) where id = $2', columns_sql, columns_sql)
      using to_jsonb(candidate), activity_id;
  else
    insert into public.activities select candidate.*;
  end if;
  if p_assessment is not null and p_assessment <> 'null'::jsonb then
    if jsonb_typeof(p_assessment) <> 'object' or exists(select from jsonb_object_keys(p_assessment) k where k not in ('perceived_challenge','perceived_mastery','retained_memory')) then raise exception 'Invalid experience' using errcode = '22023'; end if;
    if exists(select from jsonb_each(p_assessment) e where e.key in ('perceived_challenge','perceived_mastery') and e.value <> 'null'::jsonb and (jsonb_typeof(e.value) <> 'number' or (e.value::text)::numeric <> trunc((e.value::text)::numeric))) then raise exception 'Invalid scale value' using errcode = '22023'; end if;
    insert into public.activity_flow_assessments(activity_id,user_id,perceived_challenge,perceived_mastery,retained_memory)
      values(activity_id,actor,(p_assessment->>'perceived_challenge')::smallint,(p_assessment->>'perceived_mastery')::smallint,p_assessment->>'retained_memory')
      on conflict on constraint activity_flow_assessments_activity_id_user_id_key do update set
        perceived_challenge = excluded.perceived_challenge, perceived_mastery = excluded.perceived_mastery, retained_memory = excluded.retained_memory;
  end if;
  if p_nutrition is not null and p_nutrition <> 'null'::jsonb then perform private.save_moment_nutrition(activity_id, actor, p_nutrition); end if;
  select jsonb_build_object('id',id,'revision',revision) into response from public.activities where id = activity_id;
  insert into private.moment_operations values(actor,p_operation_id,request_hash,activity_id,response,now());
  return response;
end;
$$;

create or replace function private.export_redact(value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
  if jsonb_typeof(value)='object' then
    select coalesce(jsonb_object_agg(key,case
      when key ~ '(^|_)(url|uri)$' and jsonb_typeof(v)='string' and (v #>> '{}') ~ '^https?://'
      then to_jsonb(regexp_replace(regexp_replace(v #>> '{}','[?#].*$',''),'^(https?://)[^/@]+@','\1'))
      else private.export_redact(v) end),'{}') into result from jsonb_each(value) e(key,v)
      where lower(key) not in ('token','token_hash','secret','access_token','refresh_token','api_key','service_role_key','password','p_session','p_secret');
    return result;
  elsif jsonb_typeof(value)='array' then
    select coalesce(jsonb_agg(private.export_redact(v) order by ord),'[]') into result from jsonb_array_elements(value) with ordinality e(v,ord); return result;
  end if;
  return value;
end;
$$;
revoke all on function private.export_redact(jsonb) from public,anon,authenticated;

commit;
