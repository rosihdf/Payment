import type { CustomerNeed } from '../recommendation/customerNeed';
import type { RecommendationWeightSet } from '../recommendation/recommendationWeightSet';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, entry]) => `${key}:${stableStringify(entry)}`).join(',')}}`;
}

export interface RecommendationFingerprintInput {
  need: CustomerNeed;
  tariffCatalogVersion: number | null;
  productCatalogVersion: number | null;
  pricingCatalogVersion: number | null;
  commissionCatalogVersion: number | null;
  weightSet: RecommendationWeightSet | null;
  costBaselineId: string | null;
  costBaselineVersion: number | null;
}

export function createRecommendationInputFingerprint(
  input: RecommendationFingerprintInput,
): string {
  const payload = {
    need: {
      leadId: input.need.leadId,
      offerId: input.need.offerId,
      terminalCount: input.need.terminalCount,
      paymentUsage: input.need.paymentUsage,
      cardMix: input.need.cardMix,
      monthlyCardVolumeCents: input.need.monthlyCardVolumeCents,
      monthlyTransactions: input.need.monthlyTransactions,
      averageTransactionValueCents: input.need.averageTransactionValueCents,
      contractPreferences: input.need.contractPreferences,
      requiredAccessoryProductIds: input.need.requiredAccessoryProductIds,
    },
    catalogVersions: {
      tariff: input.tariffCatalogVersion,
      product: input.productCatalogVersion,
      pricing: input.pricingCatalogVersion,
      commission: input.commissionCatalogVersion,
    },
    weightSetId: input.weightSet?.id ?? null,
    weightSetVersion: input.weightSet?.versionNumber ?? null,
    costBaselineId: input.costBaselineId,
    costBaselineVersion: input.costBaselineVersion,
  };

  let hash = 0;
  const serialized = stableStringify(payload);
  for (let index = 0; index < serialized.length; index += 1) {
    hash = (hash << 5) - hash + serialized.charCodeAt(index);
    hash |= 0;
  }

  return `rec_fp_${Math.abs(hash).toString(16)}`;
}

export function hasRecommendationInputChanged(
  previousFingerprint: string,
  currentFingerprint: string,
): boolean {
  return previousFingerprint !== currentFingerprint;
}
