import { describe, expect, it } from 'vitest';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import {
  createProductionBaselineCatalog,
  PRODUCTION_BASELINE_CATALOG_VERSION,
} from '../domain/catalog/productionBaselineCatalog';
import {
  PRODUCTION_APPROVAL_RULE_DISCOUNT_ABOVE_THRESHOLD_ID,
  PRODUCTION_APPROVAL_RULE_MISSING_REQUIRED_DATA_ID,
  PRODUCTION_APPROVAL_RULE_PRICE_BELOW_MINIMUM_ID,
} from '../domain/catalog/approvalRuleCatalogSeed';
import {
  PRODUCTION_DOCUMENT_TEMPLATE_FOLLOW_UP_NOTE_ID,
  PRODUCTION_DOCUMENT_TEMPLATE_OFFER_PDF_ID,
} from '../domain/catalog/documentTemplateCatalogSeed';
import { PRODUCTION_RECOMMENDATION_WEIGHT_SET_ID } from '../domain/catalog/recommendationCatalogSeed';
import {
  PRODUCTION_CONTRACT_TERM_24_ID,
  PRODUCTION_CONTRACT_TERM_36_ID,
  PRODUCTION_PRICE_BOOK_ID,
  PRODUCTION_PRICE_RULE_TARIFF_CLASSIC_ID,
} from '../domain/catalog/pricingCatalogSeed';
import {
  DEFAULT_COMMISSION_PLAN_CLASSIC_ID,
  DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_1_ID,
  DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_2_ID,
} from '../services/commissionCatalogSeed';
import { generateCandidatesFromCatalog } from '../domain/recommendationEngine/candidateGeneration';
import { createTestCustomerNeed } from './helpers/recommendationTestHelpers';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { evaluatePricing } from '../domain/pricingEngine/pricingEvaluationEngine';
import { createProductionPricingCatalog } from '../domain/catalog/pricingCatalogSeed';
import { DEFAULT_PRICING_EVALUATION_INPUT } from '../domain/pricing/pricingEvaluationDefaults';
import { PRICING_ENGINE_VERSION } from '../domain/pricing/pricingEvaluation';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import { createDefaultCommissionCatalog } from '../services/commissionCatalogSeed';

describe('productionBaselineCatalog', () => {
  it('enthält kanonische Tarife und Produkte mit stabilen IDs', () => {
    const catalog = createProductionBaselineCatalog('admin_test');

    expect(catalog.version).toBe(PRODUCTION_BASELINE_CATALOG_VERSION);
    expect(catalog.tariffs).toHaveLength(BESTPAY_A920_TARIFFS_RAW.length);
    expect(catalog.products).toHaveLength(BESTPAY_PRODUCTS_RAW.length);
    expect(catalog.tariffs.some((tariff) => tariff.id === 'tariff_bestpay_a920_classic')).toBe(true);
    expect(catalog.products.some((product) => product.id === 'product_speedypay_ccv_a920')).toBe(true);
    expect(catalog.products.some((product) => product.category === 'accessory')).toBe(true);
  });

  it('enthält stabile Freigabe- und Vorlagen-IDs', () => {
    const catalog = createProductionBaselineCatalog('admin_test');

    expect(catalog.approvalRules.map((rule) => rule.id)).toEqual([
      PRODUCTION_APPROVAL_RULE_PRICE_BELOW_MINIMUM_ID,
      PRODUCTION_APPROVAL_RULE_DISCOUNT_ABOVE_THRESHOLD_ID,
      PRODUCTION_APPROVAL_RULE_MISSING_REQUIRED_DATA_ID,
    ]);
    expect(catalog.documentTemplates.map((template) => template.id)).toEqual([
      PRODUCTION_DOCUMENT_TEMPLATE_OFFER_PDF_ID,
      PRODUCTION_DOCUMENT_TEMPLATE_FOLLOW_UP_NOTE_ID,
    ]);
    expect(catalog.recommendationWeightSets[0]?.id).toBe(PRODUCTION_RECOMMENDATION_WEIGHT_SET_ID);
  });

  it('enthält Classic und Variable Modell 1/2 aus commissionCatalogSeed', () => {
    const catalog = createProductionBaselineCatalog('admin_test');

    expect(catalog.commissionPlans.map((plan) => plan.id)).toEqual([
      DEFAULT_COMMISSION_PLAN_CLASSIC_ID,
      DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_1_ID,
      DEFAULT_COMMISSION_PLAN_VARIABLE_MODEL_2_ID,
    ]);
    expect(catalog.commissionRules.some((rule) => rule.id === 'commission_rule_model1_terminal')).toBe(
      true,
    );
    expect(catalog.commissionRules.some((rule) => rule.id === 'commission_rule_model2_girocard')).toBe(
      true,
    );
  });

  it('leitet Preisregeln aus Tarifgebühren ab', () => {
    const catalog = createProductionBaselineCatalog('admin_test');
    const classicRule = catalog.priceRules.find((rule) => rule.id === PRODUCTION_PRICE_RULE_TARIFF_CLASSIC_ID);

    expect(catalog.priceBooks[0]?.id).toBe(PRODUCTION_PRICE_BOOK_ID);
    expect(catalog.contractTerms.map((term) => term.id)).toContain(PRODUCTION_CONTRACT_TERM_24_ID);
    expect(catalog.contractTerms.map((term) => term.id)).toContain(PRODUCTION_CONTRACT_TERM_36_ID);
    expect(classicRule?.listPriceCents).toBe(1790);
  });
});

describe('production catalog parity engines', () => {
  it('erzeugt Tarifkandidaten für Recommendation', () => {
    const need = createTestCustomerNeed();
    const candidates = generateCandidatesFromCatalog(need, {
      tariffs: normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]),
      products: normalizeProducts([...BESTPAY_PRODUCTS_RAW]),
      contractTerms: createProductionPricingCatalog().contractTerms,
    });

    expect(candidates.length).toBeGreaterThan(0);
  });

  it('löst Pricing für Classic-Tarif auf', () => {
    const pricing = createProductionPricingCatalog();
    const result = evaluatePricing(
      {
        ...DEFAULT_PRICING_EVALUATION_INPUT,
        evaluationDate: '2026-07-01',
        tariffId: 'tariff_bestpay_a920_classic',
        contractTermId: PRODUCTION_CONTRACT_TERM_36_ID,
      },
      pricing,
    );

    expect(result.listPriceCents).toBe(1790);
    expect(result.approval.approvalBlocked).toBe(false);
  });

  it('löst Commission Classic-Plan auf', () => {
    const seed = createDefaultCommissionCatalog('admin_test');
    const result = evaluateCommission(
      {
        evaluationDate: '2026-07-01',
        offerId: 'offer_test',
        offerVersionKey: 'v1',
        salesRepresentativeId: 'admin_test',
        pricingEvaluationRecordId: 'preview',
        pricingEvaluationResult: {
          evaluationId: 'preview',
          evaluatedAt: '2026-07-01T00:00:00.000Z',
          engineVersion: PRICING_ENGINE_VERSION,
          inputFingerprint: 'preview',
          priceBookVersionId: null,
          priceBookVersionNumber: null,
          appliedRules: [],
          rejectedRules: [],
          listPriceCents: null,
          targetPriceCents: null,
          minimumPriceCents: null,
          maxDiscountPercentTenths: null,
          recommendedPriceCents: null,
          requestedPriceCents: null,
          evaluatedPriceCents: null,
          absoluteDeviationCents: null,
          percentDeviationTenths: null,
          currency: 'EUR',
          unit: 'month',
          termMonths: 48,
          isStandardTerm: false,
          isSpecialTerm: true,
          termAllowed: true,
          specialTermReason: '',
          reviewClass: 'standard',
          stale: false,
          approval: {
            reviewClass: 'standard',
            adminReviewRequired: true,
            quickReviewPossible: true,
            detailReviewRequired: false,
            approvalBlocked: false,
            requiredAdminRole: 'admin',
            reasons: [],
            warnings: [],
            violations: [],
            requiredJustifications: [],
            priceSummary: '',
            termSummary: '',
            configurationSummary: '',
            internalRecommendation: '',
          },
          findings: [],
          snapshot: {} as never,
        },
        contractTypeCode: 'terminal_plus_acq',
        accessoryItems: [],
      },
      {
        commissionPlans: seed.plans,
        commissionPlanVersions: seed.planVersions,
        commissionRules: seed.rules,
        assignments: [
          {
            id: 'assignment_test',
            salesRepresentativeId: 'admin_test',
            commissionPlanVersionId: seed.planVersions[0]!.id,
            currentVersionId: null,
            validFrom: '2026-01-01',
            validUntil: null,
            isPrimary: true,
            status: 'active',
            reason: 'Test',
            createdByUserId: 'admin_test',
            approvedByUserId: 'admin_test',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    );

    expect(result.baseCommissionAmountCents).toBe(30000);
  });
});
