#!/usr/bin/env node
/**
 * Einmaliger Bootstrap der produktiven Ausgangskonfiguration in Supabase.
 * Benötigt SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in der Umgebung.
 */
import { createClient } from '@supabase/supabase-js';
import {
  createProductionBaselineCatalog,
  createProductionCommissionAssignment,
} from '../src/domain/catalog/productionBaselineCatalog';
import { normalizeTariff } from '../src/domain/tariff/normalizeTariff';
import { normalizeProduct } from '../src/domain/product/normalizeProduct';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY erforderlich');
  process.exit(1);
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SYSTEM_USER_ID = 'system_bootstrap';

function tariffRow(tariff: ReturnType<typeof normalizeTariff>) {
  return {
    id: tariff.id,
    name: tariff.name,
    product_code: tariff.productCode,
    status: tariff.status,
    data: tariff,
    created_at: tariff.createdAt,
    updated_at: tariff.updatedAt,
  };
}

function productRow(product: ReturnType<typeof normalizeProduct>) {
  return {
    id: product.id,
    name: product.name,
    internal_product_code: product.internalProductCode,
    category: product.category,
    status: product.status,
    data: product,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

function jsonRow(
  id: string,
  data: unknown,
  createdAt: string,
  updatedAt: string,
  extra: Record<string, unknown> = {},
) {
  return { id, data, created_at: createdAt, updated_at: updatedAt, ...extra };
}

async function upsertIgnore(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return 0;
  }
  const { error } = await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return rows.length;
}

async function main() {
  const baseline = createProductionBaselineCatalog(SYSTEM_USER_ID);
  let inserted = 0;

  inserted += await upsertIgnore(
    'tariffs',
    baseline.tariffs.map((item) => tariffRow(normalizeTariff(item))),
  );
  inserted += await upsertIgnore(
    'products',
    baseline.products.map((item) => productRow(normalizeProduct(item))),
  );

  const timestamp = '2026-01-01T00:00:00.000Z';
  inserted += await upsertIgnore(
    'commission_plans',
    baseline.commissionPlans.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );
  inserted += await upsertIgnore(
    'commission_plan_versions',
    baseline.commissionPlanVersions.map((item) =>
      jsonRow(item.id, item, item.createdAt, item.updatedAt, { plan_id: item.commissionPlanId }),
    ),
  );
  inserted += await upsertIgnore(
    'commission_rules',
    baseline.commissionRules.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );

  const assignment = createProductionCommissionAssignment(
    SYSTEM_USER_ID,
    baseline.commissionPlanVersions[0]!.id,
  );
  inserted += await upsertIgnore('commission_assignments', [
    jsonRow(assignment.id, assignment, timestamp, timestamp, {
      sales_representative_id: SYSTEM_USER_ID,
    }),
  ]);

  inserted += await upsertIgnore(
    'price_books',
    baseline.priceBooks.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );
  inserted += await upsertIgnore(
    'price_book_versions',
    baseline.priceBookVersions.map((item) =>
      jsonRow(item.id, item, item.createdAt, item.updatedAt, { price_book_id: item.priceBookId }),
    ),
  );
  inserted += await upsertIgnore(
    'contract_terms',
    baseline.contractTerms.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );
  inserted += await upsertIgnore(
    'price_rules',
    baseline.priceRules.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );
  inserted += await upsertIgnore(
    'recommendation_weight_sets',
    baseline.recommendationWeightSets.map((item) =>
      jsonRow(item.id, item, item.createdAt, item.updatedAt),
    ),
  );
  inserted += await upsertIgnore(
    'approval_rules',
    baseline.approvalRules.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );
  inserted += await upsertIgnore(
    'document_templates',
    baseline.documentTemplates.map((item) => jsonRow(item.id, item, item.createdAt, item.updatedAt)),
  );

  console.log(`Bootstrap abgeschlossen (${inserted} Upsert-Versuche)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
