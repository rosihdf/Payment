import { normalizeContractTerms } from '../../domain/pricing/normalizeContractTerm';
import { normalizePriceBookVersions, normalizePriceBooks } from '../../domain/pricing/normalizePriceBook';
import { normalizePriceRules } from '../../domain/pricing/normalizePriceRule';
import type {
  PricingCatalogData,
  PricingCatalogRepository,
} from '../interfaces/PricingCatalogRepository';
import { rowData, sbSelectAll, sbUpsertMany, type JsonTableRow } from './supabaseTable';

function priceBookToRow(item: PricingCatalogData['priceBooks'][number]): Record<string, unknown> {
  return {
    id: item.id,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function priceBookVersionToRow(
  item: PricingCatalogData['priceBookVersions'][number],
): Record<string, unknown> {
  return {
    id: item.id,
    price_book_id: item.priceBookId,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function contractTermToRow(item: PricingCatalogData['contractTerms'][number]): Record<string, unknown> {
  return {
    id: item.id,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function priceRuleToRow(item: PricingCatalogData['priceRules'][number]): Record<string, unknown> {
  return {
    id: item.id,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export class SupabasePricingCatalogRepository implements PricingCatalogRepository {
  async getCatalog(): Promise<PricingCatalogData> {
    const [priceBookRows, versionRows, termRows, ruleRows] = await Promise.all([
      sbSelectAll('price_books'),
      sbSelectAll('price_book_versions'),
      sbSelectAll('contract_terms'),
      sbSelectAll('price_rules'),
    ]);

    return {
      priceBooks: normalizePriceBooks(priceBookRows.map((row) => rowData(row, { id: row.id }))),
      priceBookVersions: normalizePriceBookVersions(
        versionRows.map((row: JsonTableRow) =>
          rowData(row, { id: row.id, priceBookId: row.price_book_id }),
        ),
      ),
      contractTerms: normalizeContractTerms(termRows.map((row) => rowData(row, { id: row.id }))),
      priceRules: normalizePriceRules(ruleRows.map((row) => rowData(row, { id: row.id }))),
    };
  }

  async saveCatalog(catalog: PricingCatalogData): Promise<void> {
    await Promise.all([
      sbUpsertMany('price_books', catalog.priceBooks.map(priceBookToRow)),
      sbUpsertMany('price_book_versions', catalog.priceBookVersions.map(priceBookVersionToRow)),
      sbUpsertMany('contract_terms', catalog.contractTerms.map(contractTermToRow)),
      sbUpsertMany('price_rules', catalog.priceRules.map(priceRuleToRow)),
    ]);
  }
}
