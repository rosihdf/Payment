import type { BestPayComparisonSession } from '../bestPayComparison/bestPayComparisonSession';
import { buildCustomerNeedForComparison } from '../bestPayComparison/buildCustomerNeedForComparison';
import type { CustomerCostBaseline } from '../billingImport/customerCostBaseline';
import type { Product } from '../product/product';
import type { Tariff } from '../tariff/tariff';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import type { RecommendationRecord } from '../recommendation/recommendationRecord';
import type { CustomerNeed } from '../recommendation/customerNeed';
import {
  buildCommercialConfig,
  type CommercialConfig,
} from '../commercial/commercialConfig';
import { calculateCommercialProjection } from '../commercial/calculateCommercialProjection';
import { buildCommercialSelectionHandoff, type CommercialSelectionHandoff } from '../commercial/commercialHandoff';
import {
  resolveCommissionContractConfigurationFromCandidate,
} from '../commission/commissionContractConfiguration';

export function resolveCandidateFromRecommendationRecord(
  record: RecommendationRecord,
  candidateId: string,
): BestPaySolutionCandidate | null {
  return (
    record.snapshot.candidates.find((candidate) => candidate.candidateId === candidateId) ??
    record.snapshot.blockedCandidates.find((candidate) => candidate.candidateId === candidateId) ??
    null
  );
}

function resolveHardwareCosts(
  candidate: BestPaySolutionCandidate,
  products: Map<string, Product>,
): { hardwareOneTimeCents: number; hardwareMonthlyCents: number } {
  let hardwareOneTimeCents = 0;
  let hardwareMonthlyCents = 0;
  const terminalCount = Math.max(1, candidate.quantity);

  for (const productId of candidate.hardwareProductIds) {
    const product = products.get(productId);
    if (!product || product.priceCents === null) {
      continue;
    }
    if (product.priceType === 'one_time') {
      hardwareOneTimeCents += product.priceCents * terminalCount;
    } else if (product.priceType === 'monthly') {
      hardwareMonthlyCents += product.priceCents * terminalCount;
    }
  }

  return { hardwareOneTimeCents, hardwareMonthlyCents };
}

export function buildCommercialHandoffFromSelection(input: {
  need: CustomerNeed;
  candidate: BestPaySolutionCandidate;
  tariff: Tariff;
  products: Map<string, Product>;
  contractConfiguration?: ReturnType<typeof resolveCommissionContractConfigurationFromCandidate>;
  commissionPlanKind?: import('../commission/commissionPlan').CommissionPlanKind | null;
}): CommercialSelectionHandoff {
  const config = buildCommercialConfig({
    need: input.need,
    candidate: input.candidate,
    tariff: input.tariff,
    products: input.products,
  });

  const hardwareCosts = resolveHardwareCosts(input.candidate, input.products);
  const projection = calculateCommercialProjection(input.need, config, hardwareCosts);

  const contractConfiguration =
    input.contractConfiguration ??
    resolveCommissionContractConfigurationFromCandidate({
      hardwareProductIds: input.candidate.hardwareProductIds,
      termMonths: config.contractTermMonths,
    });

  return buildCommercialSelectionHandoff({
    commercialConfig: config,
    contractConfiguration,
    commissionPlanKind: input.commissionPlanKind ?? null,
    projection,
    commissionPreview: input.candidate.commissionPreview,
    need: input.need,
  });
}

export function buildCommercialHandoffFromComparisonSession(input: {
  session: BestPayComparisonSession;
  candidate: BestPaySolutionCandidate;
  tariff: Tariff;
  products: Map<string, Product>;
  baseline: CustomerCostBaseline | null;
  salesRepresentativeId: string;
}): CommercialSelectionHandoff {
  const need = buildCustomerNeedForComparison({
    manualInput: input.session.manualInput,
    baseline: input.baseline,
    salesRepresentativeId: input.salesRepresentativeId,
    leadId: input.session.leadId,
  });

  return buildCommercialHandoffFromSelection({
    need,
    candidate: input.candidate,
    tariff: input.tariff,
    products: input.products,
  });
}

export function applyCommercialConfigToTariffSnapshotMonths(
  contractDurationMonths: number | null,
): number | null {
  return contractDurationMonths;
}

export type { CommercialConfig };
