-- Login-Aktivierung invited → active + last_access_at
-- Nicht-Admins dürfen Rolle/Status nicht selbst ändern (Admin-Mutationen primär über Worker/Service-Role)

create or replace function public.mark_profile_active_on_login()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.profiles
  set
    status = case when status = 'invited' then 'active' else status end,
    deactivated_at = case when status = 'invited' then null else deactivated_at end,
    last_access_at = now(),
    updated_at = now()
  where user_id = auth.uid()
    and status in ('invited', 'active')
  returning * into result;

  if result.user_id is null then
    raise exception 'profile not available' using errcode = '42501';
  end if;

  return result;
end;
$$;

revoke all on function public.mark_profile_active_on_login() from public;
grant execute on function public.mark_profile_active_on_login() to authenticated;

create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.role is distinct from old.role
       or new.status is distinct from old.status
     )
     and not public.is_admin()
     and auth.uid() is not null
  then
    raise exception 'role/status change not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privilege_guard on public.profiles;
create trigger profiles_privilege_guard
  before update on public.profiles
  for each row
  execute function public.enforce_profile_privilege_guard();
