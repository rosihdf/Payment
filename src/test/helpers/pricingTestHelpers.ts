import type { ContractTerm } from '../../domain/pricing/contractTerm';
import type { PriceBook, PriceBookVersion } from '../../domain/pricing/priceBook';
import type { PriceRule } from '../../domain/pricing/priceRule';
import type { PricingEvaluationInput } from '../../domain/pricing/pricingEvaluation';
import { DEFAULT_PRICING_EVALUATION_INPUT } from '../../domain/pricing/pricingEvaluationDefaults';
import { resetPricingCatalogVersionForTests } from '../../services/pricingCatalogMigration';
import { resetPricingEvaluationStorageForTests } from '../../services/pricingEvaluationStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../../utils/storage';

/** Explizit als Testkonfiguration gekennzeichnet – nicht für produktive Seeds verwenden. */
export const TEST_PRICE_BOOK_ID = 'price_book_test';
export const TEST_PRICE_BOOK_VERSION_ID = 'price_book_version_test_v1';
export const TEST_CONTRACT_TERM_24_ID = 'contract_term_test_24';
export const TEST_CONTRACT_TERM_36_ID = 'contract_term_test_36';
export const TEST_PRICE_RULE_GENERAL_ID = 'price_rule_test_general';
export const TEST_PRICE_RULE_TARIFF_ID = 'price_rule_test_tariff';
export const TEST_TARIFF_ID = 'tariff_bestpay_a920_classic';

export function createTestPriceBook(overrides: Partial<PriceBook> = {}): PriceBook {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id: TEST_PRICE_BOOK_ID,
    code: 'bestpay-test',
    name: 'Test Preisliste',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createTestPriceBookVersion(
  overrides: Partial<PriceBookVersion> = {},
): PriceBookVersion {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id: TEST_PRICE_BOOK_VERSION_ID,
    priceBookId: TEST_PRICE_BOOK_ID,
    versionNumber: 1,
    status: 'published',
    validFrom: '2026-01-01',
    validUntil: null,
    publishedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createTestContractTerm(
  overrides: Partial<ContractTerm> = {},
): ContractTerm {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id: TEST_CONTRACT_TERM_24_ID,
    contractTypeId: null,
    name: '24 Monate',
    months: 24,
    isStandard: true,
    status: 'active',
    validFrom: '2026-01-01',
    validUntil: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createTestPriceRule(overrides: Partial<PriceRule> = {}): PriceRule {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id: TEST_PRICE_RULE_GENERAL_ID,
    priceBookVersionId: TEST_PRICE_BOOK_VERSION_ID,
    name: 'Allgemeine Testregel',
    status: 'active',
    contractTypeId: null,
    productId: null,
    tariffId: null,
    contractTermId: null,
    industryId: null,
    priority: 10,
    combinable: false,
    listPriceCents: 10000,
    targetPriceCents: 9000,
    minimumPriceCents: 8000,
    maxDiscountPercentTenths: 200,
    unit: 'monthly',
    currency: 'EUR',
    validFrom: '2026-01-01',
    validUntil: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function seedTestPricingCatalog(options?: {
  versions?: PriceBookVersion[];
  terms?: ContractTerm[];
  rules?: PriceRule[];
}): void {
  resetPricingCatalogVersionForTests();
  resetPricingEvaluationStorageForTests();

  writeStorageItem(STORAGE_KEYS.priceBooks, [createTestPriceBook()]);
  writeStorageItem(
    STORAGE_KEYS.priceBookVersions,
    options?.versions ?? [createTestPriceBookVersion()],
  );
  writeStorageItem(
    STORAGE_KEYS.contractTerms,
    options?.terms ?? [
      createTestContractTerm(),
      createTestContractTerm({
        id: TEST_CONTRACT_TERM_36_ID,
        name: '36 Monate',
        months: 36,
      }),
    ],
  );
  writeStorageItem(
    STORAGE_KEYS.priceRules,
    options?.rules ?? [
      createTestPriceRule(),
      createTestPriceRule({
        id: TEST_PRICE_RULE_TARIFF_ID,
        name: 'Tarifspezifische Testregel',
        tariffId: TEST_TARIFF_ID,
        priority: 50,
        listPriceCents: 12000,
        targetPriceCents: 11000,
        minimumPriceCents: 9500,
      }),
    ],
  );
  writeStorageItem(STORAGE_KEYS.pricingCatalogVersion, 1);
  writeStorageItem(STORAGE_KEYS.pricingEvaluations, []);
  writeStorageItem(STORAGE_KEYS.pricingEvaluationStorageVersion, 1);
}

export function createTestPricingInput(
  overrides: Partial<PricingEvaluationInput> = {},
): PricingEvaluationInput {
  return {
    ...DEFAULT_PRICING_EVALUATION_INPUT,
    evaluationDate: '2026-06-15',
    salesRepresentativeId: 'user_001',
    tariffId: TEST_TARIFF_ID,
    contractTermId: TEST_CONTRACT_TERM_24_ID,
    requestedUnitPriceCents: 9000,
    ...overrides,
  };
}
