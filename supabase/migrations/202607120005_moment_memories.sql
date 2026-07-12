-- MOMENTUM — Moment memories: activities, photos and positive reactions

create table if not exists public.moment_activities (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (moment_id, activity_id)
);

create table if not exists public.moment_media (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null default 'PHOTO' check (media_type in ('PHOTO')),
  file_path text not null,
  caption text check (caption is null or char_length(caption) <= 240),
  taken_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.preset_messages (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  language text not null default 'fr',
  category text not null default 'ENCOURAGEMENT',
  is_active boolean not null default true,
  display_order integer not null default 0,
  unique (language, label)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('HEART','APPLAUSE','FIRE','SPARKLES','MOUNTAIN','TENNIS','COFFEE','MESSAGE')),
  preset_message_id uuid references public.preset_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (moment_id, user_id)
);

insert into public.preset_messages (label, display_order) values
  ('Magnifique !', 10), ('Bravo !', 20), ('Belle sortie !', 30),
  ('Ça donne envie.', 40), ('À refaire !', 50), ('Merci du partage.', 60)
on conflict (language, label) do update set display_order = excluded.display_order, is_active = true;

create index if not exists moment_activities_activity_idx on public.moment_activities(activity_id);
create index if not exists moment_activities_added_by_idx on public.moment_activities(added_by);
create index if not exists moment_media_moment_idx on public.moment_media(moment_id, created_at desc);
create index if not exists moment_media_user_idx on public.moment_media(user_id);
create index if not exists reactions_moment_idx on public.reactions(moment_id, created_at desc);
create index if not exists reactions_user_idx on public.reactions(user_id);
create index if not exists reactions_preset_idx on public.reactions(preset_message_id) where preset_message_id is not null;

alter table public.moment_activities enable row level security;
alter table public.moment_media enable row level security;
alter table public.preset_messages enable row level security;
alter table public.reactions enable row level security;

create policy "moment activities visible to participants" on public.moment_activities for select to authenticated
using (private.can_access_moment(moment_id));
create policy "participants link own activities" on public.moment_activities for insert to authenticated
with check (
  added_by = (select auth.uid()) and private.can_access_moment(moment_id)
  and exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid()))
);
create policy "users unlink own activities" on public.moment_activities for delete to authenticated
using (added_by = (select auth.uid()) or private.can_manage_moment(moment_id));

create policy "shared linked activities are visible" on public.activities for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.moment_activities ma
    where ma.activity_id = activities.id and private.can_access_moment(ma.moment_id)
  )
);

create policy "moment photos visible to participants" on public.moment_media for select to authenticated
using (private.can_access_moment(moment_id));
create policy "participants add photos" on public.moment_media for insert to authenticated
with check (user_id = (select auth.uid()) and private.can_access_moment(moment_id));
create policy "authors delete photos" on public.moment_media for delete to authenticated
using (user_id = (select auth.uid()) or private.can_manage_moment(moment_id));

create policy "preset messages are readable" on public.preset_messages for select to authenticated
using (is_active = true);

create policy "reactions visible within moment" on public.reactions for select to authenticated
using (private.can_access_moment(moment_id));
create policy "participants add reactions" on public.reactions for insert to authenticated
with check (user_id = (select auth.uid()) and private.can_access_moment(moment_id));
create policy "users update own reactions" on public.reactions for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.can_access_moment(moment_id));
create policy "users delete own reactions" on public.reactions for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, delete on public.moment_activities, public.moment_media to authenticated;
grant select on public.preset_messages to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moment-media', 'moment-media', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "participants read moment media" on storage.objects for select to authenticated
using (
  bucket_id = 'moment-media' and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.can_access_moment(((storage.foldername(name))[1])::uuid)
    else false end
);
create policy "participants upload moment media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'moment-media' and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.can_access_moment(((storage.foldername(name))[1])::uuid)
    else false end
);
create policy "authors delete moment media" on storage.objects for delete to authenticated
using (bucket_id = 'moment-media' and owner_id = (select auth.uid()::text));
