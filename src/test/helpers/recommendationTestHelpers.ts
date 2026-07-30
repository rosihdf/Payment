/** Explizit als Testkonfiguration gekennzeichnet – nicht für produktive Seeds verwenden. */
import type { CustomerNeed } from '../../domain/recommendation/customerNeed';
import { DEFAULT_CONTRACT_PREFERENCES, normalizeCardMixNeed } from '../../domain/recommendation/customerNeed';
import type { RecommendationWeightSet } from '../../domain/recommendation/recommendationWeightSet';
import { DEFAULT_TIE_BREAKERS } from '../../domain/recommendation/recommendationWeightSet';
import { seedTestPricingCatalog, TEST_TARIFF_ID } from './pricingTestHelpers';
import { seedDemoCommissionCatalog } from './commissionTestHelpers';
import { resetRecommendationStorageForTests } from '../../services/recommendationStorageMigration';
import { STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { normalizeTariffs } from '../../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../../domain/tariff/bestPayTariffs';
import { normalizeProducts } from '../../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../../domain/product/bestPayProducts';

export const TEST_RECOMMENDATION_WEIGHT_SET_ID = 'rec_weight_set_test_v1';

export function createTestCustomerNeed(overrides: Partial<CustomerNeed> = {}): CustomerNeed {
  return {
    leadId: 'lead_test_001',
    offerId: 'offer_test_001',
    salesRepresentativeId: 'user_001',
    evaluationDate: '2026-07-01',
    industry: 'Gastronomie',
    locationCount: 1,
    terminalCount: 2,
    paymentUsage: {
      stationary: false,
      mobile: true,
      ecommerce: false,
      softPos: false,
    },
    cardMix: normalizeCardMixNeed({
      girocardPercent: 60,
      debitPercent: 10,
      creditPercent: 25,
      otherPercent: 5,
    }),
    monthlyCardVolumeCents: 5000000,
    annualCardVolumeCents: 60000000,
    monthlyTransactions: 1200,
    averageTransactionValueCents: 4167,
    contractPreferences: { ...DEFAULT_CONTRACT_PREFERENCES },
    currentSituation: null,
    costBaselineId: null,
    costBaselineVersion: null,
    requiredAccessoryProductIds: [],
    ...overrides,
  };
}

export function createTestRecommendationWeightSet(
  overrides: Partial<RecommendationWeightSet> = {},
): RecommendationWeightSet {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id: TEST_RECOMMENDATION_WEIGHT_SET_ID,
    versionNumber: 1,
    status: 'published',
    validFrom: '2026-01-01',
    validUntil: null,
    weights: {
      eligibilityScore: 100,
      needFitScore: 80,
      costScore: 90,
      termScore: 50,
      hardwareScore: 40,
      riskScore: 70,
      completenessScore: 60,
      internalBusinessScore: 10,
    },
    tieBreakers: DEFAULT_TIE_BREAKERS,
    commissionTieBreakerEnabled: false,
    maxAlternatives: 2,
    defaultProjectionMonths: 24,
    createdByUserId: 'user_004',
    publishedByUserId: 'user_004',
    publishedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function seedTestRecommendationCatalog(options?: {
  withWeightSet?: boolean;
}): void {
  resetRecommendationStorageForTests();
  seedTestPricingCatalog();
  seedDemoCommissionCatalog();

  writeStorageItem(STORAGE_KEYS.tariffs, normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]));
  writeStorageItem(STORAGE_KEYS.products, normalizeProducts([...BESTPAY_PRODUCTS_RAW]));

  if (options?.withWeightSet ?? false) {
    writeStorageItem(STORAGE_KEYS.recommendationWeightSets, [createTestRecommendationWeightSet()]);
  } else {
    writeStorageItem(STORAGE_KEYS.recommendationWeightSets, []);
  }

  writeStorageItem(STORAGE_KEYS.recommendationRecords, []);
  writeStorageItem(STORAGE_KEYS.recommendationCatalogVersion, 1);
  writeStorageItem(STORAGE_KEYS.recommendationStorageVersion, 1);
}

export { TEST_TARIFF_ID };
