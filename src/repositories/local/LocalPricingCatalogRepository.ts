import { normalizeContractTerms } from '../../domain/pricing/normalizeContractTerm';
import { normalizePriceBookVersions, normalizePriceBooks } from '../../domain/pricing/normalizePriceBook';
import { normalizePriceRules } from '../../domain/pricing/normalizePriceRule';
import { migratePricingCatalogIfNeeded } from '../../services/pricingCatalogMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type {
  PricingCatalogData,
  PricingCatalogRepository,
} from '../interfaces/PricingCatalogRepository';

export class LocalPricingCatalogRepository implements PricingCatalogRepository {
  async getCatalog(): Promise<PricingCatalogData> {
    migratePricingCatalogIfNeeded();

    return {
      priceBooks: normalizePriceBooks(readStorageItem<unknown[]>(STORAGE_KEYS.priceBooks) ?? []),
      priceBookVersions: normalizePriceBookVersions(
        readStorageItem<unknown[]>(STORAGE_KEYS.priceBookVersions) ?? [],
      ),
      contractTerms: normalizeContractTerms(
        readStorageItem<unknown[]>(STORAGE_KEYS.contractTerms) ?? [],
      ),
      priceRules: normalizePriceRules(readStorageItem<unknown[]>(STORAGE_KEYS.priceRules) ?? []),
    };
  }

  async saveCatalog(catalog: PricingCatalogData): Promise<void> {
    writeStorageItem(STORAGE_KEYS.priceBooks, catalog.priceBooks);
    writeStorageItem(STORAGE_KEYS.priceBookVersions, catalog.priceBookVersions);
    writeStorageItem(STORAGE_KEYS.contractTerms, catalog.contractTerms);
    writeStorageItem(STORAGE_KEYS.priceRules, catalog.priceRules);
  }
}
