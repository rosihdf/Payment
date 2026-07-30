import type { ContractTerm } from '../../domain/pricing/contractTerm';
import type { PriceBook, PriceBookVersion } from '../../domain/pricing/priceBook';
import type { PriceRule } from '../../domain/pricing/priceRule';

export interface PricingCatalogData {
  priceBooks: PriceBook[];
  priceBookVersions: PriceBookVersion[];
  contractTerms: ContractTerm[];
  priceRules: PriceRule[];
}

export interface PricingCatalogRepository {
  getCatalog(): Promise<PricingCatalogData>;
  saveCatalog(catalog: PricingCatalogData): Promise<void>;
}
