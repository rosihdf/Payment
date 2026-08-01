/**
 * Generiert idempotente SQL-Upserts für die produktive Ausgangskonfiguration.
 * Ausgabe: stdout (für apply_migration / execute_sql)
 */
import {
  createProductionBaselineCatalog,
  createProductionCommissionAssignment,
} from '../src/domain/catalog/productionBaselineCatalog';
import { normalizeTariff } from '../src/domain/tariff/normalizeTariff';
import { normalizeProduct } from '../src/domain/product/normalizeProduct';

function sqlLiteral(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const baseline = createProductionBaselineCatalog('system_bootstrap');
const lines: string[] = [
  '-- Produktive Ausgangskonfiguration (idempotent, ON CONFLICT DO NOTHING)',
  'begin;',
];

for (const raw of baseline.tariffs) {
  const tariff = normalizeTariff(raw);
  lines.push(
    `insert into public.tariffs (id, name, product_code, status, data, created_at, updated_at) values (${sqlString(tariff.id)}, ${sqlString(tariff.name)}, ${sqlString(tariff.productCode)}, ${sqlString(tariff.status)}, ${sqlLiteral(tariff)}, ${sqlString(tariff.createdAt)}::timestamptz, ${sqlString(tariff.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const raw of baseline.products) {
  const product = normalizeProduct(raw);
  lines.push(
    `insert into public.products (id, name, internal_product_code, category, status, data, created_at, updated_at) values (${sqlString(product.id)}, ${sqlString(product.name)}, ${sqlString(product.internalProductCode)}, ${sqlString(product.category)}, ${sqlString(product.status)}, ${sqlLiteral(product)}, ${sqlString(product.createdAt)}::timestamptz, ${sqlString(product.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.commissionPlans) {
  lines.push(
    `insert into public.commission_plans (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.commissionPlanVersions) {
  lines.push(
    `insert into public.commission_plan_versions (id, plan_id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlString(item.commissionPlanId)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.commissionRules) {
  lines.push(
    `insert into public.commission_rules (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

const assignment = createProductionCommissionAssignment(
  'system_bootstrap',
  baseline.commissionPlanVersions[0]!.id,
);
lines.push(
  `insert into public.commission_assignments (id, sales_representative_id, data, created_at, updated_at) values (${sqlString(assignment.id)}, ${sqlString(assignment.salesRepresentativeId)}, ${sqlLiteral(assignment)}, ${sqlString(assignment.createdAt)}::timestamptz, ${sqlString(assignment.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
);

for (const item of baseline.priceBooks) {
  lines.push(
    `insert into public.price_books (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.priceBookVersions) {
  lines.push(
    `insert into public.price_book_versions (id, price_book_id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlString(item.priceBookId)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.contractTerms) {
  lines.push(
    `insert into public.contract_terms (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.priceRules) {
  lines.push(
    `insert into public.price_rules (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.recommendationWeightSets) {
  lines.push(
    `insert into public.recommendation_weight_sets (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.approvalRules) {
  lines.push(
    `insert into public.approval_rules (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

for (const item of baseline.documentTemplates) {
  lines.push(
    `insert into public.document_templates (id, data, created_at, updated_at) values (${sqlString(item.id)}, ${sqlLiteral(item)}, ${sqlString(item.createdAt)}::timestamptz, ${sqlString(item.updatedAt)}::timestamptz) on conflict (id) do nothing;`,
  );
}

lines.push('commit;');
console.log(lines.join('\n'));
