-- MOMENTUM — FLOW V1: user-reported experience attached to an activity.

create table if not exists public.activity_flow_assessments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  perceived_exertion smallint not null check (perceived_exertion between 1 and 10),
  perceived_challenge smallint not null check (perceived_challenge between 1 and 10),
  perceived_mastery smallint not null check (perceived_mastery between 1 and 10),
  analysis_context jsonb not null default '{}'::jsonb check (jsonb_typeof(analysis_context) = 'object'),
  assessment_version smallint not null default 1 check (assessment_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists activity_flow_assessments_user_updated_idx
  on public.activity_flow_assessments(user_id, updated_at desc);

alter table public.activity_flow_assessments enable row level security;

create policy "Users read own flow assessments"
  on public.activity_flow_assessments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create own flow assessments"
  on public.activity_flow_assessments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users update own flow assessments"
  on public.activity_flow_assessments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users delete own flow assessments"
  on public.activity_flow_assessments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.activity_flow_assessments to authenticated;

drop trigger if exists set_activity_flow_assessments_updated_at on public.activity_flow_assessments;
create trigger set_activity_flow_assessments_updated_at
  before update on public.activity_flow_assessments
  for each row execute function public.set_updated_at();
