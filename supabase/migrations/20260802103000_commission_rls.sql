-- Commission RLS: vollständige Zeilenebenen-Sicherheit für alle Provisions-Tabellen
-- Additiv, idempotent, keine Datenänderungen

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

create or replace function public.is_active_commission_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'
  );
$$;

create or replace function public.can_access_commission_case(p_case_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.commission_cases c
      where c.id = p_case_id
        and c.sales_representative_id = auth.uid()::text
    );
$$;

create or replace function public.owns_commission_rep(p_rep_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or p_rep_id = auth.uid()::text;
$$;

revoke all on function public.is_active_commission_user() from public;
revoke all on function public.is_active_commission_user() from anon;
grant execute on function public.is_active_commission_user() to authenticated, service_role;

revoke all on function public.can_access_commission_case(text) from public;
revoke all on function public.can_access_commission_case(text) from anon;
grant execute on function public.can_access_commission_case(text) to authenticated, service_role;

revoke all on function public.owns_commission_rep(text) from public;
revoke all on function public.owns_commission_rep(text) from anon;
grant execute on function public.owns_commission_rep(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Indizes für Owner-Lookups
-- ---------------------------------------------------------------------------

create index if not exists commission_cases_rep_idx on public.commission_cases (sales_representative_id);

-- ---------------------------------------------------------------------------
-- Grants: anonym kein Zugriff
-- ---------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'commission_plans',
    'commission_plan_versions',
    'commission_rules',
    'commission_assignments',
    'commission_assignment_versions',
    'commission_calculations',
    'commission_cases',
    'commission_events',
    'commission_bonus_payments',
    'commission_payment_history'
  ]
  loop
    execute format('revoke all on public.%I from anon', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS aktivieren
-- ---------------------------------------------------------------------------

alter table public.commission_plans enable row level security;
alter table public.commission_plan_versions enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_assignments enable row level security;
alter table public.commission_assignment_versions enable row level security;
alter table public.commission_calculations enable row level security;
alter table public.commission_cases enable row level security;
alter table public.commission_events enable row level security;
alter table public.commission_bonus_payments enable row level security;
alter table public.commission_payment_history enable row level security;

-- ---------------------------------------------------------------------------
-- Katalog: nur Administrator
-- ---------------------------------------------------------------------------

drop policy if exists commission_plans_select on public.commission_plans;
drop policy if exists commission_plans_admin on public.commission_plans;
create policy commission_plans_admin on public.commission_plans
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

drop policy if exists commission_plan_versions_select on public.commission_plan_versions;
drop policy if exists commission_plan_versions_admin on public.commission_plan_versions;
create policy commission_plan_versions_admin on public.commission_plan_versions
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

drop policy if exists commission_rules_select on public.commission_rules;
drop policy if exists commission_rules_admin on public.commission_rules;
create policy commission_rules_admin on public.commission_rules
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Zuordnungen
-- ---------------------------------------------------------------------------

drop policy if exists commission_assignments_select on public.commission_assignments;
create policy commission_assignments_select on public.commission_assignments
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.owns_commission_rep(sales_representative_id)
  );

drop policy if exists commission_assignments_admin on public.commission_assignments;
create policy commission_assignments_admin on public.commission_assignments
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

drop policy if exists commission_assignment_versions_select on public.commission_assignment_versions;
create policy commission_assignment_versions_select on public.commission_assignment_versions
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.owns_commission_rep(sales_representative_id)
  );

drop policy if exists commission_assignment_versions_admin on public.commission_assignment_versions;
create policy commission_assignment_versions_admin on public.commission_assignment_versions
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Berechnungen und Fälle: Außendienst nur lesen, Admin schreibt
-- ---------------------------------------------------------------------------

drop policy if exists commission_calculations_select on public.commission_calculations;
create policy commission_calculations_select on public.commission_calculations
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.owns_commission_rep(sales_representative_id)
  );

drop policy if exists commission_calculations_mutate on public.commission_calculations;
drop policy if exists commission_calculations_admin on public.commission_calculations;
create policy commission_calculations_admin on public.commission_calculations
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

drop policy if exists commission_cases_select on public.commission_cases;
create policy commission_cases_select on public.commission_cases
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.owns_commission_rep(sales_representative_id)
  );

drop policy if exists commission_cases_mutate on public.commission_cases;
drop policy if exists commission_cases_admin on public.commission_cases;
create policy commission_cases_admin on public.commission_cases
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Events: Außendienst liest eigene Fälle, nur Admin schreibt
-- ---------------------------------------------------------------------------

drop policy if exists commission_events_select on public.commission_events;
create policy commission_events_select on public.commission_events
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.can_access_commission_case(case_id)
  );

drop policy if exists commission_events_insert on public.commission_events;
drop policy if exists commission_events_admin on public.commission_events;
create policy commission_events_admin on public.commission_events
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

-- ---------------------------------------------------------------------------
-- Sonderzahlungen und Zahlungshistorie
-- ---------------------------------------------------------------------------

drop policy if exists commission_bonus_payments_select on public.commission_bonus_payments;
create policy commission_bonus_payments_select on public.commission_bonus_payments
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.owns_commission_rep(sales_representative_id)
  );

drop policy if exists commission_bonus_payments_admin on public.commission_bonus_payments;
create policy commission_bonus_payments_admin on public.commission_bonus_payments
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());

drop policy if exists commission_payment_history_select on public.commission_payment_history;
create policy commission_payment_history_select on public.commission_payment_history
  for select to authenticated
  using (
    public.is_active_commission_user()
    and public.owns_commission_rep(sales_representative_id)
  );

drop policy if exists commission_payment_history_admin on public.commission_payment_history;
create policy commission_payment_history_admin on public.commission_payment_history
  for all to authenticated
  using (public.is_active_commission_user() and public.is_admin())
  with check (public.is_active_commission_user() and public.is_admin());
