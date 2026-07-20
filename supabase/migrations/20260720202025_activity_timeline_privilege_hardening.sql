-- MOMENTUM — Lot B.1: least-privilege Data API access.
-- Project-level default privileges may grant table operations that are not
-- constrained by RLS. The browser only needs CRUD through the owner policies.

revoke all privileges on table public.activity_timeline
  from anon, authenticated;

grant select, insert, update, delete
  on table public.activity_timeline
  to authenticated;
