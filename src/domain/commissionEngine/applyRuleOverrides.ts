import type { CommissionRule } from '../commission/commissionRule';
import type { CommissionRuleOverride } from '../commission/commissionRuleOverride';

export function applyRuleOverrides(
  rules: CommissionRule[],
  overrides: CommissionRuleOverride[] | undefined,
): CommissionRule[] {
  if (!overrides?.length) {
    return rules;
  }

  const overrideByRuleId = new Map(overrides.map((override) => [override.ruleId, override]));

  return rules
    .filter((rule) => !overrideByRuleId.get(rule.id)?.disabled)
    .map((rule) => {
      const override = overrideByRuleId.get(rule.id);
      if (!override) {
        return rule;
      }

      return {
        ...rule,
        fixedAmountCents:
          override.fixedAmountCents !== undefined ? override.fixedAmountCents : rule.fixedAmountCents,
        percentTenthsOfBasisPoint:
          override.percentTenthsOfBasisPoint !== undefined
            ? override.percentTenthsOfBasisPoint
            : rule.percentTenthsOfBasisPoint,
      };
    });
}
