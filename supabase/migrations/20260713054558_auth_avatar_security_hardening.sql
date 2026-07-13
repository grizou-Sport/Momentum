-- MOMENTUM — Targeted authentication and avatar security hardening.

-- This maintenance helper must never be callable through the public API roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Pin the trigger helper's lookup path to avoid mutable search_path resolution.
alter function public.set_updated_at() set search_path = '';

-- The avatars bucket remains public, so public object URLs continue to work.
-- Removing this policy prevents anonymous users from listing storage.objects.
drop policy if exists "Avatar images are publicly readable" on storage.objects;

-- An authenticated user may only update objects inside their own folder.
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
