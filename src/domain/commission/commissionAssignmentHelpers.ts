import type { SalesRepresentativeCommissionAssignment } from './commissionAssignment';
import type { CommissionAssignmentVersion } from './commissionAssignmentVersion';
import type { CommissionPlan, CommissionPlanVersion } from './commissionPlan';
import type { CommissionRule } from './commissionRule';
import type { CommissionRuleOverride } from './commissionRuleOverride';
import {
  DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
  DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID,
} from '../../services/commissionCatalogSeed';

function parseDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function assignmentsOverlap(
  left: Pick<SalesRepresentativeCommissionAssignment, 'validFrom' | 'validUntil' | 'status' | 'isPrimary'>,
  right: Pick<SalesRepresentativeCommissionAssignment, 'validFrom' | 'validUntil' | 'status' | 'isPrimary'>,
): boolean {
  if (left.status !== 'active' || right.status !== 'active' || !left.isPrimary || !right.isPrimary) {
    return false;
  }

  const leftFrom = parseDate(left.validFrom);
  const rightFrom = parseDate(right.validFrom);
  if (!leftFrom || !rightFrom) {
    return false;
  }

  const leftUntil = left.validUntil ? parseDate(left.validUntil) : null;
  const rightUntil = right.validUntil ? parseDate(right.validUntil) : null;

  const leftEnd = leftUntil ?? new Date('9999-12-31T00:00:00.000Z');
  const rightEnd = rightUntil ?? new Date('9999-12-31T00:00:00.000Z');

  return leftFrom <= rightEnd && rightFrom <= leftEnd;
}

export function resolvePlanVersionIdForModel(model: 'classic' | 'variable'): string {
  return model === 'classic'
    ? DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID
    : DEFAULT_COMMISSION_PLAN_VERSION_VARIABLE_ID;
}

export function resolveModelFromPlanVersion(
  planVersionId: string,
  plans: CommissionPlan[],
  planVersions: CommissionPlanVersion[],
): 'classic' | 'variable' | null {
  const version = planVersions.find((entry) => entry.id === planVersionId);
  if (!version) {
    return null;
  }
  const plan = plans.find((entry) => entry.id === version.commissionPlanId);
  if (!plan) {
    return null;
  }
  if (plan.planKind === 'classic') {
    return 'classic';
  }
  if (plan.planKind === 'variable') {
    return 'variable';
  }
  return null;
}

export function getActiveAssignmentForRepresentative(
  assignments: SalesRepresentativeCommissionAssignment[],
  salesRepresentativeId: string,
  evaluationDate: string,
): SalesRepresentativeCommissionAssignment | null {
  const date = parseDate(evaluationDate);
  if (!date) {
    return null;
  }

  const candidates = assignments.filter((assignment) => {
    if (
      assignment.salesRepresentativeId !== salesRepresentativeId ||
      assignment.status !== 'active' ||
      !assignment.isPrimary
    ) {
      return false;
    }
    const validFrom = parseDate(assignment.validFrom);
    if (!validFrom || date < validFrom) {
      return false;
    }
    if (assignment.validUntil) {
      const validUntil = parseDate(assignment.validUntil);
      if (!validUntil || date > validUntil) {
        return false;
      }
    }
    return true;
  });

  return candidates.length === 1 ? candidates[0]! : null;
}

export function getRuleOverridesForAssignment(
  assignment: SalesRepresentativeCommissionAssignment | null,
  versions: CommissionAssignmentVersion[],
): CommissionRuleOverride[] {
  if (!assignment?.currentVersionId) {
    return [];
  }
  const version = versions.find((entry) => entry.id === assignment.currentVersionId);
  return version?.ruleOverrides ?? [];
}

export function buildDefaultOverridesForRules(rules: CommissionRule[]): CommissionRuleOverride[] {
  return rules.map((rule) => ({
    ruleId: rule.id,
    fixedAmountCents: rule.fixedAmountCents,
    percentTenthsOfBasisPoint: rule.percentTenthsOfBasisPoint,
  }));
}

export function diffRuleOverrides(
  standard: CommissionRuleOverride[],
  current: CommissionRuleOverride[],
): CommissionRuleOverride[] {
  const currentByRule = new Map(current.map((entry) => [entry.ruleId, entry]));
  return standard.filter((entry) => {
    const override = currentByRule.get(entry.ruleId);
    if (!override) {
      return false;
    }
    return (
      override.disabled === true ||
      override.fixedAmountCents !== entry.fixedAmountCents ||
      override.percentTenthsOfBasisPoint !== entry.percentTenthsOfBasisPoint
    );
  });
}
