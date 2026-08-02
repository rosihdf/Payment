-- Provision 2.0: fehlende Standardregeln additiv ergänzen, Bezeichnungen aktualisieren.
-- Keine Beträge bestehender Regeln überschreiben. Keine historischen Fälle anfassen.

-- CLASSIC: Terminal + Acquiring ≤36 Monate
insert into public.commission_rules (id, data, created_at, updated_at)
values (
  'commission_rule_classic_terminal_acq_lte36',
  '{
    "id":"commission_rule_classic_terminal_acq_lte36",
    "commissionPlanVersionId":"commission_plan_version_classic_v1",
    "name":"Terminal + Acquiring ≤36 Monate",
    "status":"active",
    "commissionType":"base_once",
    "calculationBasis":"fixed_amount",
    "contractTypeCode":"terminal_plus_acq",
    "productId":null,
    "tariffId":null,
    "contractTermId":null,
    "accessoryOnly":false,
    "minTermMonthsExclusive":null,
    "maxTermMonthsExclusive":37,
    "exactTermMonths":null,
    "priority":15,
    "combinable":false,
    "fixedAmountCents":25000,
    "percentTenthsOfBasisPoint":null,
    "thresholdTenthsOfCent":null,
    "currency":"EUR",
    "validFrom":"2026-01-01",
    "validUntil":null,
    "internalDescription":"CLASSIC – Terminal + Acquiring bei Laufzeit bis einschließlich 36 Monate",
    "createdAt":"2026-01-01T00:00:00.000Z",
    "updatedAt":"2026-01-01T00:00:00.000Z"
  }'::jsonb,
  '2026-01-01T00:00:00.000Z'::timestamptz,
  '2026-01-01T00:00:00.000Z'::timestamptz
)
on conflict (id) do nothing;

-- VARIABLE: Hardware / Dienstleistungen / Zusatzgeräte / Sonderprodukte
insert into public.commission_rules (id, data, created_at, updated_at)
values
(
  'commission_rule_variable_hardware',
  '{
    "id":"commission_rule_variable_hardware",
    "commissionPlanVersionId":"commission_plan_version_variable_v1",
    "name":"Hardware 20 %",
    "status":"active",
    "commissionType":"hardware",
    "calculationBasis":"percentage_of_sale_price",
    "contractTypeCode":null,
    "productId":null,
    "tariffId":null,
    "contractTermId":null,
    "accessoryOnly":false,
    "minTermMonthsExclusive":null,
    "maxTermMonthsExclusive":null,
    "exactTermMonths":null,
    "priority":10,
    "combinable":true,
    "fixedAmountCents":null,
    "percentTenthsOfBasisPoint":2000,
    "thresholdTenthsOfCent":null,
    "currency":"EUR",
    "validFrom":"2026-01-01",
    "validUntil":null,
    "internalDescription":"VARIABLE – 20 % vom Hardware-Verkaufspreis",
    "createdAt":"2026-01-01T00:00:00.000Z",
    "updatedAt":"2026-01-01T00:00:00.000Z"
  }'::jsonb,
  '2026-01-01T00:00:00.000Z'::timestamptz,
  '2026-01-01T00:00:00.000Z'::timestamptz
),
(
  'commission_rule_variable_service',
  '{
    "id":"commission_rule_variable_service",
    "commissionPlanVersionId":"commission_plan_version_variable_v1",
    "name":"Dienstleistungen 20 %",
    "status":"active",
    "commissionType":"recurring",
    "calculationBasis":"percentage_of_sale_price",
    "contractTypeCode":null,
    "productId":null,
    "tariffId":null,
    "contractTermId":null,
    "accessoryOnly":false,
    "minTermMonthsExclusive":null,
    "maxTermMonthsExclusive":null,
    "exactTermMonths":null,
    "priority":10,
    "combinable":true,
    "fixedAmountCents":null,
    "percentTenthsOfBasisPoint":2000,
    "thresholdTenthsOfCent":null,
    "currency":"EUR",
    "validFrom":"2026-01-01",
    "validUntil":null,
    "internalDescription":"VARIABLE – 20 % von Dienstleistungen",
    "createdAt":"2026-01-01T00:00:00.000Z",
    "updatedAt":"2026-01-01T00:00:00.000Z"
  }'::jsonb,
  '2026-01-01T00:00:00.000Z'::timestamptz,
  '2026-01-01T00:00:00.000Z'::timestamptz
),
(
  'commission_rule_variable_addon_device',
  '{
    "id":"commission_rule_variable_addon_device",
    "commissionPlanVersionId":"commission_plan_version_variable_v1",
    "name":"Zusatzgeräte 20 %",
    "status":"active",
    "commissionType":"hardware",
    "calculationBasis":"percentage_of_sale_price",
    "contractTypeCode":null,
    "productId":null,
    "tariffId":null,
    "contractTermId":null,
    "accessoryOnly":false,
    "minTermMonthsExclusive":null,
    "maxTermMonthsExclusive":null,
    "exactTermMonths":null,
    "priority":20,
    "combinable":true,
    "fixedAmountCents":null,
    "percentTenthsOfBasisPoint":2000,
    "thresholdTenthsOfCent":null,
    "currency":"EUR",
    "validFrom":"2026-01-01",
    "validUntil":null,
    "internalDescription":"VARIABLE – 20 % von Zusatzgeräten",
    "createdAt":"2026-01-01T00:00:00.000Z",
    "updatedAt":"2026-01-01T00:00:00.000Z"
  }'::jsonb,
  '2026-01-01T00:00:00.000Z'::timestamptz,
  '2026-01-01T00:00:00.000Z'::timestamptz
),
(
  'commission_rule_variable_special_product',
  '{
    "id":"commission_rule_variable_special_product",
    "commissionPlanVersionId":"commission_plan_version_variable_v1",
    "name":"Sonderprodukte 20 %",
    "status":"active",
    "commissionType":"accessory",
    "calculationBasis":"percentage_of_sale_price",
    "contractTypeCode":null,
    "productId":null,
    "tariffId":null,
    "contractTermId":null,
    "accessoryOnly":false,
    "minTermMonthsExclusive":null,
    "maxTermMonthsExclusive":null,
    "exactTermMonths":null,
    "priority":25,
    "combinable":true,
    "fixedAmountCents":null,
    "percentTenthsOfBasisPoint":2000,
    "thresholdTenthsOfCent":null,
    "currency":"EUR",
    "validFrom":"2026-01-01",
    "validUntil":null,
    "internalDescription":"VARIABLE – 20 % von Sonderprodukten",
    "createdAt":"2026-01-01T00:00:00.000Z",
    "updatedAt":"2026-01-01T00:00:00.000Z"
  }'::jsonb,
  '2026-01-01T00:00:00.000Z'::timestamptz,
  '2026-01-01T00:00:00.000Z'::timestamptz
)
on conflict (id) do nothing;

-- Bezeichnungen aktualisieren (Beträge unverändert)
update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Terminal + Acquiring >36 Monate"'),
    '{internalDescription}',
    '"CLASSIC – Terminal + Acquiring bei Laufzeit über 36 Monate"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_classic_terminal_acq_gt36';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Nur Terminal"'),
    '{internalDescription}',
    '"CLASSIC – ausschließlich Terminal (200 € Standard)"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_classic_terminal_lt36';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Nur Acquiring"'),
    '{internalDescription}',
    '"CLASSIC – ausschließlich Acquiring (150 € Standard)"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_classic_acq';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Feste Provision Terminal + Acquiring >36 Monate"'),
    '{internalDescription}',
    '"VARIABLE – feste Provision 150 €"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_terminal_acq_gt36';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Feste Provision Nur Terminal"'),
    '{internalDescription}',
    '"VARIABLE – feste Provision 100 €"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_terminal_lt36';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Feste Provision Nur Acquiring"'),
    '{internalDescription}',
    '"VARIABLE – feste Provision 100 €"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_acq';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Variable Beteiligung Transaktion 30 %"'),
    '{internalDescription}',
    '"VARIABLE – 30 % der gesamten Transaktionsgebühr"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_transaction';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Variable Beteiligung Clearing 30 %"'),
    '{internalDescription}',
    '"VARIABLE – 30 % Clearing oberhalb Schwelle 0,014 €"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_clearing';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data, '{name}', '"Hardware / Terminalbeteiligung 30 %"'),
    '{internalDescription}',
    '"VARIABLE – 30 % Terminal-/Hardwarebeteiligung"'
  ),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_terminal_share';

update public.commission_rules
set data = jsonb_set(
  jsonb_set(data, '{internalDescription}', '"VARIABLE – 20 % vom Zubehör-Verkaufspreis"'),
  '{updatedAt}',
  to_jsonb(now()::text)
),
updated_at = now()
where id = 'commission_rule_variable_accessory';

-- Assignment-Versionen: Euro-Override entfernen, wenn sharePercent gesetzt ist (Prozent führt).
-- Historische commission_cases / commission_calculations bleiben unverändert.
update public.commission_assignment_versions
set data = jsonb_set(
  data,
  '{ruleOverrides}',
  coalesce(
    (
      select jsonb_agg(
        case
          when (override ? 'sharePercent') and (override->>'sharePercent') is not null
            then (override - 'fixedAmountCents') || jsonb_build_object('fixedAmountCents', null)
          else override
        end
      )
      from jsonb_array_elements(coalesce(data->'ruleOverrides', '[]'::jsonb)) as override
    ),
    '[]'::jsonb
  )
)
where data ? 'ruleOverrides'
  and jsonb_typeof(data->'ruleOverrides') = 'array'
  and jsonb_array_length(data->'ruleOverrides') > 0;
