-- Operative Domains für Version 1.0: eine produktive Supabase-Wahrheit
-- Additive Migration – keine destruktiven Operationen

-- ---------------------------------------------------------------------------
-- RLS-Hilfsfunktionen
-- ---------------------------------------------------------------------------

create or replace function public.is_active_user()
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
      and p.status in ('active', 'invited')
  );
$$;

create or replace function public.can_access_lead(p_lead_id text)
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
      from public.leads l
      where l.id = p_lead_id
        and (
          l.assigned_sales_user_id = auth.uid()::text
          or l.created_by_user_id = auth.uid()::text
        )
    );
$$;

create or replace function public.can_access_offer(p_offer_id text)
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
      from public.offers o
      where o.id = p_offer_id
        and (
          o.created_by_user_id = auth.uid()::text
          or public.can_access_lead(o.lead_id)
        )
    );
$$;

create or replace function public.can_access_contract(p_contract_id text)
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
      from public.contracts c
      where c.id = p_contract_id
        and (
          c.owner_user_id = auth.uid()::text
          or c.created_by_user_id = auth.uid()::text
          or public.can_access_lead(c.lead_id)
        )
    );
$$;

create or replace function public.can_access_activation(p_activation_id text)
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
      from public.activation_cases a
      where a.id = p_activation_id
        and (
          a.owner_user_id = auth.uid()::text
          or a.created_by_user_id = auth.uid()::text
          or public.can_access_lead(a.lead_id)
        )
    );
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.is_active_user() from anon;
grant execute on function public.is_active_user() to authenticated, service_role;

revoke all on function public.can_access_lead(text) from public;
revoke all on function public.can_access_lead(text) from anon;
grant execute on function public.can_access_lead(text) to authenticated, service_role;

revoke all on function public.can_access_offer(text) from public;
revoke all on function public.can_access_offer(text) from anon;
grant execute on function public.can_access_offer(text) to authenticated, service_role;

revoke all on function public.can_access_contract(text) from public;
revoke all on function public.can_access_contract(text) from anon;
grant execute on function public.can_access_contract(text) to authenticated, service_role;

revoke all on function public.can_access_activation(text) from public;
revoke all on function public.can_access_activation(text) from anon;
grant execute on function public.can_access_activation(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Angebote & Workflow
-- ---------------------------------------------------------------------------

create table if not exists public.offers (
  id text primary key,
  lead_id text not null references public.leads (id) on delete restrict,
  created_by_user_id text not null,
  offer_number text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offers_number_uidx on public.offers (offer_number);
create index if not exists offers_lead_idx on public.offers (lead_id);
create index if not exists offers_owner_idx on public.offers (created_by_user_id);

create table if not exists public.offer_versions (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  lead_id text not null,
  version_number integer not null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offer_versions_offer_idx on public.offer_versions (offer_id);
create unique index if not exists offer_versions_offer_version_uidx on public.offer_versions (offer_id, version_number);

create table if not exists public.offer_workflow_events (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  event_type text not null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists offer_workflow_events_offer_idx on public.offer_workflow_events (offer_id, created_at);

create table if not exists public.offer_documents (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offer_documents_offer_idx on public.offer_documents (offer_id);

create table if not exists public.sales_documents (
  id text primary key,
  offer_id text null references public.offers (id) on delete set null,
  contract_id text null,
  activation_id text null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists sales_documents_offer_idx on public.sales_documents (offer_id);
create index if not exists sales_documents_contract_idx on public.sales_documents (contract_id);

-- ---------------------------------------------------------------------------
-- Pricing & Commission Catalog
-- ---------------------------------------------------------------------------

create table if not exists public.price_books (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_book_versions (
  id text primary key,
  price_book_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_terms (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_rules (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_evaluations (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_evaluations_offer_idx on public.pricing_evaluations (offer_id);

create table if not exists public.commission_plans (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_plan_versions (
  id text primary key,
  plan_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_rules (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_assignments (
  id text primary key,
  sales_representative_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_assignments_rep_idx on public.commission_assignments (sales_representative_id);

create table if not exists public.commission_calculations (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  sales_representative_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_calculations_offer_idx on public.commission_calculations (offer_id);
create index if not exists commission_calculations_rep_idx on public.commission_calculations (sales_representative_id);

create table if not exists public.commission_cases (
  id text primary key,
  offer_id text not null references public.offers (id) on delete cascade,
  sales_representative_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_cases_offer_idx on public.commission_cases (offer_id);

create table if not exists public.commission_events (
  id text primary key,
  case_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists commission_events_case_idx on public.commission_events (case_id);

-- ---------------------------------------------------------------------------
-- Recommendation & Beratung
-- ---------------------------------------------------------------------------

create table if not exists public.recommendation_records (
  id text primary key,
  lead_id text null,
  offer_id text null references public.offers (id) on delete set null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recommendation_records_lead_idx on public.recommendation_records (lead_id);
create index if not exists recommendation_records_offer_idx on public.recommendation_records (offer_id);

create table if not exists public.recommendation_weight_sets (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.best_pay_comparison_sessions (
  id text primary key,
  created_by_user_id text not null,
  lead_id text null references public.leads (id) on delete set null,
  offer_id text null references public.offers (id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists best_pay_sessions_owner_idx on public.best_pay_comparison_sessions (created_by_user_id);
create index if not exists best_pay_sessions_lead_idx on public.best_pay_comparison_sessions (lead_id);

create table if not exists public.user_active_sessions (
  user_id text primary key,
  comparison_session_id text null references public.best_pay_comparison_sessions (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Billing Import (Metadaten, keine Binärdaten)
-- ---------------------------------------------------------------------------

create table if not exists public.billing_import_sessions (
  id text primary key,
  lead_id text null references public.leads (id) on delete set null,
  offer_id text null references public.offers (id) on delete set null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_import_sessions_lead_idx on public.billing_import_sessions (lead_id);

create table if not exists public.billing_source_documents (
  id text primary key,
  session_id text not null references public.billing_import_sessions (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_extracted_fields (
  id text primary key,
  session_id text not null references public.billing_import_sessions (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_period_records (
  id text primary key,
  session_id text not null references public.billing_import_sessions (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_cost_baselines (
  id text primary key,
  lead_id text null references public.leads (id) on delete set null,
  session_id text null references public.billing_import_sessions (id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_cost_baselines_lead_idx on public.customer_cost_baselines (lead_id);

create table if not exists public.billing_cost_line_items (
  id text primary key,
  session_id text not null references public.billing_import_sessions (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Verträge
-- ---------------------------------------------------------------------------

create table if not exists public.contracts (
  id text primary key,
  lead_id text not null references public.leads (id) on delete restrict,
  source_offer_id text null references public.offers (id) on delete set null,
  owner_user_id text not null,
  created_by_user_id text not null,
  source_key text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contracts_source_key_uidx on public.contracts (source_key);
create index if not exists contracts_lead_idx on public.contracts (lead_id);
create index if not exists contracts_owner_idx on public.contracts (owner_user_id);

create table if not exists public.contract_versions (
  id text primary key,
  contract_id text not null references public.contracts (id) on delete cascade,
  lead_id text not null,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_versions_contract_idx on public.contract_versions (contract_id);

create table if not exists public.contract_terminations (
  id text primary key,
  contract_id text not null references public.contracts (id) on delete cascade,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_terminations_contract_idx on public.contract_terminations (contract_id);

-- ---------------------------------------------------------------------------
-- Aktivierungen
-- ---------------------------------------------------------------------------

create table if not exists public.activation_cases (
  id text primary key,
  contract_id text not null references public.contracts (id) on delete restrict,
  lead_id text not null references public.leads (id) on delete restrict,
  source_offer_id text null references public.offers (id) on delete set null,
  owner_user_id text not null,
  created_by_user_id text not null,
  source_key text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists activation_cases_source_key_uidx on public.activation_cases (source_key);
create index if not exists activation_cases_contract_idx on public.activation_cases (contract_id);
create index if not exists activation_cases_lead_idx on public.activation_cases (lead_id);

create table if not exists public.activation_checklists (
  id text primary key,
  activation_id text not null references public.activation_cases (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activation_checklists_activation_idx on public.activation_checklists (activation_id);

create table if not exists public.activation_applications (
  id text primary key,
  activation_id text not null references public.activation_cases (id) on delete cascade,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activation_hardware (
  id text primary key,
  activation_id text not null references public.activation_cases (id) on delete cascade,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activation_blockers (
  id text primary key,
  activation_id text not null references public.activation_cases (id) on delete cascade,
  created_by_user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Arbeitsvorrat
-- ---------------------------------------------------------------------------

create table if not exists public.sales_tasks (
  id text primary key,
  assignee_user_id text not null,
  created_by_user_id text not null,
  lead_id text null references public.leads (id) on delete set null,
  offer_id text null references public.offers (id) on delete set null,
  contract_id text null,
  activation_id text null,
  source_key text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_tasks_source_key_uidx on public.sales_tasks (source_key);
create index if not exists sales_tasks_assignee_idx on public.sales_tasks (assignee_user_id);

create table if not exists public.sales_activities (
  id text primary key,
  created_by_user_id text not null,
  lead_id text null references public.leads (id) on delete set null,
  offer_id text null references public.offers (id) on delete set null,
  contract_id text null,
  activation_id text null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists sales_activities_lead_idx on public.sales_activities (lead_id);
create index if not exists sales_activities_offer_idx on public.sales_activities (offer_id);

-- ---------------------------------------------------------------------------
-- Verwaltung
-- ---------------------------------------------------------------------------

create table if not exists public.audit_entries (
  id text primary key,
  user_id text not null,
  entity_type text not null,
  entity_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_entries_entity_idx on public.audit_entries (entity_type, entity_id);
create index if not exists audit_entries_created_idx on public.audit_entries (created_at desc);

create table if not exists public.approval_rules (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_templates (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.export_history (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_history (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.data_migration_runs (
  id text primary key,
  user_id text not null,
  status text not null check (status in ('preview', 'completed', 'failed')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS aktivieren
-- ---------------------------------------------------------------------------

alter table public.offers enable row level security;
alter table public.offer_versions enable row level security;
alter table public.offer_workflow_events enable row level security;
alter table public.offer_documents enable row level security;
alter table public.sales_documents enable row level security;
alter table public.price_books enable row level security;
alter table public.price_book_versions enable row level security;
alter table public.contract_terms enable row level security;
alter table public.price_rules enable row level security;
alter table public.pricing_evaluations enable row level security;
alter table public.commission_plans enable row level security;
alter table public.commission_plan_versions enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_assignments enable row level security;
alter table public.commission_calculations enable row level security;
alter table public.commission_cases enable row level security;
alter table public.commission_events enable row level security;
alter table public.recommendation_records enable row level security;
alter table public.recommendation_weight_sets enable row level security;
alter table public.best_pay_comparison_sessions enable row level security;
alter table public.user_active_sessions enable row level security;
alter table public.billing_import_sessions enable row level security;
alter table public.billing_source_documents enable row level security;
alter table public.billing_extracted_fields enable row level security;
alter table public.billing_period_records enable row level security;
alter table public.customer_cost_baselines enable row level security;
alter table public.billing_cost_line_items enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.contract_terminations enable row level security;
alter table public.activation_cases enable row level security;
alter table public.activation_checklists enable row level security;
alter table public.activation_applications enable row level security;
alter table public.activation_hardware enable row level security;
alter table public.activation_blockers enable row level security;
alter table public.sales_tasks enable row level security;
alter table public.sales_activities enable row level security;
alter table public.audit_entries enable row level security;
alter table public.approval_rules enable row level security;
alter table public.document_templates enable row level security;
alter table public.export_history enable row level security;
alter table public.backup_history enable row level security;
alter table public.data_migration_runs enable row level security;

-- Offers
drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers for select to authenticated
  using (public.is_active_user() and (public.is_admin() or created_by_user_id = auth.uid()::text or public.can_access_lead(lead_id)));

drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated
  with check (public.is_active_user() and (public.is_admin() or (created_by_user_id = auth.uid()::text and public.can_access_lead(lead_id))));

drop policy if exists offers_update on public.offers;
create policy offers_update on public.offers for update to authenticated
  using (public.is_active_user() and (public.is_admin() or created_by_user_id = auth.uid()::text or public.can_access_lead(lead_id)))
  with check (public.is_active_user() and (public.is_admin() or created_by_user_id = auth.uid()::text or public.can_access_lead(lead_id)));

drop policy if exists offers_delete on public.offers;
create policy offers_delete on public.offers for delete to authenticated using (public.is_admin());

-- Offer versions
drop policy if exists offer_versions_select on public.offer_versions;
create policy offer_versions_select on public.offer_versions for select to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id));

drop policy if exists offer_versions_mutate on public.offer_versions;
create policy offer_versions_mutate on public.offer_versions for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

-- Offer workflow events
drop policy if exists offer_workflow_events_select on public.offer_workflow_events;
create policy offer_workflow_events_select on public.offer_workflow_events for select to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id));

drop policy if exists offer_workflow_events_insert on public.offer_workflow_events;
create policy offer_workflow_events_insert on public.offer_workflow_events for insert to authenticated
  with check (public.is_active_user() and public.can_access_offer(offer_id));

-- Offer documents
drop policy if exists offer_documents_all on public.offer_documents;
create policy offer_documents_all on public.offer_documents for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

-- Sales documents
drop policy if exists sales_documents_select on public.sales_documents;
create policy sales_documents_select on public.sales_documents for select to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or created_by_user_id = auth.uid()::text
      or (offer_id is not null and public.can_access_offer(offer_id))
      or (contract_id is not null and public.can_access_contract(contract_id))
      or (activation_id is not null and public.can_access_activation(activation_id))
    )
  );

drop policy if exists sales_documents_insert on public.sales_documents;
create policy sales_documents_insert on public.sales_documents for insert to authenticated
  with check (public.is_active_user() and (public.is_admin() or created_by_user_id = auth.uid()::text));

-- Pricing catalog (read all, write admin)
drop policy if exists price_books_select on public.price_books;
create policy price_books_select on public.price_books for select to authenticated using (public.is_active_user());
drop policy if exists price_books_admin on public.price_books;
create policy price_books_admin on public.price_books for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists price_book_versions_select on public.price_book_versions;
create policy price_book_versions_select on public.price_book_versions for select to authenticated using (public.is_active_user());
drop policy if exists price_book_versions_admin on public.price_book_versions;
create policy price_book_versions_admin on public.price_book_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists contract_terms_select on public.contract_terms;
create policy contract_terms_select on public.contract_terms for select to authenticated using (public.is_active_user());
drop policy if exists contract_terms_admin on public.contract_terms;
create policy contract_terms_admin on public.contract_terms for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists price_rules_select on public.price_rules;
create policy price_rules_select on public.price_rules for select to authenticated using (public.is_active_user());
drop policy if exists price_rules_admin on public.price_rules;
create policy price_rules_admin on public.price_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pricing evaluations
drop policy if exists pricing_evaluations_all on public.pricing_evaluations;
create policy pricing_evaluations_all on public.pricing_evaluations for all to authenticated
  using (public.is_active_user() and public.can_access_offer(offer_id))
  with check (public.is_active_user() and public.can_access_offer(offer_id));

-- Commission catalog
drop policy if exists commission_plans_select on public.commission_plans;
create policy commission_plans_select on public.commission_plans for select to authenticated using (public.is_active_user());
drop policy if exists commission_plans_admin on public.commission_plans;
create policy commission_plans_admin on public.commission_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists commission_plan_versions_select on public.commission_plan_versions;
create policy commission_plan_versions_select on public.commission_plan_versions for select to authenticated using (public.is_active_user());
drop policy if exists commission_plan_versions_admin on public.commission_plan_versions;
create policy commission_plan_versions_admin on public.commission_plan_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists commission_rules_select on public.commission_rules;
create policy commission_rules_select on public.commission_rules for select to authenticated using (public.is_active_user());
drop policy if exists commission_rules_admin on public.commission_rules;
create policy commission_rules_admin on public.commission_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists commission_assignments_select on public.commission_assignments;
create policy commission_assignments_select on public.commission_assignments for select to authenticated
  using (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text));
drop policy if exists commission_assignments_admin on public.commission_assignments;
create policy commission_assignments_admin on public.commission_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Commission calculations/cases
drop policy if exists commission_calculations_select on public.commission_calculations;
create policy commission_calculations_select on public.commission_calculations for select to authenticated
  using (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text));
drop policy if exists commission_calculations_mutate on public.commission_calculations;
create policy commission_calculations_mutate on public.commission_calculations for all to authenticated
  using (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text))
  with check (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text));

drop policy if exists commission_cases_select on public.commission_cases;
create policy commission_cases_select on public.commission_cases for select to authenticated
  using (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text));
drop policy if exists commission_cases_mutate on public.commission_cases;
create policy commission_cases_mutate on public.commission_cases for all to authenticated
  using (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text))
  with check (public.is_active_user() and (public.is_admin() or sales_representative_id = auth.uid()::text));

drop policy if exists commission_events_select on public.commission_events;
create policy commission_events_select on public.commission_events for select to authenticated
  using (public.is_active_user() and public.is_admin());

drop policy if exists commission_events_insert on public.commission_events;
create policy commission_events_insert on public.commission_events for insert to authenticated
  with check (public.is_active_user() and public.is_admin());

-- Recommendations
drop policy if exists recommendation_records_all on public.recommendation_records;
create policy recommendation_records_all on public.recommendation_records for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or created_by_user_id = auth.uid()::text
      or (lead_id is not null and public.can_access_lead(lead_id))
      or (offer_id is not null and public.can_access_offer(offer_id))
    )
  )
  with check (
    public.is_active_user()
    and (public.is_admin() or created_by_user_id = auth.uid()::text)
  );

drop policy if exists recommendation_weight_sets_select on public.recommendation_weight_sets;
create policy recommendation_weight_sets_select on public.recommendation_weight_sets for select to authenticated using (public.is_active_user());
drop policy if exists recommendation_weight_sets_admin on public.recommendation_weight_sets;
create policy recommendation_weight_sets_admin on public.recommendation_weight_sets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- BestPay sessions
drop policy if exists best_pay_sessions_all on public.best_pay_comparison_sessions;
create policy best_pay_sessions_all on public.best_pay_comparison_sessions for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or created_by_user_id = auth.uid()::text
      or (lead_id is not null and public.can_access_lead(lead_id))
    )
  )
  with check (
    public.is_active_user()
    and (public.is_admin() or created_by_user_id = auth.uid()::text)
  );

drop policy if exists user_active_sessions_own on public.user_active_sessions;
create policy user_active_sessions_own on public.user_active_sessions for all to authenticated
  using (public.is_active_user() and user_id = auth.uid()::text)
  with check (public.is_active_user() and user_id = auth.uid()::text);

-- Billing import
drop policy if exists billing_import_sessions_all on public.billing_import_sessions;
create policy billing_import_sessions_all on public.billing_import_sessions for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or created_by_user_id = auth.uid()::text
      or (lead_id is not null and public.can_access_lead(lead_id))
    )
  )
  with check (public.is_active_user() and (public.is_admin() or created_by_user_id = auth.uid()::text));

drop policy if exists billing_children_select on public.billing_source_documents;
create policy billing_children_select on public.billing_source_documents for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)));
drop policy if exists billing_children_mutate on public.billing_source_documents;
create policy billing_children_mutate on public.billing_source_documents for all to authenticated
  using (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)))
  with check (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)));

-- Same pattern for other billing child tables
drop policy if exists billing_fields_all on public.billing_extracted_fields;
create policy billing_fields_all on public.billing_extracted_fields for all to authenticated
  using (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)))
  with check (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)));

drop policy if exists billing_periods_all on public.billing_period_records;
create policy billing_periods_all on public.billing_period_records for all to authenticated
  using (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)))
  with check (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)));

drop policy if exists billing_cost_items_all on public.billing_cost_line_items;
create policy billing_cost_items_all on public.billing_cost_line_items for all to authenticated
  using (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)))
  with check (public.is_active_user() and exists (select 1 from public.billing_import_sessions s where s.id = session_id and (public.is_admin() or s.created_by_user_id = auth.uid()::text)));

drop policy if exists customer_cost_baselines_all on public.customer_cost_baselines;
create policy customer_cost_baselines_all on public.customer_cost_baselines for all to authenticated
  using (public.is_active_user() and (public.is_admin() or (lead_id is not null and public.can_access_lead(lead_id))))
  with check (public.is_active_user() and (public.is_admin() or (lead_id is not null and public.can_access_lead(lead_id))));

-- Contracts
drop policy if exists contracts_all on public.contracts;
create policy contracts_all on public.contracts for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or owner_user_id = auth.uid()::text
      or created_by_user_id = auth.uid()::text
      or public.can_access_lead(lead_id)
    )
  )
  with check (
    public.is_active_user()
    and (public.is_admin() or owner_user_id = auth.uid()::text or created_by_user_id = auth.uid()::text)
  );

drop policy if exists contract_versions_all on public.contract_versions;
create policy contract_versions_all on public.contract_versions for all to authenticated
  using (public.is_active_user() and public.can_access_contract(contract_id))
  with check (public.is_active_user() and public.can_access_contract(contract_id));

drop policy if exists contract_terminations_all on public.contract_terminations;
create policy contract_terminations_all on public.contract_terminations for all to authenticated
  using (public.is_active_user() and public.can_access_contract(contract_id))
  with check (public.is_active_user() and public.can_access_contract(contract_id));

-- Activations
drop policy if exists activation_cases_all on public.activation_cases;
create policy activation_cases_all on public.activation_cases for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or owner_user_id = auth.uid()::text
      or created_by_user_id = auth.uid()::text
      or public.can_access_lead(lead_id)
    )
  )
  with check (
    public.is_active_user()
    and (public.is_admin() or owner_user_id = auth.uid()::text or created_by_user_id = auth.uid()::text)
  );

drop policy if exists activation_checklists_all on public.activation_checklists;
create policy activation_checklists_all on public.activation_checklists for all to authenticated
  using (public.is_active_user() and public.can_access_activation(activation_id))
  with check (public.is_active_user() and public.can_access_activation(activation_id));

drop policy if exists activation_applications_all on public.activation_applications;
create policy activation_applications_all on public.activation_applications for all to authenticated
  using (public.is_active_user() and public.can_access_activation(activation_id))
  with check (public.is_active_user() and public.can_access_activation(activation_id));

drop policy if exists activation_hardware_all on public.activation_hardware;
create policy activation_hardware_all on public.activation_hardware for all to authenticated
  using (public.is_active_user() and public.can_access_activation(activation_id))
  with check (public.is_active_user() and public.can_access_activation(activation_id));

drop policy if exists activation_blockers_all on public.activation_blockers;
create policy activation_blockers_all on public.activation_blockers for all to authenticated
  using (public.is_active_user() and public.can_access_activation(activation_id))
  with check (public.is_active_user() and public.can_access_activation(activation_id));

-- Sales tasks & activities
drop policy if exists sales_tasks_all on public.sales_tasks;
create policy sales_tasks_all on public.sales_tasks for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or assignee_user_id = auth.uid()::text
      or created_by_user_id = auth.uid()::text
      or (lead_id is not null and public.can_access_lead(lead_id))
    )
  )
  with check (
    public.is_active_user()
    and (public.is_admin() or assignee_user_id = auth.uid()::text or created_by_user_id = auth.uid()::text)
  );

drop policy if exists sales_activities_all on public.sales_activities;
create policy sales_activities_all on public.sales_activities for all to authenticated
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or created_by_user_id = auth.uid()::text
      or (lead_id is not null and public.can_access_lead(lead_id))
    )
  )
  with check (public.is_active_user() and (public.is_admin() or created_by_user_id = auth.uid()::text));

-- Admin-only tables
drop policy if exists audit_entries_admin on public.audit_entries;
create policy audit_entries_admin on public.audit_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists approval_rules_select on public.approval_rules;
create policy approval_rules_select on public.approval_rules for select to authenticated using (public.is_active_user());
drop policy if exists approval_rules_admin on public.approval_rules;
create policy approval_rules_admin on public.approval_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists document_templates_select on public.document_templates;
create policy document_templates_select on public.document_templates for select to authenticated using (public.is_active_user());
drop policy if exists document_templates_admin on public.document_templates;
create policy document_templates_admin on public.document_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists export_history_admin on public.export_history;
create policy export_history_admin on public.export_history for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists backup_history_admin on public.backup_history;
create policy backup_history_admin on public.backup_history for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists data_migration_runs_admin on public.data_migration_runs;
create policy data_migration_runs_admin on public.data_migration_runs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Revoke anon on all operational tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'offers','offer_versions','offer_workflow_events','offer_documents','sales_documents',
    'price_books','price_book_versions','contract_terms','price_rules','pricing_evaluations',
    'commission_plans','commission_plan_versions','commission_rules','commission_assignments',
    'commission_calculations','commission_cases','commission_events',
    'recommendation_records','recommendation_weight_sets',
    'best_pay_comparison_sessions','user_active_sessions',
    'billing_import_sessions','billing_source_documents','billing_extracted_fields',
    'billing_period_records','customer_cost_baselines','billing_cost_line_items',
    'contracts','contract_versions','contract_terminations',
    'activation_cases','activation_checklists','activation_applications','activation_hardware','activation_blockers',
    'sales_tasks','sales_activities',
    'audit_entries','approval_rules','document_templates','export_history','backup_history','data_migration_runs'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
