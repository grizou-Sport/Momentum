-- MOMENTUM — Evolutive Passport foundation for Progression
alter table public.passports add column if not exists birth_date date;
alter table public.passports add column if not exists sex text;
alter table public.passports add column if not exists sport_level text;
alter table public.passports add column if not exists habits jsonb not null default '{}'::jsonb;
alter table public.passports add column if not exists objectives jsonb not null default '{}'::jsonb;
alter table public.passports add column if not exists connected_sources jsonb not null default '{}'::jsonb;
alter table public.passports add column if not exists personalization jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='passports_sex_check') then
    alter table public.passports add constraint passports_sex_check check (sex is null or sex in ('FEMALE','MALE','OTHER','UNDISCLOSED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='passports_sport_level_check') then
    alter table public.passports add constraint passports_sport_level_check check (sport_level is null or sport_level in ('BEGINNER','RETURNING','REGULAR','COMPETITOR','EXPERT'));
  end if;
  if not exists (select 1 from pg_constraint where conname='passports_habits_object_check') then
    alter table public.passports add constraint passports_habits_object_check check (jsonb_typeof(habits)='object');
  end if;
  if not exists (select 1 from pg_constraint where conname='passports_objectives_object_check') then
    alter table public.passports add constraint passports_objectives_object_check check (jsonb_typeof(objectives)='object');
  end if;
  if not exists (select 1 from pg_constraint where conname='passports_sources_object_check') then
    alter table public.passports add constraint passports_sources_object_check check (jsonb_typeof(connected_sources)='object');
  end if;
  if not exists (select 1 from pg_constraint where conname='passports_personalization_object_check') then
    alter table public.passports add constraint passports_personalization_object_check check (jsonb_typeof(personalization)='object');
  end if;
end $$;
