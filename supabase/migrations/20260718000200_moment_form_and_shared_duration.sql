-- MOMENTUM 1.09 — unified Moment form, official RPE and activity photos.

alter table public.activities
  add column if not exists activity_time time;

alter table public.activity_flow_assessments
  add column if not exists retained_memory text
  check (retained_memory is null or char_length(retained_memory) <= 2000);

-- Preserve a historical FLOW effort only when the activity had no official RPE.
update public.activities as activity
set rpe = assessment.perceived_exertion
from public.activity_flow_assessments as assessment
where assessment.activity_id = activity.id
  and activity.rpe is null;

-- activities.rpe is the only source of truth from 1.09 onward.
alter table public.activity_flow_assessments
  drop column if exists perceived_exertion;

create table if not exists public.activity_media (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null default 'PHOTO' check (media_type = 'PHOTO'),
  file_path text not null unique,
  caption text check (caption is null or char_length(caption) <= 240),
  created_at timestamptz not null default now()
);

create index if not exists activity_media_activity_idx
  on public.activity_media(activity_id, created_at desc);

alter table public.activity_media enable row level security;

create policy "Users read own activity media"
  on public.activity_media for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add own activity media"
  on public.activity_media for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users delete own activity media"
  on public.activity_media for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.activity_media to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-media', 'activity-media', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read own activity photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'activity-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users upload own activity photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'activity-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users delete own activity photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'activity-media'
    and owner_id = (select auth.uid()::text)
  );
