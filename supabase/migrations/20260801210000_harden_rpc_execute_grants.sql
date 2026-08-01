-- Harden RPC EXECUTE: helper/trigger functions are not public API for anon.
-- Keep touch_system_keepalive executable by anon (Worker Keepalive with Token).
-- Keep mark_profile_active_on_login for authenticated only (already granted).

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_role() from anon;
grant execute on function public.current_user_role() to authenticated, service_role;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.enforce_profile_privilege_guard() from public;
revoke all on function public.enforce_profile_privilege_guard() from anon;
revoke all on function public.enforce_profile_privilege_guard() from authenticated;
grant execute on function public.enforce_profile_privilege_guard() to service_role;

revoke all on function public.mark_profile_active_on_login() from public;
revoke all on function public.mark_profile_active_on_login() from anon;
grant execute on function public.mark_profile_active_on_login() to authenticated, service_role;
