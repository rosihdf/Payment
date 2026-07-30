import type { CommissionRule } from '../commission/commissionRule';
import type { CommissionCalculationInput } from '../commission/commissionCalculationInput';
import { ruleMatchesTermMonths } from './termClassification';

function isRuleValidOnDate(rule: CommissionRule, evaluationDate: string): boolean {
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

export function computeCommissionRuleSpecificity(
  rule: CommissionRule,
  input: CommissionCalculationInput,
  termMonths: number | null,
): number {
  let score = 0;

  if (rule.contractTypeCode) {
    if (rule.contractTypeCode !== input.contractTypeCode) {
      return -1;
    }
    score += 80;
  }

  if (rule.tariffId) {
    if (rule.tariffId !== input.pricingEvaluationResult.snapshot.input.tariffId) {
      return -1;
    }
    score += 100;
  }

  if (rule.productId) {
    if (rule.productId !== input.pricingEvaluationResult.snapshot.input.productId) {
      return -1;
    }
    score += 90;
  }

  if (
    rule.exactTermMonths !== null ||
    rule.minTermMonthsExclusive !== null ||
    rule.maxTermMonthsExclusive !== null
  ) {
    if (
      !ruleMatchesTermMonths(
        termMonths,
        rule.exactTermMonths,
        rule.minTermMonthsExclusive,
        rule.maxTermMonthsExclusive,
      )
    ) {
      return -1;
    }
    score += 70;
  }

  return score + rule.priority;
}

export interface CommissionRuleSelectionResult {
  selectedRules: CommissionRule[];
  rejectedRules: Array<{ id: string; name: string; reason: string }>;
  ambiguous: boolean;
  conflicting: boolean;
}

export function selectCommissionRules(
  rules: CommissionRule[],
  planVersionId: string,
  input: CommissionCalculationInput,
  termMonths: number | null,
): CommissionRuleSelectionResult {
  const applicable = rules
    .filter(
      (rule) =>
        rule.commissionPlanVersionId === planVersionId &&
        isRuleValidOnDate(rule, input.evaluationDate),
    )
    .map((rule) => ({ rule, specificity: computeCommissionRuleSpecificity(rule, input, termMonths) }))
    .filter((entry) => entry.specificity >= 0);

  if (applicable.length === 0) {
    return { selectedRules: [], rejectedRules: [], ambiguous: false, conflicting: false };
  }

  const byType = new Map<string, typeof applicable>();
  for (const entry of applicable) {
    const key = entry.rule.combinable
      ? `${entry.rule.commissionType}:${entry.rule.calculationBasis}`
      : `${entry.rule.commissionType}:exclusive:${entry.rule.id}`;
    const bucket = byType.get(key) ?? [];
    bucket.push(entry);
    byType.set(key, bucket);
  }

  const selectedRules: CommissionRule[] = [];
  const rejectedRules: Array<{ id: string; name: string; reason: string }> = [];
  let ambiguous = false;
  let conflicting = false;

  for (const bucket of byType.values()) {
    const sorted = bucket.sort((left, right) => {
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

    if (
      !best.rule.combinable &&
      tied.some(
        (entry) =>
          entry.rule.fixedAmountCents !== best.rule.fixedAmountCents ||
          entry.rule.percentTenthsOfBasisPoint !== best.rule.percentTenthsOfBasisPoint,
      )
    ) {
      ambiguous = true;
      conflicting = true;
      rejectedRules.push(
        ...[best, ...tied].map((entry) => ({
          id: entry.rule.id,
          name: entry.rule.name,
          reason: 'Widersprüchliche gleichrangige Provisionsregel',
        })),
      );
      continue;
    }

    selectedRules.push(best.rule);
    rejectedRules.push(
      ...sorted.slice(1).map((entry) => ({
        id: entry.rule.id,
        name: entry.rule.name,
        reason: 'Niedrigere Spezifität oder Priorität',
      })),
    );

    if (tied.length > 0 && !best.rule.combinable) {
      ambiguous = true;
    }
  }

  if (conflicting) {
    return { selectedRules: [], rejectedRules, ambiguous: true, conflicting: true };
  }

  return { selectedRules, rejectedRules, ambiguous, conflicting: false };
}
