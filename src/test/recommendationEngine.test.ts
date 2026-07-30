import { describe, expect, it } from 'vitest';
import { runBestPayRecommendationEngine } from '../domain/recommendationEngine/bestPayRecommendationEngine';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { RECOMMENDATION_FINDING_CODES } from '../domain/recommendation/recommendationFinding';
import {
  createTestCustomerNeed,
  createTestRecommendationWeightSet,
  seedTestRecommendationCatalog,
  TEST_TARIFF_ID,
} from './helpers/recommendationTestHelpers';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';

async function buildContext(withWeightSet = false) {
  seedTestRecommendationCatalog({ withWeightSet });
  const pricingCatalog = await new LocalPricingCatalogRepository().getCatalog();
  const commissionCatalog = await new LocalCommissionCatalogRepository().getCatalog();
  const tariffs = normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]);
  const products = normalizeProducts([...BESTPAY_PRODUCTS_RAW]);

  return {
    catalog: {
      tariffs,
      products,
      contractTerms: pricingCatalog.contractTerms,
    },
    tariffs,
    products,
    pricingCatalog: {
      priceBookVersions: pricingCatalog.priceBookVersions,
      priceRules: pricingCatalog.priceRules,
      contractTerms: pricingCatalog.contractTerms,
    },
    commissionCatalog: {
      commissionPlanVersions: commissionCatalog.commissionPlanVersions,
      commissionPlans: commissionCatalog.commissionPlans,
      commissionRules: commissionCatalog.commissionRules,
      assignments: commissionCatalog.assignments,
    },
    weightSet: withWeightSet ? createTestRecommendationWeightSet() : null,
    catalogVersions: {
      tariffCatalogVersion: 1,
      productCatalogVersion: 1,
      pricingCatalogVersion: 1,
      commissionCatalogVersion: 1,
      recommendationCatalogVersion: 1,
    },
    costBaselineId: null,
    costBaselineVersion: null,
  };
}

describe('BestPay recommendation engine', () => {
  it('ermittelt eine Primärempfehlung aus konfigurierten Tarifen', async () => {
    const need = createTestCustomerNeed();
    const result = runBestPayRecommendationEngine(need, await buildContext());

    expect(result.primaryCandidate).not.toBeNull();
    expect(result.scoredCandidates.length).toBeGreaterThan(0);
    expect(result.primaryCandidate!.tariffId).toBeTruthy();
    expect(result.snapshot.primaryCandidateId).toBe(result.primaryCandidate!.candidateId);
  });

  it('generiert keine Kandidaten für inaktive Tarife', async () => {
    const tariffs = normalizeTariffs([
      { ...BESTPAY_A920_TARIFFS_RAW[0]!, status: 'inactive' },
      ...BESTPAY_A920_TARIFFS_RAW.slice(1),
    ]);
    seedTestRecommendationCatalog();
    const context = await buildContext();
    const result = runBestPayRecommendationEngine(createTestCustomerNeed(), {
      ...context,
      catalog: { ...context.catalog, tariffs },
      tariffs,
    });

    const allCandidates = [
      ...result.scoredCandidates.map((entry) => entry.candidate),
      ...result.excludedCandidates,
      ...result.blockedCandidates,
    ];
    expect(allCandidates.some((candidate) => candidate.tariffId === TEST_TARIFF_ID)).toBe(false);
  });

  it('markiert unvollständigen Bedarf', async () => {
    seedTestRecommendationCatalog();
    const need = createTestCustomerNeed({ terminalCount: 0, monthlyCardVolumeCents: null });
    const result = runBestPayRecommendationEngine(need, await buildContext());
    expect(result.status).toBe('incomplete');
    expect(
      result.findings.some(
        (finding) => finding.code === RECOMMENDATION_FINDING_CODES.RECOMMENDATION_INPUT_INCOMPLETE,
      ),
    ).toBe(true);
  });

  it('nutzt A09 und blockiert Kandidaten ohne Preisregel nicht als Primärempfehlung', async () => {
    seedTestRecommendationCatalog();
    const need = createTestCustomerNeed();
    const context = await buildContext();
    const result = runBestPayRecommendationEngine(need, context);

    for (const scored of result.scoredCandidates) {
      expect(scored.candidate.pricingEvaluation).not.toBeNull();
    }

    expect(result.blockedCandidates.every((c) => c.status === 'blocked')).toBe(true);
    if (result.primaryCandidate) {
      expect(result.primaryCandidate.status).not.toBe('blocked');
    }
  });

  it('begrenzt Alternativen auf maximal zwei sinnvolle Varianten', async () => {
    const result = runBestPayRecommendationEngine(createTestCustomerNeed(), await buildContext());
    expect(result.alternatives.length).toBeLessThanOrEqual(2);
  });

  it('erzeugt reproduzierbaren Snapshot mit Fingerprint', async () => {
    const need = createTestCustomerNeed();
    const result = runBestPayRecommendationEngine(need, await buildContext());

    expect(result.inputFingerprint).toMatch(/^rec_fp_/);
    expect(result.snapshot.engineVersion).toBeTruthy();
    expect(result.snapshot.rankingOrder.length).toBe(result.scoredCandidates.length);
  });

  it('meldet fehlende Gewichtungskonfiguration ohne erfundene Produktivwerte', async () => {
    const result = runBestPayRecommendationEngine(createTestCustomerNeed(), await buildContext(false));
    expect(
      result.findings.some(
        (finding) => finding.code === RECOMMENDATION_FINDING_CODES.RECOMMENDATION_SCORE_CONFIGURATION_MISSING,
      ),
    ).toBe(true);
    expect(readStorageItem(STORAGE_KEYS.recommendationWeightSets)).toEqual([]);
  });
});
