import type { CommissionCalculationInput } from '../commission/commissionCalculationInput';
import type { CommissionReductionDecision } from '../commission/commissionReduction';

function stableSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSortKeys(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = stableSortKeys(record[key]);
    }
    return sorted;
  }

  return value;
}

export function createCommissionCalculationFingerprint(
  input: CommissionCalculationInput,
  reductionDecision: CommissionReductionDecision | null,
): string {
  const canonical = JSON.stringify(
    stableSortKeys({
      ...input,
      pricingEvaluationResult: {
        evaluationId: input.pricingEvaluationResult.evaluationId,
        inputFingerprint: input.pricingEvaluationResult.inputFingerprint,
        reviewClass: input.pricingEvaluationResult.reviewClass,
      },
      reductionDecision,
    }),
  );

  let hash = 0;
  for (let index = 0; index < canonical.length; index += 1) {
    hash = (hash * 31 + canonical.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function hasCommissionRelevantInputChanged(
  previousFingerprint: string,
  currentFingerprint: string,
): boolean {
  return previousFingerprint !== currentFingerprint;
}
