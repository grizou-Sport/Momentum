-- Representative pre-CDC columns captured from production; synthetic users only.
create role anon nologin; create role authenticated nologin;
create schema auth; create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
create table public.activities (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "moment_id" uuid,
  "sport" text,
  "activity_type" text,
  "status" text default 'done'::text,
  "distance_km" numeric,
  "duration_min" numeric,
  "elevation_m" numeric,
  "avg_hr" integer,
  "rpe" integer,
  "gear" text,
  "notes" text,
  "gpx_url" text,
  "created_at" timestamp with time zone default now(),
  "sport_id" uuid,
  "mission_id" uuid,
  "activity_date" date,
  "weather" jsonb,
  "location_name" text,
  "route_summary" jsonb,
  "activity_category" text not null default 'sport'::text,
  "source_file_url" text,
  "source_file_type" text,
  "activity_time" time without time zone,
  "location_id" uuid);
alter table public.activities add primary key (id);
alter table public.activities enable row level security;
grant select,insert,update,delete on public.activities to authenticated;
create policy own_rows on public.activities to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.activity_flow_assessments (
  "id" uuid not null default gen_random_uuid(),
  "activity_id" uuid not null,
  "user_id" uuid not null,
  "perceived_challenge" smallint not null,
  "perceived_mastery" smallint not null,
  "analysis_context" jsonb not null default '{}'::jsonb,
  "assessment_version" smallint not null default 1,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "retained_memory" text);
alter table public.activity_flow_assessments add primary key (id);
alter table public.activity_flow_assessments enable row level security;
grant select,insert,update,delete on public.activity_flow_assessments to authenticated;
create policy own_rows on public.activity_flow_assessments to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.locations (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "address" text,
  "postal_code" text,
  "city" text,
  "country" text,
  "country_code" text,
  "latitude" numeric,
  "longitude" numeric,
  "source" text not null default 'manual'::text,
  "provider_place_id" text,
  "visibility" text not null default 'private'::text,
  "owner_user_id" uuid,
  "created_by" uuid not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.locations add primary key (id);
alter table public.locations enable row level security;
grant select,insert,update,delete on public.locations to authenticated;
create table public.days (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "day_date" date not null,
  "title" text,
  "note" text,
  "mood" integer,
  "energy" integer,
  "sleep_hours" numeric,
  "stress" integer,
  "soreness" text,
  "rest_hr" integer,
  "hrv" integer,
  "weight" numeric,
  "weather" jsonb,
  "sunrise" timestamp with time zone,
  "sunset" timestamp with time zone,
  "created_at" timestamp with time zone default now());
alter table public.days add primary key (id);
alter table public.days enable row level security;
grant select,insert,update,delete on public.days to authenticated;
create policy own_rows on public.days to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.daily_wellbeing (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "recorded_date" date not null,
  "sleep_hours" numeric,
  "motivation" smallint,
  "resting_hr" smallint,
  "hrv_ms" numeric,
  "sleep_quality_value" numeric,
  "sleep_quality_unit" text not null default '%'::text,
  "source" text not null default 'manual'::text,
  "source_label" text not null default 'Ajout manuel'::text,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.daily_wellbeing add primary key (id);
alter table public.daily_wellbeing enable row level security;
grant select,insert,update,delete on public.daily_wellbeing to authenticated;
create policy own_rows on public.daily_wellbeing to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_settings (
  "user_id" uuid not null,
  "units" text not null default 'METRIC'::text,
  "language" text not null default 'fr'::text,
  "theme" text not null default 'SYSTEM'::text,
  "notifications" jsonb not null default '{"push": true, "email": true, "adventure_reminders": true}'::jsonb,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.user_settings add primary key (user_id);
alter table public.user_settings enable row level security;
grant select,insert,update,delete on public.user_settings to authenticated;
create policy own_rows on public.user_settings to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.activity_flow_assessments add constraint activity_flow_assessments_activity_id_user_id_key unique(activity_id,user_id);
alter table public.activity_flow_assessments add check(perceived_challenge between 1 and 10), add check(perceived_mastery between 1 and 10), add check(length(retained_memory) <= 2000), add foreign key(activity_id) references public.activities(id) on delete cascade;
alter table public.days add unique(user_id,day_date);
alter table public.daily_wellbeing add unique(user_id,recorded_date);
