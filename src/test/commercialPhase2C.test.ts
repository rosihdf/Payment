import { describe, expect, it } from 'vitest';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import type { CommissionContractConfiguration } from '../domain/commission/commissionContractConfiguration';
import {
  buildCommercialTermSelectOptions,
  getCommercialTermOptions,
  isTermOfferedForSelection,
  normalizeReadableTermMonths,
  PRODUCT_EC_MOBILE_PREMIUM_ID,
} from '../domain/commercial/commercialTermCapability';
import {
  FLAT_MARKUP_RULES,
  hasFlatMarkupVolumeBasis,
} from '../domain/commercial/commercialMarkupCatalog';
import { getResolvedCommissionSourceDecisions } from '../domain/commercial/commissionSourceConflict';
import {
  createDefaultCommissionCatalog,
  createVariableModel1CommissionRules,
  createVariableModel2CommissionRules,
} from '../services/commissionCatalogSeed';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import type { PricingEvaluationResult } from '../domain/pricing/pricingEvaluation';
import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import { createDemoClassicRules, seedDemoCommissionCatalog } from './helpers/commissionTestHelpers';
import {
  createTestContractTerm,
  createTestPriceBookVersion,
  createTestPriceRule,
  createTestPricingInput,
  seedTestPricingCatalog,
} from './helpers/pricingTestHelpers';
import { FIELD_SERVICE_USER_ID } from './helpers/offerTestHelpers';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import type { CommissionPlan, CommissionPlanVersion } from '../domain/commission/commissionPlan';
import type { SalesRepresentativeCommissionAssignment } from '../domain/commission/commissionAssignment';
import { createTestCustomerNeed } from './helpers/recommendationTestHelpers';
import { calculateCommercialProjection } from '../domain/commercial/calculateCommercialProjection';
import { buildCommercialConfig } from '../domain/commercial/commercialConfig';
import type { BestPaySolutionCandidate } from '../domain/recommendation/bestPaySolutionCandidate';

function buildPricingResult(overrides: Partial<PricingEvaluationResult> = {}): PricingEvaluationResult {
  seedTestPricingCatalog();
  const input = createTestPricingInput({ contractTermId: createTestContractTerm().id });
  const result = evaluatePricing(input, {
    priceBookVersions: [createTestPriceBookVersion()],
    priceRules: [createTestPriceRule()],
    contractTerms: [createTestContractTerm({ months: 24 })],
  });
  return { ...result, stale: false, ...overrides };
}

function buildCommissionInput(
  pricing: PricingEvaluationResult,
  contractConfiguration: CommissionContractConfiguration,
): CommissionCalculationInput {
  return {
    evaluationDate: '2026-06-15',
    offerId: 'offer_test',
    offerVersionKey: 'v1',
    salesRepresentativeId: FIELD_SERVICE_USER_ID,
    pricingEvaluationRecordId: 'pricing_eval',
    pricingEvaluationResult: pricing,
    contractConfiguration,
    contractTypeCode: null,
    accessoryItems: [],
  };
}

function loadDemoCatalog() {
  return {
    commissionPlans: readStorageItem<CommissionPlan[]>(STORAGE_KEYS.commissionPlans) ?? [],
    commissionPlanVersions:
      readStorageItem<CommissionPlanVersion[]>(STORAGE_KEYS.commissionPlanVersions) ?? [],
    commissionRules: createDemoClassicRules(),
    assignments:
      readStorageItem<SalesRepresentativeCommissionAssignment[]>(STORAGE_KEYS.commissionAssignments) ??
      [],
    ruleOverrides: [],
  };
}

const tariffs = normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]);
const products = normalizeProducts([...BESTPAY_PRODUCTS_RAW]);

describe('Phase 2C – Commercial Truth', () => {
  describe('Laufzeiten', () => {
    it('dokumentiertes 36 für Mietkasse T2', () => {
      const options = getCommercialTermOptions('product_speedypay_t2');
      expect(options.documentedTermsMonths).toEqual([36]);
      expect(options.customTermAllowed).toBe(true);
    });

    it('dokumentiertes 48 für EC Mobile Premium', () => {
      const options = getCommercialTermOptions(PRODUCT_EC_MOBILE_PREMIUM_ID);
      expect(options.documentedTermsMonths).toEqual([48]);
      expect(options.customTermAllowed).toBe(false);
    });

    it('A920-Tarif: custom/on-request, kein festes 24/36', () => {
      const options = getCommercialTermOptions(null, {
        tariffId: 'tariff_bestpay_a920_classic',
      });
      expect(options.documentedTermsMonths).toEqual([]);
      expect(options.customTermAllowed).toBe(true);
      expect(isTermOfferedForSelection(24, options)).toBe(false);
      expect(isTermOfferedForSelection(36, options)).toBe(false);
    });

    it('24 nicht mehr angeboten, aber historisch lesbar', () => {
      const options = getCommercialTermOptions(null, {
        tariffId: 'tariff_bestpay_a920_classic',
      });
      const selectOptions = buildCommercialTermSelectOptions(options, 24);
      expect(selectOptions.some((entry) => entry.months === 24 && entry.legacy)).toBe(true);
      expect(normalizeReadableTermMonths(24, options)).toBe(24);
    });

    it('48 bleibt lesbar bei custom-Tarif', () => {
      const options = getCommercialTermOptions(null, {
        tariffId: 'tariff_bestpay_a920_classic',
      });
      expect(normalizeReadableTermMonths(48, options)).toBe(48);
    });
  });

  describe('Provision', () => {
    it('>36 klassisch Terminal+ACQ = 300 €', () => {
      seedDemoCommissionCatalog('classic');
      const result = evaluateCommission(
        buildCommissionInput(buildPricingResult({ termMonths: 48 }), 'terminal_acq_long_term'),
        loadDemoCatalog(),
      );
      expect(result.calculationBlocked).toBe(false);
      expect(result.baseCommissionAmountCents).toBe(30000);
    });

    it('36 Monate Terminal+ACQ = 300 € (long_term)', () => {
      seedDemoCommissionCatalog('classic');
      const result = evaluateCommission(
        buildCommissionInput(buildPricingResult({ termMonths: 36 }), 'terminal_acq_long_term'),
        loadDemoCatalog(),
      );
      expect(result.calculationBlocked).toBe(false);
      expect(result.baseCommissionAmountCents).toBe(30000);
    });

    it('Modell 1 Terminal-Schwelle 12 € im Seed', () => {
      const rules = createVariableModel1CommissionRules();
      const terminalRule = rules.find((rule) => rule.id === 'commission_rule_model1_terminal');
      expect(terminalRule?.thresholdTenthsOfCent).toBe(1200);
      expect(terminalRule?.percentTenthsOfBasisPoint).toBe(3000);
    });

    it('Modell 2 Giro 30 % ab 0,30 % im Seed', () => {
      const rules = createVariableModel2CommissionRules();
      const giroRule = rules.find((rule) => rule.id === 'commission_rule_model2_girocard');
      expect(giroRule?.commissionType).toBe('girocard_share');
      expect(giroRule?.percentTenthsOfBasisPoint).toBe(3000);
      expect(giroRule?.thresholdTenthsOfCent).toBe(30);
    });

    it('Modell 2 Tx 0,01 € bei VK 0,04 € im Seed', () => {
      const rules = createVariableModel2CommissionRules();
      const txRule = rules.find((rule) => rule.id === 'commission_rule_model2_transaction_fixed');
      expect(txRule?.fixedAmountCents).toBe(1);
      expect(txRule?.thresholdTenthsOfCent).toBe(40);
    });

    it('PPT-Priorität dokumentiert (Conflicts aufgelöst)', () => {
      expect(getResolvedCommissionSourceDecisions().length).toBeGreaterThan(0);
    });

    it('Default-Katalog trennt Modell 1 und Modell 2', () => {
      const catalog = createDefaultCommissionCatalog('admin_test');
      expect(catalog.plans.map((plan) => plan.planKind)).toEqual([
        'classic',
        'variable_model_1',
        'variable_model_2',
      ]);
      const model1RuleIds = catalog.rules
        .filter((rule) => rule.commissionPlanVersionId.includes('model_1'))
        .map((rule) => rule.id);
      const model2RuleIds = catalog.rules
        .filter((rule) => rule.commissionPlanVersionId.includes('model_2'))
        .map((rule) => rule.id);
      expect(model1RuleIds).toContain('commission_rule_model1_terminal');
      expect(model2RuleIds).toContain('commission_rule_model2_girocard');
      expect(model1RuleIds).not.toContain('commission_rule_model2_girocard');
    });
  });

  describe('Flat-Markups', () => {
    it('Markup-Regeln im Katalog vorhanden', () => {
      expect(FLAT_MARKUP_RULES).toHaveLength(2);
      expect(FLAT_MARKUP_RULES[0]?.markupTenthsOfBasisPoint).toBe(1490);
      expect(FLAT_MARKUP_RULES[1]?.markupTenthsOfBasisPoint).toBe(1590);
    });

    it('ohne Umsatzbasis keine Flat-Markup-Berechnung', () => {
      const need = createTestCustomerNeed({
        monthlyCardVolumeCents: 500_000,
        monthlyTransactions: 100,
      });
      const flatTariff = tariffs.find((entry) => entry.id === 'tariff_bestpay_a920_flat')!;
      const candidate: BestPaySolutionCandidate = {
        candidateId: 'c1',
        candidateCode: 'flat',
        contractTypeId: null,
        tariffId: flatTariff.id,
        tariffName: flatTariff.name,
        tariffProductCode: flatTariff.productCode,
        terminalType: 'mobile',
        hardwareProductIds: [],
        hardwareProductNames: [],
        accessoryItems: [],
        contractTermId: null,
        contractTermMonths: 36,
        isStandardTerm: false,
        quantity: 1,
        priceBookVersionId: null,
        pricingEvaluation: null,
        commissionPreview: null,
        costProjection: {} as never,
        fulfilledRequirements: [],
        unfulfilledRequirements: [],
        hints: [],
        warnings: [],
        exclusionReasons: [],
        status: 'eligible',
        rank: null,
      };
      expect(hasFlatMarkupVolumeBasis(need)).toBe(false);
      const config = buildCommercialConfig({
        need,
        candidate,
        tariff: flatTariff,
        products: new Map(products.map((product) => [product.id, product])),
      });
      const projection = calculateCommercialProjection(need, config);
      expect(
        projection.missingCommercialData.some(
          (entry) => entry.code === 'commercial.flatNonEwrMarkup',
        ),
      ).toBe(true);
      expect(
        projection.missingCommercialData.some(
          (entry) => entry.code === 'commercial.flatCommercialMarkup',
        ),
      ).toBe(true);
    });
  });
});
