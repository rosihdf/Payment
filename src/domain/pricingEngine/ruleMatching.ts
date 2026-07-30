import type { PriceRule } from '../pricing/priceRule';
import type { PricingEvaluationInput } from '../pricing/pricingEvaluation';

function isRuleValidOnDate(rule: PriceRule, evaluationDate: string): boolean {
  if (rule.status !== 'active') {
    return false;
  }

  const date = new Date(`${evaluationDate.slice(0, 10)}T00:00:00.000Z`);
  if (rule.validFrom) {
    const from = new Date(`${rule.validFrom.slice(0, 10)}T00:00:00.000Z`);
    if (date < from) {
      return false;
    }
  }

  if (rule.validUntil) {
    const until = new Date(`${rule.validUntil.slice(0, 10)}T00:00:00.000Z`);
    if (date > until) {
      return false;
    }
  }

  return true;
}

export function computeRuleSpecificity(rule: PriceRule, input: PricingEvaluationInput): number {
  let score = 0;

  if (rule.productId && rule.productId === input.productId) {
    score += 100;
  } else if (rule.productId) {
    return -1;
  }

  if (rule.tariffId && rule.tariffId === input.tariffId) {
    score += 100;
  } else if (rule.tariffId) {
    return -1;
  }

  if (rule.contractTypeId && rule.contractTypeId === input.contractTypeId) {
    score += 50;
  } else if (rule.contractTypeId) {
    return -1;
  }

  if (rule.contractTermId && rule.contractTermId === input.contractTermId) {
    score += 80;
  } else if (rule.contractTermId) {
    return -1;
  }

  if (rule.industryId && rule.industryId === input.industryId) {
    score += 30;
  } else if (rule.industryId) {
    return -1;
  }

  return score + rule.priority;
}

export function filterApplicableRules(
  rules: PriceRule[],
  priceBookVersionId: string,
  input: PricingEvaluationInput,
): PriceRule[] {
  return rules.filter(
    (rule) =>
      rule.priceBookVersionId === priceBookVersionId && isRuleValidOnDate(rule, input.evaluationDate),
  );
}

export interface RuleSelectionResult {
  selectedRules: PriceRule[];
  rejectedRules: Array<{ id: string; name: string; reason: string }>;
  ambiguous: boolean;
  conflicting: boolean;
}

export function selectPriceRules(
  rules: PriceRule[],
  priceBookVersionId: string,
  input: PricingEvaluationInput,
): RuleSelectionResult {
  const applicable = filterApplicableRules(rules, priceBookVersionId, input)
    .map((rule) => ({ rule, specificity: computeRuleSpecificity(rule, input) }))
    .filter((entry) => entry.specificity >= 0);

  if (applicable.length === 0) {
    return { selectedRules: [], rejectedRules: [], ambiguous: false, conflicting: false };
  }

  const combinable = applicable.filter((entry) => entry.rule.combinable);
  const nonCombinable = applicable.filter((entry) => !entry.rule.combinable);

  if (combinable.length > 0 && nonCombinable.length > 0) {
    const bestNonCombinable = nonCombinable.sort((left, right) => {
      if (right.specificity !== left.specificity) {
        return right.specificity - left.specificity;
      }

      if (right.rule.priority !== left.rule.priority) {
        return right.rule.priority - left.rule.priority;
      }

      return left.rule.id.localeCompare(right.rule.id);
    })[0]!;

    const sameRank = nonCombinable.filter(
      (entry) =>
        entry.specificity === bestNonCombinable.specificity &&
        entry.rule.priority === bestNonCombinable.rule.priority &&
        hasConflictingPrices(entry.rule, bestNonCombinable.rule),
    );

    if (sameRank.length > 1) {
      return {
        selectedRules: [],
        rejectedRules: sameRank.map((entry) => ({
          id: entry.rule.id,
          name: entry.rule.name,
          reason: 'Widersprüchliche gleichrangige Regel',
        })),
        ambiguous: true,
        conflicting: true,
      };
    }

    return {
      selectedRules: [bestNonCombinable.rule],
      rejectedRules: applicable
        .filter((entry) => entry.rule.id !== bestNonCombinable.rule.id)
        .map((entry) => ({
          id: entry.rule.id,
          name: entry.rule.name,
          reason: 'Niedrigere Spezifität oder Priorität',
        })),
      ambiguous: false,
      conflicting: false,
    };
  }

  if (combinable.length > 0) {
    return {
      selectedRules: combinable.map((entry) => entry.rule),
      rejectedRules: [],
      ambiguous: false,
      conflicting: false,
    };
  }

  const sorted = nonCombinable.sort((left, right) => {
    if (right.specificity !== left.specificity) {
      return right.specificity - left.specificity;
    }

    if (right.rule.priority !== left.rule.priority) {
      return right.rule.priority - left.rule.priority;
    }

    return left.rule.id.localeCompare(right.rule.id);
  });

  const best = sorted[0]!;
  const tied = sorted.filter(
    (entry) =>
      entry.specificity === best.specificity &&
      entry.rule.priority === best.rule.priority &&
      entry.rule.id !== best.rule.id,
  );

  if (tied.some((entry) => hasConflictingPrices(entry.rule, best.rule))) {
    return {
      selectedRules: [],
      rejectedRules: [best, ...tied].map((entry) => ({
        id: entry.rule.id,
        name: entry.rule.name,
        reason: 'Mehrdeutige gleichrangige Regeln',
      })),
      ambiguous: true,
      conflicting: true,
    };
  }

  return {
    selectedRules: [best.rule],
    rejectedRules: sorted.slice(1).map((entry) => ({
      id: entry.rule.id,
      name: entry.rule.name,
      reason: 'Niedrigere Spezifität oder Priorität',
    })),
    ambiguous: tied.length > 0,
    conflicting: false,
  };
}

function hasConflictingPrices(left: PriceRule, right: PriceRule): boolean {
  return (
    left.listPriceCents !== right.listPriceCents ||
    left.targetPriceCents !== right.targetPriceCents ||
    left.minimumPriceCents !== right.minimumPriceCents
  );
}
