-- invited → active via mark_profile_active_on_login was blocked by enforce_profile_privilege_guard
-- for non-admin users (status change guard fired on RPC update).

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

  perform set_config('app.profile_activation', '1', true);

  update public.profiles
  set
    status = case when status = 'invited' then 'active' else status end,
    deactivated_at = case when status = 'invited' then null else deactivated_at end,
    last_access_at = now(),
    updated_at = now()
  where user_id = auth.uid()
    and status in ('invited', 'active')
  returning * into result;

  perform set_config('app.profile_activation', '', true);

  if result.user_id is null then
    raise exception 'profile not available' using errcode = '42501';
  end if;

  return result;
end;
$$;

create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.profile_activation', true) = '1' then
    return new;
  end if;

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

revoke all on function public.mark_profile_active_on_login() from public;
revoke all on function public.mark_profile_active_on_login() from anon;
grant execute on function public.mark_profile_active_on_login() to authenticated, service_role;
