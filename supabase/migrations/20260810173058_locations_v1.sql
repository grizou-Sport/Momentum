-- MOMENTUM — Lieux & adresses V1
-- Geoapify aide à découvrir un lieu. MOMENTUM reste propriétaire du modèle.

create extension if not exists pgcrypto;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text,
  postal_code text,
  city text,
  country text,
  country_code text check (country_code is null or country_code ~ '^[A-Za-z]{2}$'),
  latitude numeric check (latitude is null or latitude between -90 and 90),
  longitude numeric check (longitude is null or longitude between -180 and 180),
  source text not null default 'manual' check (source in ('geoapify', 'manual')),
  provider_place_id text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility = 'private' and owner_user_id is not null)
    or (visibility = 'public' and owner_user_id is null)
  )
);

create index if not exists locations_owner_search_idx
  on public.locations(owner_user_id, lower(name))
  where visibility = 'private';

create index if not exists locations_public_search_idx
  on public.locations(lower(name), lower(city), lower(country_code))
  where visibility = 'public';

create index if not exists locations_created_by_idx
  on public.locations(created_by);

create unique index if not exists locations_public_provider_place_idx
  on public.locations(provider_place_id)
  where visibility = 'public' and provider_place_id is not null;

create unique index if not exists locations_public_identity_idx
  on public.locations(
    lower(btrim(name)),
    lower(btrim(coalesce(address, ''))),
    lower(btrim(coalesce(postal_code, ''))),
    lower(btrim(coalesce(city, ''))),
    lower(btrim(coalesce(country_code, '')))
  )
  where visibility = 'public';

alter table public.locations enable row level security;

create policy "Users read public and own private locations"
  on public.locations for select to authenticated
  using (
    visibility = 'public'
    or (visibility = 'private' and owner_user_id = (select auth.uid()))
  );

create policy "Users create locations intentionally"
  on public.locations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (visibility = 'private' and owner_user_id = (select auth.uid()))
      or (visibility = 'public' and owner_user_id is null)
    )
  );

create policy "Creators update their allowed locations"
  on public.locations for update to authenticated
  using (
    (visibility = 'private' and owner_user_id = (select auth.uid()))
    or (visibility = 'public' and created_by = (select auth.uid()))
  )
  with check (
    created_by = (select auth.uid())
    and (
      (visibility = 'private' and owner_user_id = (select auth.uid()))
      or (visibility = 'public' and owner_user_id is null)
    )
  );

create policy "Creators delete their allowed locations"
  on public.locations for delete to authenticated
  using (
    (visibility = 'private' and owner_user_id = (select auth.uid()))
    or (visibility = 'public' and created_by = (select auth.uid()))
  );

grant select, insert, update, delete on public.locations to authenticated;

create or replace function public.search_locations(
  search_term text,
  result_limit integer default 10
)
returns table (
  id uuid,
  name text,
  address text,
  postal_code text,
  city text,
  country text,
  country_code text,
  latitude numeric,
  longitude numeric,
  source text,
  provider_place_id text,
  visibility text,
  owner_user_id uuid,
  created_by uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    location.id,
    location.name,
    location.address,
    location.postal_code,
    location.city,
    location.country,
    location.country_code,
    location.latitude,
    location.longitude,
    location.source,
    location.provider_place_id,
    location.visibility,
    location.owner_user_id,
    location.created_by
  from public.locations as location
  where char_length(btrim(search_term)) >= 2
    and (
      location.name ilike '%' || btrim(search_term) || '%'
      or coalesce(location.address, '') ilike '%' || btrim(search_term) || '%'
      or coalesce(location.city, '') ilike '%' || btrim(search_term) || '%'
    )
  order by
    case
      when location.visibility = 'private' and location.owner_user_id = (select auth.uid()) then 0
      else 1
    end,
    case when lower(location.name) = lower(btrim(search_term)) then 0 else 1 end,
    location.name
  limit least(greatest(coalesce(result_limit, 10), 1), 20);
$$;

revoke all on function public.search_locations(text, integer) from public, anon;
grant execute on function public.search_locations(text, integer) to authenticated;

alter table public.activities
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.moments
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.moment_date_options
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.clubs
  add column if not exists default_location_id uuid references public.locations(id) on delete set null;

create index if not exists activities_location_id_idx on public.activities(location_id);
create index if not exists moments_location_id_idx on public.moments(location_id);
create index if not exists moment_date_options_location_id_idx on public.moment_date_options(location_id);
create index if not exists clubs_default_location_id_idx on public.clubs(default_location_id);

comment on table public.locations is
  'Référentiel MOMENTUM des lieux privés et publics, indépendant du fournisseur de géocodage.';
comment on column public.activities.location_name is
  'Libellé historique conservé pour rétrocompatibilité; préférer location_id pour les nouveaux enregistrements.';
comment on column public.moments.location_name is
  'Libellé historique conservé pour rétrocompatibilité; préférer location_id pour les nouveaux enregistrements.';
