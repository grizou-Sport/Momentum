-- MOMENTUM — Lot B.1: factual activity timeline.
-- The FIT file remains the source of truth. This table is a stable,
-- chronological projection of objective events only.

create table if not exists public.activity_timeline (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null check (position >= 0),
  timestamp timestamptz not null,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  event_type text not null check (
    event_type in (
      'start',
      'finish',
      'pause',
      'resume',
      'lap',
      'gps_lost',
      'gps_recovered',
      'fit_event'
    )
  ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (activity_id, position)
);

create index if not exists activity_timeline_activity_chronology_idx
  on public.activity_timeline(activity_id, timestamp, position);

create index if not exists activity_timeline_user_idx
  on public.activity_timeline(user_id, activity_id);

alter table public.activity_timeline enable row level security;

create policy "Users read own activity timeline"
  on public.activity_timeline for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create own activity timeline"
  on public.activity_timeline for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users update own activity timeline"
  on public.activity_timeline for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.activities
      where activities.id = activity_id
        and activities.user_id = (select auth.uid())
    )
  );

create policy "Users delete own activity timeline"
  on public.activity_timeline for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.activity_timeline to authenticated;

-- Existing Lot A activities receive only the objective boundaries already
-- stored in their normalized payload. to_jsonb keeps this migration safe on
-- historical local schemas where those optional columns are not present.
insert into public.activity_timeline (
  activity_id,
  user_id,
  position,
  timestamp,
  elapsed_seconds,
  event_type,
  metadata
)
select
  activity.id,
  activity.user_id,
  boundary.position,
  boundary.timestamp,
  boundary.elapsed_seconds,
  boundary.event_type,
  jsonb_build_object('source', 'lot_a_activity')
from public.activities as activity
cross join lateral (
  values
    (
      0,
      nullif(to_jsonb(activity) ->> 'started_at', '')::timestamptz,
      0,
      'start'
    ),
    (
      1,
      nullif(to_jsonb(activity) ->> 'ended_at', '')::timestamptz,
      greatest(
        0,
        coalesce(
          nullif(to_jsonb(activity) ->> 'total_duration_seconds', '')::integer,
          extract(epoch from (
            nullif(to_jsonb(activity) ->> 'ended_at', '')::timestamptz
            - nullif(to_jsonb(activity) ->> 'started_at', '')::timestamptz
          ))::integer,
          0
        )
      ),
      'finish'
    )
) as boundary(position, timestamp, elapsed_seconds, event_type)
where boundary.timestamp is not null
on conflict (activity_id, position) do nothing;
