-- Commission 1.0 workflow extensions: assignment versions, bonus payments, payment history

create table if not exists public.commission_assignment_versions (
  id text primary key,
  assignment_id text not null,
  sales_representative_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists commission_assignment_versions_assignment_idx
  on public.commission_assignment_versions (assignment_id);

create index if not exists commission_assignment_versions_rep_idx
  on public.commission_assignment_versions (sales_representative_id);

create table if not exists public.commission_bonus_payments (
  id text primary key,
  sales_representative_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_bonus_payments_rep_idx
  on public.commission_bonus_payments (sales_representative_id);

create table if not exists public.commission_payment_history (
  id text primary key,
  case_id text not null,
  sales_representative_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists commission_payment_history_case_idx
  on public.commission_payment_history (case_id);

create index if not exists commission_payment_history_rep_idx
  on public.commission_payment_history (sales_representative_id);

alter table public.commission_assignment_versions enable row level security;
alter table public.commission_bonus_payments enable row level security;
alter table public.commission_payment_history enable row level security;

drop policy if exists commission_assignment_versions_select on public.commission_assignment_versions;
create policy commission_assignment_versions_select on public.commission_assignment_versions
  for select to authenticated
  using (public.is_admin() or sales_representative_id = public.current_user_id());

drop policy if exists commission_assignment_versions_admin on public.commission_assignment_versions;
create policy commission_assignment_versions_admin on public.commission_assignment_versions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists commission_bonus_payments_select on public.commission_bonus_payments;
create policy commission_bonus_payments_select on public.commission_bonus_payments
  for select to authenticated
  using (public.is_admin() or sales_representative_id = public.current_user_id());

drop policy if exists commission_bonus_payments_admin on public.commission_bonus_payments;
create policy commission_bonus_payments_admin on public.commission_bonus_payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists commission_payment_history_select on public.commission_payment_history;
create policy commission_payment_history_select on public.commission_payment_history
  for select to authenticated
  using (public.is_admin() or sales_representative_id = public.current_user_id());

drop policy if exists commission_payment_history_admin on public.commission_payment_history;
create policy commission_payment_history_admin on public.commission_payment_history
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
