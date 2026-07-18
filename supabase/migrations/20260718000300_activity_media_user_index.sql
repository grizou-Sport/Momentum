-- MOMENTUM 1.09 — cover the activity_media user foreign key.

create index if not exists activity_media_user_idx
  on public.activity_media(user_id);
