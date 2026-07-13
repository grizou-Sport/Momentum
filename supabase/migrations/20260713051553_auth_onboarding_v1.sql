-- MOMENTUM — Authentication and Adventure Passport onboarding v1.0

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  units text not null default 'METRIC' check (units in ('METRIC', 'IMPERIAL')),
  language text not null default 'fr',
  theme text not null default 'SYSTEM' check (theme in ('LIGHT', 'DARK', 'SYSTEM')),
  notifications jsonb not null default '{"email":true,"push":true,"adventure_reminders":true}'::jsonb check (jsonb_typeof(notifications) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_goal text,
  status text not null default 'EMPTY' check (status in ('EMPTY', 'INITIAL', 'ACTIVE')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_sport_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience_code text,
  weekly_hours_range text,
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array'),
  watch_provider text,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  city text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_load_estimates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chronic_load numeric,
  weekly_hours numeric,
  experience_level text,
  sport_distribution jsonb not null default '{}'::jsonb check (jsonb_typeof(sport_distribution) = 'object'),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  source text not null default 'EMPTY' check (source in ('EMPTY', 'ONBOARDING', 'LEARNING', 'ACTIVITIES')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step smallint not null default 1 check (current_step between 1 and 5),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_goals enable row level security;
alter table public.user_sport_preferences enable row level security;
alter table public.user_locations enable row level security;
alter table public.user_load_estimates enable row level security;
alter table public.onboarding_progress enable row level security;

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','user_settings','user_goals','user_sport_preferences','user_locations','user_load_estimates','onboarding_progress']
  loop
    execute format('drop policy if exists "Users manage own %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "Users manage own %1$s" on public.%1$I for all to authenticated using ((select auth.uid()) = %2$I) with check ((select auth.uid()) = %2$I)',
      table_name,
      case when table_name = 'profiles' then 'id' else 'user_id' end
    );
  end loop;
end
$policies$;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.user_goals to authenticated;
grant select, insert, update, delete on public.user_sport_preferences to authenticated;
grant select, insert, update, delete on public.user_locations to authenticated;
grant select, insert, update, delete on public.user_load_estimates to authenticated;
grant select, insert, update, delete on public.onboarding_progress to authenticated;

create or replace function private.initialize_momentum_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.passports (user_id, display_name, quote, country, personalization)
  values (new.id, null, 'Écris la prochaine ligne.', null, '{"onboarding_completed":false}'::jsonb)
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_goals (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_sport_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_locations (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_load_estimates (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.onboarding_progress (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.wellbeing_profile (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.initialize_momentum_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.initialize_momentum_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
insert into public.user_settings (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_goals (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_sport_preferences (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_locations (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_load_estimates (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.onboarding_progress (user_id, current_step, completed_at)
select u.id, case when coalesce((p.personalization->>'onboarding_completed')::boolean, false) then 5 else 1 end,
  case when coalesce((p.personalization->>'onboarding_completed')::boolean, false) then now() else null end
from auth.users u left join public.passports p on p.user_id = u.id
on conflict (user_id) do nothing;
insert into public.wellbeing_profile (user_id) select id from auth.users on conflict (user_id) do nothing;

insert into public.sports (name, order_index)
select 'Ski de randonnée', 145
where not exists (select 1 from public.sports where lower(name) = lower('Ski de randonnée'));
