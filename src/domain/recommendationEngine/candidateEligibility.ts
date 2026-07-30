import type { Tariff } from '../tariff/tariff';
import type { Product } from '../product/product';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import { RECOMMENDATION_FINDING_CODES } from '../recommendation/recommendationFinding';

export interface EligibilityCatalogLookup {
  tariffs: Map<string, Tariff>;
  products: Map<string, Product>;
}

export function evaluateCandidateEligibility(
  candidate: BestPaySolutionCandidate,
  need: CustomerNeed,
  catalog: EligibilityCatalogLookup,
): BestPaySolutionCandidate {
  const fulfilled: string[] = [];
  const unfulfilledRequirements: string[] = [];
  const exclusionReasons: string[] = [];
  const warnings: string[] = [];

  const tariff = catalog.tariffs.get(candidate.tariffId);
  if (!tariff || tariff.status !== 'active') {
    exclusionReasons.push('Tarif nicht aktiv oder nicht gefunden');
    return {
      ...candidate,
      status: 'excluded',
      fulfilledRequirements: fulfilled,
      unfulfilledRequirements: ['active_tariff'],
      exclusionReasons,
      warnings,
    };
  }

  fulfilled.push('active_tariff');

  if (!tariff.supportedTerminalTypes.includes(candidate.terminalType)) {
    exclusionReasons.push('Tarif unterstützt den Terminaltyp nicht');
    return {
      ...candidate,
      status: 'excluded',
      fulfilledRequirements: fulfilled,
      unfulfilledRequirements: ['terminal_type_match'],
      exclusionReasons,
      warnings,
    };
  }

  fulfilled.push('terminal_type_match');

  const maxTerm = need.contractPreferences.maxAcceptedTermMonths;
  if (
    maxTerm !== null &&
    candidate.contractTermMonths !== null &&
    candidate.contractTermMonths > maxTerm
  ) {
    exclusionReasons.push('Laufzeit überschreitet die maximale Kundenobergrenze');
    return {
      ...candidate,
      status: 'excluded',
      fulfilledRequirements: fulfilled,
      unfulfilledRequirements: ['term_within_max'],
      exclusionReasons,
      warnings,
    };
  }

  if (candidate.contractTermMonths !== null) {
    fulfilled.push('term_within_max');
  }

  for (const productId of candidate.hardwareProductIds) {
    const product = catalog.products.get(productId);
    if (!product || product.status !== 'active') {
      exclusionReasons.push('Benötigte Hardware nicht verfügbar');
      return {
        ...candidate,
        status: 'excluded',
        fulfilledRequirements: fulfilled,
        unfulfilledRequirements: ['hardware_available'],
        exclusionReasons,
        warnings,
      };
    }
  }

  if (candidate.hardwareProductIds.length > 0) {
    fulfilled.push('hardware_available');
  }

  if (need.terminalCount > 0) {
    fulfilled.push('terminal_count_configured');
  } else {
    unfulfilledRequirements.push('terminal_count_configured');
  }

  if (need.paymentUsage.mobile && candidate.terminalType === 'mobile') {
    fulfilled.push('mobile_usage_match');
  }

  if (need.paymentUsage.stationary && candidate.terminalType === 'stationary') {
    fulfilled.push('stationary_usage_match');
  }

  let status: BestPaySolutionCandidate['status'] = 'eligible';

  if (unfulfilledRequirements.length > 0) {
    status = 'limited';
    warnings.push(RECOMMENDATION_FINDING_CODES.RECOMMENDATION_INPUT_INCOMPLETE);
  }

  return {
    ...candidate,
    status,
    fulfilledRequirements: fulfilled,
    unfulfilledRequirements,
    exclusionReasons,
    warnings,
  };
}

export function applyPricingEligibility(
  candidate: BestPaySolutionCandidate,
): BestPaySolutionCandidate {
  if (candidate.status === 'excluded') {
    return candidate;
  }

  const pricing = candidate.pricingEvaluation;
  if (!pricing) {
    return {
      ...candidate,
      status: candidate.status === 'eligible' ? 'limited' : candidate.status,
      warnings: [...candidate.warnings, RECOMMENDATION_FINDING_CODES.RECOMMENDATION_PRICING_BLOCKED],
    };
  }

  if (pricing.approval.approvalBlocked || pricing.findings.some((finding) => finding.blocking)) {
    return {
      ...candidate,
      status: 'blocked',
      warnings: [...candidate.warnings, RECOMMENDATION_FINDING_CODES.RECOMMENDATION_PRICING_BLOCKED],
    };
  }

  if (pricing.reviewClass === 'critical') {
    return {
      ...candidate,
      status: candidate.status === 'blocked' ? 'blocked' : 'critical',
      warnings: [...candidate.warnings, RECOMMENDATION_FINDING_CODES.RECOMMENDATION_CANDIDATE_BLOCKED],
    };
  }

  if (pricing.reviewClass === 'attention' && candidate.status === 'eligible') {
    return {
      ...candidate,
      status: 'limited',
    };
  }

  return {
    ...candidate,
    priceBookVersionId: pricing.priceBookVersionId,
  };
}
