-- CDC §17: one resolution contract, exact versions, no text-based health inference.
begin;
create or replace function private.advance_day_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.revision := old.revision + 1; return new; end;
$$;
revoke all on function private.advance_day_revision() from public,anon,authenticated;
create trigger advance_day_revision before update on public.days for each row execute function private.advance_day_revision();

create or replace function public.save_daily_observations(
  p_date date, p_values jsonb, p_context text[], p_note text,
  p_expected_updated_at timestamptz default null, p_expected_day_version bigint default 0
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actor uuid := auth.uid(); daily public.daily_wellbeing%rowtype; day_row public.days%rowtype;
  previous_sources jsonb; key text; value jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_date is null or jsonb_typeof(p_values) <> 'object' or length(p_note)>10000 or p_context is null
    or not p_context <@ array['illness','vacation','competition']::text[] then raise exception 'Invalid observations' using errcode='22023'; end if;
  for key,value in select * from jsonb_each(p_values) loop
    if key not in ('sleep_hours','motivation','resting_hr','hrv_ms','sleep_quality_value')
      or value <> 'null'::jsonb and (jsonb_typeof(value) <> 'number' or
        case key when 'sleep_hours' then value::text::numeric < 0 or value::text::numeric > 24
          when 'motivation' then value::text::numeric < 1 or value::text::numeric > 10 or value::text::numeric <> trunc(value::text::numeric)
          when 'resting_hr' then value::text::numeric < 20 or value::text::numeric > 220 or value::text::numeric <> trunc(value::text::numeric)
          when 'hrv_ms' then value::text::numeric < 0
          else value::text::numeric < 1 or value::text::numeric > 5 or value::text::numeric <> trunc(value::text::numeric) end)
      then raise exception 'Invalid observation value' using errcode='22023'; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_date::text,2));
  select * into daily from public.daily_wellbeing where user_id=actor and recorded_date=p_date for update;
  select * into day_row from public.days where user_id=actor and day_date=p_date for update;
  if daily.updated_at is distinct from p_expected_updated_at or coalesce(day_row.revision,0) is distinct from p_expected_day_version then raise exception 'Observations changed' using errcode='40001'; end if;
  -- Keep source measurements; explicit corrections (including null) take priority in readers.
  previous_sources := coalesce(daily.raw_data,'{}');
  if daily.id is not null then previous_sources := previous_sources || jsonb_build_object('previous_corrections',coalesce(previous_sources->'previous_corrections','[]') || jsonb_build_array(jsonb_build_object('at',daily.updated_at,'values',previous_sources->'manual_corrections'))); end if;
  insert into public.daily_wellbeing(user_id,recorded_date,source,source_label,raw_data)
    values(actor,p_date,'manual','Ajout manuel',previous_sources || jsonb_build_object('manual_corrections',coalesce(previous_sources->'manual_corrections','{}') || p_values))
    on conflict(user_id,recorded_date) do update set raw_data=excluded.raw_data,updated_at=clock_timestamp()
    returning * into daily;
  insert into public.days(user_id,day_date,note,context_annotations) values(actor,p_date,p_note,p_context)
    on conflict(user_id,day_date) do update set note=excluded.note,context_annotations=excluded.context_annotations
    returning * into day_row;
  return jsonb_build_object('daily',to_jsonb(daily),'day',to_jsonb(day_row));
end;
$$;
revoke all on function public.save_daily_observations(date,jsonb,text[],text,timestamptz,bigint) from public,anon;
grant execute on function public.save_daily_observations(date,jsonb,text[],text,timestamptz,bigint) to authenticated;

create or replace function public.delete_daily_observations(p_date date) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_date::text,2));
  delete from public.daily_wellbeing where user_id=auth.uid() and recorded_date=p_date;
  update public.days set sleep_hours=null,energy=null,rest_hr=null,hrv=null where user_id=auth.uid() and day_date=p_date;
end;
$$;
revoke all on function public.delete_daily_observations(date) from public,anon;
grant execute on function public.delete_daily_observations(date) to authenticated;
commit;
