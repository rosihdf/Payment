import { describe, expect, it } from 'vitest';
import type { SalesRepresentativeCommissionAssignment } from '../domain/commission/commissionAssignment';
import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';
import { maxAllowedReductionAmountCents } from '../domain/commission/commissionReduction';
import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import type { PricingEvaluationResult } from '../domain/pricing/pricingEvaluation';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import { parseCurrencyToTenthsOfCent } from '../utils/tenthsOfCent';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import {
  createDemoClassicRules,
  seedDemoCommissionCatalog,
} from './helpers/commissionTestHelpers';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
import {
  createTestContractTerm,
  createTestPriceBookVersion,
  createTestPriceRule,
  createTestPricingInput,
  seedTestPricingCatalog,
} from './helpers/pricingTestHelpers';

function loadDemoCatalog() {
  return {
    commissionPlans: readStorageItem<CommissionPlan[]>(STORAGE_KEYS.commissionPlans) ?? [],
    commissionPlanVersions:
      readStorageItem<CommissionPlanVersion[]>(STORAGE_KEYS.commissionPlanVersions) ?? [],
    commissionRules: createDemoClassicRules(),
    assignments:
      readStorageItem<SalesRepresentativeCommissionAssignment[]>(STORAGE_KEYS.commissionAssignments) ??
      [],
  };
}

function buildPricingResult(overrides: Partial<PricingEvaluationResult> = {}): PricingEvaluationResult {
  seedTestPricingCatalog();
  const input = createTestPricingInput({ contractTermId: createTestContractTerm().id });
  const result = evaluatePricing(input, {
    priceBookVersions: [createTestPriceBookVersion()],
    priceRules: [createTestPriceRule()],
    contractTerms: [createTestContractTerm({ months: 24 })],
  });

  return {
    ...result,
    termMonths: 48,
    stale: false,
    ...overrides,
  };
}

function buildInput(
  pricing: PricingEvaluationResult,
  contractTypeCode: string,
): CommissionCalculationInput {
  return {
    evaluationDate: '2026-06-15',
    offerId: 'offer_test',
    offerVersionKey: 'offer_test:v1',
    salesRepresentativeId: FIELD_SERVICE_USER_ID,
    pricingEvaluationRecordId: 'pricing_eval_record_test',
    pricingEvaluationResult: pricing,
    contractTypeCode,
    accessoryItems: [],
  };
}

describe('commission calculation engine', () => {
  it('blockiert exakt 36 Monate für Terminal+ACQ (PPT: weder >36 noch <36)', () => {
    seedDemoCommissionCatalog('classic');
    const result = evaluateCommission(
      buildInput(buildPricingResult({ termMonths: 36 }), 'terminal_plus_acq'),
      loadDemoCatalog(),
    );

    expect(result.calculationBlocked).toBe(true);
    expect(result.findings.some((f) => f.code === 'COMMISSION_TERM_AMBIGUOUS_36_MONTHS')).toBe(true);
    expect(result.baseCommissionAmountCents).toBe(0);
  });

  it('calculates classic terminal plus acq >36 months as 300 EUR', () => {
    seedDemoCommissionCatalog('classic');
    const result = evaluateCommission(
      buildInput(buildPricingResult({ termMonths: 48 }), 'terminal_plus_acq'),
      loadDemoCatalog(),
    );

    expect(result.baseCommissionAmountCents).toBe(30000);
    expect(result.status).not.toBe('blocked');
  });

  it('calculates classic terminal <36 months as 200 EUR', () => {
    seedDemoCommissionCatalog('classic');
    const result = evaluateCommission(
      buildInput(buildPricingResult({ termMonths: 24 }), 'terminal_only'),
      loadDemoCatalog(),
    );

    expect(result.baseCommissionAmountCents).toBe(20000);
  });

  it('calculates accessory commission at 20 percent of sale price', () => {
    seedDemoCommissionCatalog('classic');
    const input = buildInput(buildPricingResult({ termMonths: 48 }), 'terminal_plus_acq');
    input.accessoryItems = [{ productId: 'acc_sim', quantity: 2, salePriceCents: 1000 }];

    const result = evaluateCommission(input, loadDemoCatalog());
    expect(result.accessoryCommissionAmountCents).toBe(400);
  });
});

describe('commission reduction limits', () => {
  it('allows at most 50 percent reduction', () => {
    expect(maxAllowedReductionAmountCents(30000)).toBe(15000);
    expect(maxAllowedReductionAmountCents(10000)).toBe(5000);
  });
});

describe('threshold precision', () => {
  it('stores 0.039 EUR as 39 tenths of cent', () => {
    expect(parseCurrencyToTenthsOfCent('0,039')).toBe(39);
    expect(parseCurrencyToTenthsOfCent('0,014')).toBe(14);
  });
});
