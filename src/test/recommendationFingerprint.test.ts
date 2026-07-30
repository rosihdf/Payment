import { describe, expect, it } from 'vitest';
import {
  createRecommendationInputFingerprint,
  hasRecommendationInputChanged,
} from '../domain/recommendationEngine/recommendationFingerprint';
import { createTestCustomerNeed } from './helpers/recommendationTestHelpers';

describe('recommendationFingerprint', () => {
  it('ändert Fingerprint bei neuer Cost-Baseline-Version', () => {
    const need = createTestCustomerNeed();
    const base = {
      need,
      tariffCatalogVersion: 1,
      productCatalogVersion: 1,
      pricingCatalogVersion: 1,
      commissionCatalogVersion: 1,
      weightSet: null,
      costBaselineId: null,
      costBaselineVersion: null,
    };

    const withoutBaseline = createRecommendationInputFingerprint(base);
    const withBaseline = createRecommendationInputFingerprint({
      ...base,
      costBaselineId: 'baseline_1',
      costBaselineVersion: 1,
    });

    expect(hasRecommendationInputChanged(withoutBaseline, withBaseline)).toBe(true);
  });
});
