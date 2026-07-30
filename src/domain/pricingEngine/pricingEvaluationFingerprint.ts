import type { PricingEvaluationInput } from '../pricing/pricingEvaluation';

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

export function createPricingEvaluationFingerprint(input: PricingEvaluationInput): string {
  const canonical = JSON.stringify(stableSortKeys(input));
  let hash = 0;
  for (let index = 0; index < canonical.length; index += 1) {
    hash = (hash * 31 + canonical.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function hasPricingRelevantInputChanged(
  previous: PricingEvaluationInput,
  current: PricingEvaluationInput,
): boolean {
  return createPricingEvaluationFingerprint(previous) !== createPricingEvaluationFingerprint(current);
}
