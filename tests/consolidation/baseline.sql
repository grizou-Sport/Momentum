-- Representative pre-CDC columns captured from production; synthetic users only.
create role service_role nologin bypassrls; create role anon nologin; create role authenticated nologin;
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
create table public.passports (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "display_name" text,
  "country" text,
  "city" text,
  "quote" text,
  "avatar_url" text,
  "height_cm" numeric,
  "weight_kg" numeric,
  "birth_year" integer,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "birth_date" date,
  "sex" text,
  "sport_level" text,
  "habits" jsonb not null default '{}'::jsonb,
  "objectives" jsonb not null default '{}'::jsonb,
  "connected_sources" jsonb not null default '{}'::jsonb,
  "personalization" jsonb not null default '{}'::jsonb);
alter table public.passports add primary key (id);
alter table public.passports enable row level security;
grant select,insert,update,delete on public.passports to authenticated;
create policy own_rows on public.passports to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.profiles (
  "id" uuid not null,
  "email" text,
  "first_name" text,
  "last_name" text,
  "display_name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "circle_discoverable" boolean not null default true);
alter table public.profiles add primary key (id);
alter table public.profiles enable row level security;
grant select,insert,update,delete on public.profiles to authenticated;
create policy own_rows on public.profiles to authenticated using (id = auth.uid()) with check (id = auth.uid());
create table public.onboarding_progress (
  "user_id" uuid not null,
  "current_step" smallint not null default 1,
  "answers" jsonb not null default '{}'::jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.onboarding_progress add primary key (user_id);
alter table public.onboarding_progress enable row level security;
grant select,insert,update,delete on public.onboarding_progress to authenticated;
create policy own_rows on public.onboarding_progress to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.sports (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "created_at" timestamp with time zone default now(),
  "emoji" text,
  "order_index" integer default 0);
alter table public.sports add primary key (id);
alter table public.sports enable row level security;
grant select,insert,update,delete on public.sports to authenticated;
create policy read_catalogue on public.sports for select to authenticated using(true);
create table public.user_sports (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "sport_id" uuid not null,
  "role" text default 'Secondaire'::text,
  "active" boolean default true,
  "created_at" timestamp with time zone default now());
alter table public.user_sports add primary key (id);
alter table public.user_sports enable row level security;
grant select,insert,update,delete on public.user_sports to authenticated;
create policy own_rows on public.user_sports to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_sport_preferences (
  "user_id" uuid not null,
  "experience_code" text,
  "weekly_hours_range" text,
  "events" jsonb not null default '[]'::jsonb,
  "watch_provider" text,
  "preferences" jsonb not null default '{}'::jsonb,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.user_sport_preferences add primary key (user_id);
alter table public.user_sport_preferences enable row level security;
grant select,insert,update,delete on public.user_sport_preferences to authenticated;
create policy own_rows on public.user_sport_preferences to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_load_estimates (
  "user_id" uuid not null,
  "chronic_load" numeric,
  "weekly_hours" numeric,
  "experience_level" text,
  "sport_distribution" jsonb not null default '{}'::jsonb,
  "confidence" numeric not null default 0,
  "source" text not null default 'EMPTY'::text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.user_load_estimates add primary key (user_id);
alter table public.user_load_estimates enable row level security;
grant select,insert,update,delete on public.user_load_estimates to authenticated;
create policy own_rows on public.user_load_estimates to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.passports add unique(user_id);
alter table public.user_sports add unique(user_id,sport_id);
create table public.activity_equipment (
  "id" uuid not null default gen_random_uuid(),
  "activity_id" uuid,
  "equipment_id" uuid,
  "created_at" timestamp with time zone default now());
alter table public.activity_equipment add primary key (id);
alter table public.activity_equipment enable row level security;
grant select,insert,update,delete on public.activity_equipment to authenticated;
create table public.activity_media (
  "id" uuid not null default gen_random_uuid(),
  "activity_id" uuid not null,
  "user_id" uuid not null,
  "media_type" text not null default 'PHOTO'::text,
  "file_path" text not null,
  "caption" text,
  "created_at" timestamp with time zone not null default now());
alter table public.activity_media add primary key (id);
alter table public.activity_media enable row level security;
grant select,insert,update,delete on public.activity_media to authenticated;
create policy own_rows on public.activity_media to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.activity_timeline (
  "id" uuid not null default gen_random_uuid(),
  "activity_id" uuid not null,
  "user_id" uuid not null,
  "position" integer not null,
  "timestamp" timestamp with time zone not null,
  "elapsed_seconds" integer not null,
  "event_type" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamp with time zone not null default now());
alter table public.activity_timeline add primary key (id);
alter table public.activity_timeline enable row level security;
grant select,insert,update,delete on public.activity_timeline to authenticated;
create policy own_rows on public.activity_timeline to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.blocked_users (
  "id" uuid not null default gen_random_uuid(),
  "blocker_id" uuid not null,
  "blocked_id" uuid not null,
  "created_at" timestamp with time zone not null default now());
alter table public.blocked_users add primary key (id);
alter table public.blocked_users enable row level security;
grant select,insert,update,delete on public.blocked_users to authenticated;
create table public.circle_preferences (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "circle_member_id" uuid not null,
  "is_pinned" boolean not null default false,
  "notifications_enabled" boolean not null default true,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.circle_preferences add primary key (id);
alter table public.circle_preferences enable row level security;
grant select,insert,update,delete on public.circle_preferences to authenticated;
create policy own_rows on public.circle_preferences to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.circle_relationships (
  "id" uuid not null default gen_random_uuid(),
  "requester_id" uuid not null,
  "recipient_id" uuid not null,
  "status" text not null default 'PENDING'::text,
  "created_at" timestamp with time zone not null default now(),
  "accepted_at" timestamp with time zone);
alter table public.circle_relationships add primary key (id);
alter table public.circle_relationships enable row level security;
grant select,insert,update,delete on public.circle_relationships to authenticated;
create table public.club_member_preferences (
  "id" uuid not null default gen_random_uuid(),
  "club_id" uuid not null,
  "user_id" uuid not null,
  "notifications_enabled" boolean not null default true,
  "is_pinned" boolean not null default false,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.club_member_preferences add primary key (id);
alter table public.club_member_preferences enable row level security;
grant select,insert,update,delete on public.club_member_preferences to authenticated;
create policy own_rows on public.club_member_preferences to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.club_members (
  "id" uuid not null default gen_random_uuid(),
  "club_id" uuid not null,
  "user_id" uuid not null,
  "invited_by" uuid,
  "role" text not null default 'MEMBER'::text,
  "membership_status" text not null default 'PENDING'::text,
  "joined_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.club_members add primary key (id);
alter table public.club_members enable row level security;
grant select,insert,update,delete on public.club_members to authenticated;
create policy own_rows on public.club_members to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.clubs (
  "id" uuid not null default gen_random_uuid(),
  "owner_id" uuid not null,
  "name" text not null,
  "slug" text not null,
  "description" text,
  "category" text not null,
  "location_name" text not null,
  "logo_url" text,
  "cover_image_url" text,
  "visibility" text not null default 'PRIVATE'::text,
  "status" text not null default 'ACTIVE'::text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "default_location_id" uuid);
alter table public.clubs add primary key (id);
alter table public.clubs enable row level security;
grant select,insert,update,delete on public.clubs to authenticated;
create table public.connections (
  "id" uuid not null default gen_random_uuid(),
  "user_low_id" uuid not null,
  "user_high_id" uuid not null,
  "status" text not null default 'active'::text,
  "created_from_invitation_id" uuid,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "ended_at" timestamp with time zone);
alter table public.connections add primary key (id);
alter table public.connections enable row level security;
grant select,insert,update,delete on public.connections to authenticated;
create table public.invitations (
  "id" uuid not null default gen_random_uuid(),
  "inviter_id" uuid not null,
  "recipient_user_id" uuid,
  "recipient_email" text,
  "recipient_phone" text,
  "target_type" text not null default 'circle'::text,
  "target_id" uuid,
  "channel" text not null default 'in_app'::text,
  "token_hash" text,
  "status" text not null default 'pending'::text,
  "expires_at" timestamp with time zone,
  "accepted_by" uuid,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.invitations add primary key (id);
alter table public.invitations enable row level security;
grant select,insert,update,delete on public.invitations to authenticated;
create table public.moment_activities (
  "id" uuid not null default gen_random_uuid(),
  "moment_id" uuid not null,
  "activity_id" uuid not null,
  "added_by" uuid not null,
  "created_at" timestamp with time zone not null default now());
alter table public.moment_activities add primary key (id);
alter table public.moment_activities enable row level security;
grant select,insert,update,delete on public.moment_activities to authenticated;
create table public.moment_availability (
  "id" uuid not null default gen_random_uuid(),
  "date_option_id" uuid not null,
  "user_id" uuid not null,
  "availability_status" text not null default 'NO_RESPONSE'::text,
  "updated_at" timestamp with time zone not null default now());
alter table public.moment_availability add primary key (id);
alter table public.moment_availability enable row level security;
grant select,insert,update,delete on public.moment_availability to authenticated;
create policy own_rows on public.moment_availability to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.moment_date_options (
  "id" uuid not null default gen_random_uuid(),
  "moment_id" uuid not null,
  "start_at" timestamp with time zone not null,
  "end_at" timestamp with time zone,
  "location_name" text,
  "created_by" uuid not null,
  "is_selected" boolean not null default false,
  "created_at" timestamp with time zone not null default now(),
  "location_id" uuid);
alter table public.moment_date_options add primary key (id);
alter table public.moment_date_options enable row level security;
grant select,insert,update,delete on public.moment_date_options to authenticated;
create table public.moment_media (
  "id" uuid not null default gen_random_uuid(),
  "moment_id" uuid not null,
  "user_id" uuid not null,
  "media_type" text not null default 'PHOTO'::text,
  "file_path" text not null,
  "caption" text,
  "taken_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now());
alter table public.moment_media add primary key (id);
alter table public.moment_media enable row level security;
grant select,insert,update,delete on public.moment_media to authenticated;
create policy own_rows on public.moment_media to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.moment_participants (
  "id" uuid not null default gen_random_uuid(),
  "moment_id" uuid not null,
  "user_id" uuid not null,
  "role" text not null default 'PARTICIPANT'::text,
  "invitation_status" text not null default 'PENDING'::text,
  "participation_status" text not null default 'INVITED'::text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.moment_participants add primary key (id);
alter table public.moment_participants enable row level security;
grant select,insert,update,delete on public.moment_participants to authenticated;
create policy own_rows on public.moment_participants to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.moments (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "day_id" uuid,
  "mission_id" uuid,
  "title" text not null,
  "story" text,
  "emotion" text,
  "location_name" text,
  "latitude" numeric,
  "longitude" numeric,
  "visibility" text not null default 'PARTICIPANTS'::text,
  "created_at" timestamp with time zone default now(),
  "created_by" uuid not null,
  "club_id" uuid,
  "description" text,
  "moment_type" text not null default 'OTHER'::text,
  "status" text not null default 'PLANNING'::text,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone,
  "cover_image_url" text,
  "capacity" integer,
  "updated_at" timestamp with time zone not null default now(),
  "location_id" uuid);
alter table public.moments add primary key (id);
alter table public.moments enable row level security;
grant select,insert,update,delete on public.moments to authenticated;
create policy own_rows on public.moments to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.reactions (
  "id" uuid not null default gen_random_uuid(),
  "moment_id" uuid not null,
  "user_id" uuid not null,
  "reaction_type" text not null,
  "preset_message_id" uuid,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.reactions add primary key (id);
alter table public.reactions enable row level security;
grant select,insert,update,delete on public.reactions to authenticated;
create policy own_rows on public.reactions to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_equipment (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "category_id" uuid,
  "name" text not null,
  "brand" text,
  "model" text,
  "description" text,
  "photo_url" text,
  "purchase_date" date,
  "first_used_at" date,
  "retired_at" date,
  "active" boolean default true,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now());
alter table public.user_equipment add primary key (id);
alter table public.user_equipment enable row level security;
grant select,insert,update,delete on public.user_equipment to authenticated;
create policy own_rows on public.user_equipment to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_goals (
  "user_id" uuid not null,
  "primary_goal" text,
  "status" text not null default 'EMPTY'::text,
  "details" jsonb not null default '{}'::jsonb,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.user_goals add primary key (user_id);
alter table public.user_goals enable row level security;
grant select,insert,update,delete on public.user_goals to authenticated;
create policy own_rows on public.user_goals to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_locations (
  "user_id" uuid not null,
  "city" text,
  "country" text,
  "latitude" numeric,
  "longitude" numeric,
  "timezone" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now());
alter table public.user_locations add primary key (user_id);
alter table public.user_locations enable row level security;
grant select,insert,update,delete on public.user_locations to authenticated;
create policy own_rows on public.user_locations to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.user_missions (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "category" text not null,
  "subcategory" text,
  "title" text not null,
  "description" text,
  "sport" text,
  "distance_km" numeric,
  "target_time_seconds" integer,
  "target_pace_seconds_per_km" integer,
  "target_date" date,
  "status" text not null default 'active'::text,
  "story_note" text,
  "result_note" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "moved_to_history_at" timestamp with time zone,
  "duration_days" integer);
alter table public.user_missions add primary key (id);
alter table public.user_missions enable row level security;
grant select,insert,update,delete on public.user_missions to authenticated;
create policy own_rows on public.user_missions to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.wellbeing_profile (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "max_hr" integer,
  "resting_hr" integer,
  "vo2max" numeric,
  "preferred_sleep_hours" numeric,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now());
alter table public.wellbeing_profile add primary key (id);
alter table public.wellbeing_profile enable row level security;
grant select,insert,update,delete on public.wellbeing_profile to authenticated;
create policy own_rows on public.wellbeing_profile to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.equipment_categories ("id" uuid default gen_random_uuid(),"name" text,"slug" text,"order_index" integer default 0,"created_at" timestamp with time zone default now(),"icon" text);
alter table public.equipment_categories enable row level security;
grant select on public.equipment_categories to authenticated;

-- Storage metadata only; object bytes are simulated separately by the cleanup worker tests.
create schema storage;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,owner uuid,owner_id text,created_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select,insert,update,delete on storage.objects to authenticated;
create policy own_storage on storage.objects to authenticated using(coalesce(owner_id,owner::text)=auth.uid()::text) with check(coalesce(owner_id,owner::text)=auth.uid()::text);
alter table public.activity_media add constraint activity_media_activity_id_fkey foreign key(activity_id) references public.activities(id) on delete cascade;
alter table public.moment_media add constraint moment_media_moment_id_fkey foreign key(moment_id) references public.moments(id) on delete cascade;
