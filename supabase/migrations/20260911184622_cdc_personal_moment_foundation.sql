-- CDC §§12, 13, 15, 17, 25. Additive: no historical effort or memory is rewritten.
begin;

alter table public.activities
  add column if not exists rpe_source text not null default 'undocumented',
  add column if not exists duration_source text not null default 'undocumented',
  add column if not exists timer_duration_seconds numeric,
  add column if not exists elapsed_duration_seconds numeric,
  add column if not exists moving_duration_seconds numeric,
  add column if not exists source_instant timestamptz,
  add column if not exists source_timezone text,
  add column if not exists source_hash text,
  add column if not exists qualifiers text[] not null default '{}',
  add column if not exists is_memorable boolean not null default false,
  add column if not exists practice_variant text,
  add column if not exists revision bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists nutrition_note text,
  add column if not exists nutrition_elapsed_override_seconds numeric;

alter table public.activities add constraint activities_cdc_values check (
  (rpe is null or rpe between 1 and 10)
  and rpe_source in ('undocumented', 'user')
  and duration_source in ('undocumented', 'manual', 'import')
  and (source_hash is null or source_hash ~ '^[a-f0-9]{64}$')
  and qualifiers <@ array['adventure', 'together', 'discovery']::text[]
  and (practice_variant is null or practice_variant in ('active', 'passive'))
  and (timer_duration_seconds is null or timer_duration_seconds > 0)
  and (elapsed_duration_seconds is null or elapsed_duration_seconds > 0)
  and (moving_duration_seconds is null or moving_duration_seconds > 0)
  and (nutrition_elapsed_override_seconds is null or nutrition_elapsed_override_seconds > 0)
  and (nutrition_note is null or length(nutrition_note) <= 2000)
) not valid;
create unique index activities_user_source_hash_key on public.activities(user_id, source_hash) where source_hash is not null;
create index if not exists activities_user_date_id_idx on public.activities(user_id, activity_date, id);

alter table public.activity_flow_assessments
  alter column perceived_challenge drop not null,
  alter column perceived_mastery drop not null;

alter table public.days add column if not exists context_annotations text[] not null default '{}',
  add column if not exists revision bigint not null default 1;
alter table public.days add constraint days_context_values check (context_annotations <@ array['illness', 'vacation', 'competition']::text[]);
alter table public.user_settings add column if not exists experience_preferences jsonb not null default '{}'
  check (jsonb_typeof(experience_preferences) = 'object');

create schema if not exists private;
create table private.moment_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request_hash bytea not null,
  activity_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table private.moment_operations enable row level security;
revoke all on private.moment_operations from public, anon, authenticated;

create or replace function private.advance_moment_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.advance_moment_revision() from public, anon, authenticated;
create trigger advance_moment_revision before update on public.activities
  for each row execute function private.advance_moment_revision();

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
revoke all on function private.save_personal_moment(uuid,jsonb,jsonb,jsonb,bigint) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.save_personal_moment(uuid,jsonb,jsonb,jsonb,bigint) to authenticated;
create or replace function public.save_personal_moment(
  p_operation_id uuid, p_activity jsonb, p_assessment jsonb default null,
  p_nutrition jsonb default null, p_expected_revision bigint default null
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_personal_moment(p_operation_id,p_activity,p_assessment,p_nutrition,p_expected_revision);
$$;
revoke all on function public.save_personal_moment(uuid,jsonb,jsonb,jsonb,bigint) from public, anon;
grant execute on function public.save_personal_moment(uuid,jsonb,jsonb,jsonb,bigint) to authenticated;

create or replace function public.save_experience_preference(p_key text, p_value jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not (p_key = 'journal_open' and jsonb_typeof(p_value) = 'boolean'
    or p_key = any(array['arrival_index.html','arrival_progression.html','arrival_you.html','arrival_together.html']) and p_value in ('"immersive"'::jsonb,'"direct"'::jsonb)) then raise exception 'Invalid preference' using errcode = '22023'; end if;
  insert into public.user_settings(user_id,experience_preferences) values(auth.uid(),jsonb_build_object(p_key,p_value))
    on conflict(user_id) do update set experience_preferences = public.user_settings.experience_preferences || excluded.experience_preferences
    returning experience_preferences into result;
  return result;
end;
$$;
revoke all on function public.save_experience_preference(text,jsonb) from public, anon;
grant execute on function public.save_experience_preference(text,jsonb) to authenticated;
commit;
