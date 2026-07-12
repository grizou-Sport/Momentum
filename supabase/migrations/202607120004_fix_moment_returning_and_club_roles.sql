-- MOMENTUM — Fix Moment INSERT RETURNING and secure Club role management

drop policy if exists "moments visible to authorized users" on public.moments;
create policy "moments visible to authorized users" on public.moments for select to authenticated
using (
  user_id = (select auth.uid())
  or created_by = (select auth.uid())
  or private.can_access_moment(id)
);

create or replace function private.guard_club_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  club_owner uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if new.club_id is distinct from old.club_id or new.user_id is distinct from old.user_id then
    raise exception 'Club and member identity cannot be changed';
  end if;

  select c.owner_id into club_owner from public.clubs c where c.id = old.club_id;
  select cm.role into actor_role
  from public.club_members cm
  where cm.club_id = old.club_id and cm.user_id = actor and cm.membership_status = 'ACCEPTED';

  if new.role is distinct from old.role then
    if actor_role not in ('OWNER','ADMIN') then
      raise exception 'Only Club owners and administrators can change roles';
    end if;
    if old.user_id = club_owner then
      raise exception 'The Club owner role cannot be changed';
    end if;
    if new.role = 'OWNER' then
      raise exception 'Ownership transfer is not available yet';
    end if;
  end if;

  if new.membership_status is distinct from old.membership_status
     and actor <> old.user_id
     and actor_role not in ('OWNER','ADMIN') then
    raise exception 'Only the member or a Club manager can change membership status';
  end if;

  if old.user_id = club_owner and new.membership_status <> 'ACCEPTED' then
    raise exception 'The Club owner cannot leave or be removed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_club_member_update() from public;
drop trigger if exists guard_club_member_update on public.club_members;
create trigger guard_club_member_update
before update on public.club_members
for each row execute function private.guard_club_member_update();
