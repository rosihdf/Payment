import { describe, expect, it } from 'vitest';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import { createTestCustomerNeed } from './helpers/recommendationTestHelpers';
import {
  buildCommercialConfig,
  getAllowedContractTermMonthsForTariff,
  resolveDeploymentMode,
} from '../domain/commercial/commercialConfig';
import { calculateCommercialProjection } from '../domain/commercial/calculateCommercialProjection';
import { generateCandidatesFromCatalog } from '../domain/recommendationEngine/candidateGeneration';
import { projectCustomerCosts } from '../domain/recommendationEngine/customerCostProjection';
import { createProductionPricingCatalog } from '../domain/catalog/pricingCatalogSeed';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import type { BestPaySolutionCandidate } from '../domain/recommendation/bestPaySolutionCandidate';
import {
  createDemoClassicRules,
  seedDemoCommissionCatalog,
} from './helpers/commissionTestHelpers';
import {
  createTestContractTerm,
  createTestPriceBookVersion,
  createTestPriceRule,
  createTestPricingInput,
  seedTestPricingCatalog,
} from './helpers/pricingTestHelpers';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import type { SalesRepresentativeCommissionAssignment } from '../domain/commission/commissionAssignment';
import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';

const tariffs = normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]);
const products = normalizeProducts([...BESTPAY_PRODUCTS_RAW]);
const productMap = new Map(products.map((product) => [product.id, product]));
const classicTariff = tariffs.find((entry) => entry.id === 'tariff_bestpay_a920_classic')!;

function baseCandidate(overrides: Partial<BestPaySolutionCandidate> = {}): BestPaySolutionCandidate {
  return {
    candidateId: 'candidate_test',
    candidateCode: 'test',
    contractTypeId: null,
    tariffId: classicTariff.id,
    tariffName: classicTariff.name,
    tariffProductCode: classicTariff.productCode,
    terminalType: 'mobile',
    hardwareProductIds: [],
    hardwareProductNames: [],
    accessoryItems: [],
    contractTermId: 'contract_term_24',
    contractTermMonths: 24,
    isStandardTerm: true,
    quantity: 1,
    priceBookVersionId: null,
    pricingEvaluation: null,
    commissionPreview: null,
    costProjection: {
      currency: 'EUR',
      projectionMonths: 24,
      projectionSource: 'contract_term',
      oneTimeCostsCents: null,
      monthlyFixedCostsCents: null,
      transactionCostsCents: null,
      volumeBasedCostsCents: null,
      hardwareCostsCents: null,
      accessoryCostsCents: null,
      totalCostsCents: null,
      averageMonthlyCostsCents: null,
      costPerTransactionCents: null,
      isProjected: false,
      isComplete: false,
      missingBasis: [],
      assumptions: [],
    },
    fulfilledRequirements: [],
    unfulfilledRequirements: [],
    hints: [],
    warnings: [],
    exclusionReasons: [],
    status: 'eligible',
    rank: null,
    ...overrides,
  };
}

describe('Phase 2 – Commercial Truth', () => {
  it('T1: stationär/WLAN ohne SIM-Aufpreis', () => {
    const need = createTestCustomerNeed({
      terminalCount: 1,
      paymentUsage: { stationary: true, mobile: false, ecommerce: false, softPos: false },
      monthlyCardVolumeCents: 500_000,
      monthlyTransactions: 100,
    });
    const config = buildCommercialConfig({
      need,
      candidate: baseCandidate(),
      tariff: classicTariff,
      products: productMap,
    });
    expect(config.deploymentMode).toBe('stationary_wifi');
    expect(config.simMonthlyFeeCents).toBe(0);

    const projection = calculateCommercialProjection(need, config);
    expect(projection.isComplete).toBe(true);
    expect(projection.breakdown.monthlySimCents).toBe(0);
    expect(projection.breakdown.monthlyFixedTotalCents).toBeGreaterThan(0);
    expect(projection.breakdown.monthlyVariableTotalCents).toBeGreaterThan(0);
  });

  it('T2: mobil/SIM mit Aufpreis', () => {
    const need = createTestCustomerNeed({
      terminalCount: 1,
      paymentUsage: { stationary: false, mobile: true, ecommerce: false, softPos: false },
      monthlyCardVolumeCents: 500_000,
      monthlyTransactions: 100,
    });
    const config = buildCommercialConfig({
      need,
      candidate: baseCandidate(),
      tariff: classicTariff,
      products: productMap,
    });
    expect(config.deploymentMode).toBe('mobile_sim');
    expect(config.simMonthlyFeeCents).toBe(495);

    const projection = calculateCommercialProjection(need, config);
    expect(projection.breakdown.monthlySimCents).toBe(495);
    expect(projection.isComplete).toBe(true);
  });

  it('T3: Kartenmix mit 5.000 € und 100 Tx', () => {
    const need = createTestCustomerNeed({
      monthlyCardVolumeCents: 500_000,
      monthlyTransactions: 100,
    });
    const config = buildCommercialConfig({
      need,
      candidate: baseCandidate(),
      tariff: classicTariff,
      products: productMap,
    });
    const projection = calculateCommercialProjection(need, config);
    expect(projection.isComplete).toBe(true);
    expect(projection.breakdown.monthlyCardFeesCents).toBeGreaterThan(0);
    expect(projection.breakdown.monthlyTransactionFixedCents).toBeGreaterThan(0);
  });

  it('T4: zulässige Laufzeiten aus CommercialConfig', () => {
    for (const tariff of tariffs) {
      const months = getAllowedContractTermMonthsForTariff(tariff.id);
      expect(months).toEqual([24, 36]);
    }
    expect(createProductionPricingCatalog().contractTerms.map((term) => term.months)).toEqual([
      24, 36,
    ]);
  });

  it('T5: Provision bei 36 Monaten Terminal+ACQ ist UNGEKLÄRT (blockiert)', () => {
    seedDemoCommissionCatalog('classic');
    seedTestPricingCatalog();
    const pricing = evaluatePricing(
      createTestPricingInput({ contractTermId: createTestContractTerm({ months: 36 }).id }),
      {
        priceBookVersions: [createTestPriceBookVersion()],
        priceRules: [createTestPriceRule()],
        contractTerms: [createTestContractTerm({ months: 36 })],
      },
    );
    const input: CommissionCalculationInput = {
      evaluationDate: '2026-06-15',
      offerId: 'offer_test',
      offerVersionKey: 'offer_test:v1',
      salesRepresentativeId: FIELD_SERVICE_USER_ID,
      pricingEvaluationRecordId: 'pricing_eval_record_test',
      pricingEvaluationResult: { ...pricing, termMonths: 36, stale: false },
      contractTypeCode: 'terminal_plus_acq',
      accessoryItems: [],
    };
    const result = evaluateCommission(input, {
      commissionPlans: readStorageItem<CommissionPlan[]>(STORAGE_KEYS.commissionPlans) ?? [],
      commissionPlanVersions:
        readStorageItem<CommissionPlanVersion[]>(STORAGE_KEYS.commissionPlanVersions) ?? [],
      commissionRules: createDemoClassicRules(),
      assignments:
        readStorageItem<SalesRepresentativeCommissionAssignment[]>(
          STORAGE_KEYS.commissionAssignments,
        ) ?? [],
      ruleOverrides: [],
    });
    expect(result.calculationBlocked).toBe(true);
    expect(result.baseCommissionAmountCents).toBe(0);
    expect(result.findings.some((f) => f.code === 'COMMISSION_TERM_AMBIGUOUS_36_MONTHS')).toBe(true);
  });

  it('T6: fehlende Kondition markiert Projection incomplete', () => {
    const need = createTestCustomerNeed({
      monthlyCardVolumeCents: null,
      monthlyTransactions: null,
    });
    const config = buildCommercialConfig({
      need,
      candidate: baseCandidate(),
      tariff: classicTariff,
      products: productMap,
    });
    const projection = calculateCommercialProjection(need, config);
    expect(projection.isComplete).toBe(false);
    expect(projection.missingCommercialData.some((entry) => entry.code === 'need.monthlyCardVolumeCents')).toBe(
      true,
    );
  });

  it('T7: Recommendation dedupliziert Kandidaten', () => {
    const need = createTestCustomerNeed();
    const catalog = {
      tariffs,
      products,
      contractTerms: createProductionPricingCatalog().contractTerms,
    };
    const candidates = generateCandidatesFromCatalog(need, catalog);
    const codes = candidates.map((entry) => entry.candidateCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('T8: Realfall AMRtech – vollständige Monatskosten', () => {
    const need = createTestCustomerNeed({
      terminalCount: 1,
      monthlyCardVolumeCents: 500_000,
      monthlyTransactions: 100,
      paymentUsage: { stationary: true, mobile: false, ecommerce: false, softPos: false },
      contractPreferences: {
        preferredTermMonths: 24,
        maxAcceptedTermMonths: null,
        preferLowFixedCosts: false,
        preferLowVariableCosts: false,
        preferLowInitialCosts: false,
        preferPriceStability: false,
        preferFlexibility: false,
        specialTermRequested: false,
      },
    });
    const candidate = baseCandidate({ contractTermMonths: 24, quantity: 1 });
    const projection = projectCustomerCosts(need, candidate, classicTariff, productMap, 24);
    expect(projection.isComplete).toBe(true);
    expect(projection.averageMonthlyCostsCents).not.toBeNull();
    expect(projection.totalCostsCents).not.toBeNull();
    expect(resolveDeploymentMode(need)).toBe('stationary_wifi');
  });
});
