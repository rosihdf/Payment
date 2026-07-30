import { evaluateCommission } from '../commissionEngine/commissionCalculationEngine';
import { evaluatePricing } from '../pricingEngine/pricingEvaluationEngine';
import type { Product } from '../product/product';
import type { Tariff } from '../tariff/tariff';
import type { CustomerNeed } from '../recommendation/customerNeed';
import { assessNeedCompleteness } from '../recommendation/customerNeed';
import type {
  BestPaySolutionCandidate,
  ScoredCandidate,
} from '../recommendation/bestPaySolutionCandidate';
import {
  RECOMMENDATION_ENGINE_VERSION,
  type BestPayRecommendationResult,
} from '../recommendation/recommendationResult';
import {
  createRecommendationFinding,
  RECOMMENDATION_FINDING_CODES,
} from '../recommendation/recommendationFinding';
import { createRecommendationSnapshotFromResult } from '../recommendation/recommendationSnapshot';
import type { RecommendationWeightSet } from '../recommendation/recommendationWeightSet';
import { buildCommissionCalculationInputFromCandidate } from './buildCommissionInputFromCandidate';
import { buildPricingEvaluationInputFromCandidate } from './buildPricingInputFromCandidate';
import {
  applyPricingEligibility,
  evaluateCandidateEligibility,
  type EligibilityCatalogLookup,
} from './candidateEligibility';
import {
  generateCandidatesFromCatalog,
  type RecommendationCatalogData,
} from './candidateGeneration';
import { projectCustomerCosts } from './customerCostProjection';
import { createRecommendationInputFingerprint } from './recommendationFingerprint';
import {
  buildPrimaryReasons,
  rankCandidates,
  selectAlternatives,
} from './recommendationRanking';
import { scoreCandidate } from './recommendationScoring';
import { generateId } from '../../utils/id';

export interface BestPayRecommendationEngineContext {
  catalog: RecommendationCatalogData;
  tariffs: Tariff[];
  products: Product[];
  pricingCatalog: {
    priceBookVersions: import('../pricing/priceBook').PriceBookVersion[];
    priceRules: import('../pricing/priceRule').PriceRule[];
    contractTerms: import('../pricing/contractTerm').ContractTerm[];
  };
  commissionCatalog: import('../commission/commissionCalculationInput').CommissionCalculationContext;
  weightSet: RecommendationWeightSet | null;
  catalogVersions: {
    tariffCatalogVersion: number | null;
    productCatalogVersion: number | null;
    pricingCatalogVersion: number | null;
    commissionCatalogVersion: number | null;
    recommendationCatalogVersion: number | null;
  };
  costBaselineId: string | null;
  costBaselineVersion: number | null;
}

export function runBestPayRecommendationEngine(
  need: CustomerNeed,
  context: BestPayRecommendationEngineContext,
): BestPayRecommendationResult {
  const createdAt = new Date().toISOString();
  const needCompleteness = assessNeedCompleteness(need);
  const findings = [];

  const tariffMap = new Map(context.tariffs.map((tariff) => [tariff.id, tariff]));
  const productMap = new Map(context.products.map((product) => [product.id, product]));
  const eligibilityLookup: EligibilityCatalogLookup = { tariffs: tariffMap, products: productMap };

  const inputFingerprint = createRecommendationInputFingerprint({
    need,
    tariffCatalogVersion: context.catalogVersions.tariffCatalogVersion,
    productCatalogVersion: context.catalogVersions.productCatalogVersion,
    pricingCatalogVersion: context.catalogVersions.pricingCatalogVersion,
    commissionCatalogVersion: context.catalogVersions.commissionCatalogVersion,
    weightSet: context.weightSet,
    costBaselineId: context.costBaselineId,
    costBaselineVersion: context.costBaselineVersion,
  });

  if (context.tariffs.length === 0) {
    findings.push(
      createRecommendationFinding({
        code: RECOMMENDATION_FINDING_CODES.RECOMMENDATION_CATALOG_EMPTY,
        severity: 'blocking',
        category: 'catalog',
        candidateId: null,
        blocking: true,
        internalDescription: 'Keine Tarife im Katalog vorhanden.',
        salesDescription: 'Es liegen keine konfigurierten BestPay-Tarife vor.',
        requiredAction: 'Tarifkatalog pflegen',
      }),
    );
  }

  if (!needCompleteness.isComplete) {
    findings.push(
      createRecommendationFinding({
        code: RECOMMENDATION_FINDING_CODES.RECOMMENDATION_INPUT_INCOMPLETE,
        severity: 'warning',
        category: 'input',
        candidateId: null,
        blocking: false,
        internalDescription: `Fehlende Pflichtangaben: ${needCompleteness.missingFields.join(', ')}`,
        salesDescription: 'Der Kundenbedarf ist noch unvollständig.',
        requiredAction: 'Bedarf ergänzen',
        context: { missingFields: needCompleteness.missingFields.join(',') },
      }),
    );
  }

  if (!context.weightSet) {
    findings.push(
      createRecommendationFinding({
        code: RECOMMENDATION_FINDING_CODES.RECOMMENDATION_SCORE_CONFIGURATION_MISSING,
        severity: 'info',
        category: 'scoring',
        candidateId: null,
        blocking: false,
        internalDescription: 'Keine veröffentlichte Gewichtungskonfiguration – deterministische Grundregeln.',
        salesDescription: null,
        requiredAction: null,
      }),
    );
  }

  const rawCandidates = generateCandidatesFromCatalog(need, context.catalog);
  const excludedCandidates: BestPaySolutionCandidate[] = [];
  const blockedCandidates: BestPaySolutionCandidate[] = [];
  const processedCandidates: BestPaySolutionCandidate[] = [];

  for (const rawCandidate of rawCandidates) {
    let candidate = evaluateCandidateEligibility(rawCandidate, need, eligibilityLookup);

    if (candidate.status === 'excluded') {
      excludedCandidates.push(candidate);
      continue;
    }

    const tariff = tariffMap.get(candidate.tariffId) ?? null;
    candidate = {
      ...candidate,
      costProjection: projectCustomerCosts(
        need,
        candidate,
        tariff,
        productMap,
        context.weightSet?.defaultProjectionMonths ?? null,
      ),
    };

    const pricingInput = buildPricingEvaluationInputFromCandidate(
      need,
      candidate,
      tariffMap,
      productMap,
    );
    const pricingEvaluation = evaluatePricing(pricingInput, context.pricingCatalog);
    candidate = {
      ...candidate,
      pricingEvaluation,
    };

    candidate = applyPricingEligibility(candidate);

    if (candidate.status === 'blocked') {
      blockedCandidates.push(candidate);
      continue;
    }

    if (candidate.pricingEvaluation) {
      const commissionInput = buildCommissionCalculationInputFromCandidate(
        need,
        candidate,
        candidate.pricingEvaluation,
      );
      const commissionPreview = evaluateCommission(
        commissionInput,
        context.commissionCatalog,
      );
      candidate = {
        ...candidate,
        commissionPreview,
      };

      if (commissionPreview.status === 'blocked' || commissionPreview.status === 'incomplete') {
        candidate = {
          ...candidate,
          warnings: [
            ...candidate.warnings,
            RECOMMENDATION_FINDING_CODES.RECOMMENDATION_COMMISSION_INCOMPLETE,
          ],
        };
      }
    }

    processedCandidates.push(candidate);
  }

  const scoredCandidates: ScoredCandidate[] = processedCandidates.map((candidate) => ({
    candidate,
    scoreBreakdown: scoreCandidate(candidate, need, context.weightSet),
  }));

  const { ranked, tieBreakerUsed } = rankCandidates(scoredCandidates, need, context.weightSet);
  const maxAlternatives = context.weightSet?.maxAlternatives ?? 2;
  const alternatives = selectAlternatives(ranked, maxAlternatives);

  const primaryEntry = ranked[0] ?? null;
  const primaryCandidate = primaryEntry?.candidate ?? null;

  if (!primaryCandidate && processedCandidates.length === 0 && excludedCandidates.length > 0) {
    findings.push(
      createRecommendationFinding({
        code: RECOMMENDATION_FINDING_CODES.RECOMMENDATION_NO_ELIGIBLE_CANDIDATE,
        severity: 'blocking',
        category: 'eligibility',
        candidateId: null,
        blocking: true,
        internalDescription: 'Kein zulässiger BestPay-Kandidat gefunden.',
        salesDescription: 'Es wurde keine passende BestPay-Konfiguration gefunden.',
        requiredAction: 'Bedarf oder Katalog prüfen',
      }),
    );
  }

  const primaryReasons = primaryCandidate
    ? buildPrimaryReasons(primaryCandidate, ranked)
    : [];

  let status: BestPayRecommendationResult['status'] = 'draft';
  if (!needCompleteness.isComplete) {
    status = 'incomplete';
  } else if (findings.some((finding) => finding.blocking)) {
    status = 'blocked';
  } else if (primaryCandidate) {
    status = primaryCandidate.status === 'critical' ? 'incomplete' : 'complete';
  } else {
    status = 'blocked';
  }

  const result: BestPayRecommendationResult = {
    recommendationId: generateId('recommendation'),
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    createdAt,
    leadId: need.leadId,
    offerId: need.offerId,
    inputFingerprint,
    status,
    normalizedNeed: need,
    needCompleteness,
    scoredCandidates: ranked,
    blockedCandidates,
    excludedCandidates,
    primaryCandidate,
    primaryRank: primaryCandidate?.rank ?? null,
    primaryReasons,
    primaryAdvantages: primaryReasons.filter((reason) => reason.isPositive).map((r) => r.customerFacingText),
    primaryLimitations: primaryReasons.filter((reason) => !reason.isPositive).map((r) => r.customerFacingText),
    requiredReviews: primaryCandidate?.pricingEvaluation?.approval.reasons ?? [],
    alternatives,
    findings,
    snapshot: createRecommendationSnapshotFromResult(
      {
        recommendationId: '',
        engineVersion: RECOMMENDATION_ENGINE_VERSION,
        createdAt,
        leadId: need.leadId,
        offerId: need.offerId,
        inputFingerprint,
        status,
        normalizedNeed: need,
        needCompleteness,
        scoredCandidates: ranked,
        blockedCandidates,
        excludedCandidates,
        primaryCandidate,
        primaryRank: primaryCandidate?.rank ?? null,
        primaryReasons,
        primaryAdvantages: [],
        primaryLimitations: [],
        requiredReviews: [],
        alternatives,
        findings,
        snapshot: {} as never,
        stale: false,
      },
      context.catalogVersions,
      context.weightSet,
      tieBreakerUsed,
      context.weightSet?.commissionTieBreakerEnabled ?? false,
    ),
    stale: false,
  };

  result.snapshot = createRecommendationSnapshotFromResult(
    result,
    context.catalogVersions,
    context.weightSet,
    tieBreakerUsed,
    context.weightSet?.commissionTieBreakerEnabled ?? false,
  );

  return result;
}
