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