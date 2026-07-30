import { describe, expect, it } from 'vitest';
import { PRICING_FINDING_CODES } from '../domain/pricing/pricingFinding';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import {
  createTestContractTerm,
  createTestPriceBookVersion,
  createTestPriceRule,
  createTestPricingInput,
  seedTestPricingCatalog,
  TEST_CONTRACT_TERM_24_ID,
  TEST_PRICE_BOOK_VERSION_ID,
  TEST_TARIFF_ID,
} from './helpers/pricingTestHelpers';

describe('pricing evaluation engine', () => {
  it('returns standard review for regular case', () => {
    seedTestPricingCatalog();
    const result = evaluatePricing(createTestPricingInput({ requestedUnitPriceCents: 11000 }), {
      priceBookVersions: [createTestPriceBookVersion()],
      priceRules: [
        createTestPriceRule(),
        createTestPriceRule({
          tariffId: TEST_TARIFF_ID,
          priority: 50,
          listPriceCents: 12000,
          targetPriceCents: 11000,
          minimumPriceCents: 9500,
        }),
      ],
      contractTerms: [createTestContractTerm()],
    });

    expect(result.reviewClass).toBe('standard');
    expect(result.approval.adminReviewRequired).toBe(true);
    expect(result.approval.quickReviewPossible).toBe(true);
  });

  it('blocks when price book is missing', () => {
    const result = evaluatePricing(createTestPricingInput(), {
      priceBookVersions: [],
      priceRules: [createTestPriceRule()],
      contractTerms: [createTestContractTerm()],
    });

    expect(result.reviewClass).toBe('critical');
    expect(result.approval.approvalBlocked).toBe(true);
    expect(result.findings.some((f) => f.code === PRICING_FINDING_CODES.PRICE_BOOK_NOT_FOUND)).toBe(
      true,
    );
  });

  it('marks price below minimum as critical', () => {
    seedTestPricingCatalog();
    const result = evaluatePricing(createTestPricingInput({ requestedUnitPriceCents: 7000 }), {
      priceBookVersions: [createTestPriceBookVersion()],
      priceRules: [createTestPriceRule({ tariffId: TEST_TARIFF_ID, minimumPriceCents: 9500 })],
      contractTerms: [createTestContractTerm()],
    });

    expect(result.reviewClass).toBe('critical');
    expect(result.findings.some((f) => f.code === PRICING_FINDING_CODES.PRICE_BELOW_MINIMUM)).toBe(
      true,
    );
  });

  it('marks below target as attention', () => {
    seedTestPricingCatalog();
    const result = evaluatePricing(createTestPricingInput({ requestedUnitPriceCents: 8500 }), {
      priceBookVersions: [createTestPriceBookVersion()],
      priceRules: [
        createTestPriceRule({
          tariffId: TEST_TARIFF_ID,
          targetPriceCents: 9000,
          minimumPriceCents: 8000,
        }),
      ],
      contractTerms: [createTestContractTerm()],
    });

    expect(result.reviewClass).toBe('attention');
  });

  it('stores reproducible snapshot data', () => {
    seedTestPricingCatalog();
    const input = createTestPricingInput();
    const result = evaluatePricing(input, {
      priceBookVersions: [createTestPriceBookVersion()],
      priceRules: [createTestPriceRule({ tariffId: TEST_TARIFF_ID })],
      contractTerms: [createTestContractTerm({ id: TEST_CONTRACT_TERM_24_ID })],
    });

    expect(result.snapshot.priceBookVersionId).toBe(TEST_PRICE_BOOK_VERSION_ID);
    expect(result.snapshot.input.tariffId).toBe(input.tariffId);
    expect(result.snapshot.appliedRuleIds.length).toBeGreaterThan(0);
  });
});
