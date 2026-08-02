import type { CommissionRule } from '../commission/commissionRule';
import type { CommissionRuleOverride } from '../commission/commissionRuleOverride';
import { resolveSharePercent } from '../commission/commissionRuleOverride';
import {
  calculateAmountFromShare,
  isValidCommissionSharePercent,
} from '../commission/commissionShare';

/**
 * Wendet Mitarbeitervereinbarungen auf Standardregeln an.
 * Prozent ist führend: Euro = Standard × Anteil.
 * Direkte Euro-Ausnahme nur, wenn kein sharePercent gesetzt ist.
 */
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

      const hasLeadingShare =
        override.sharePercent != null && isValidCommissionSharePercent(override.sharePercent);
      const sharePercent = resolveSharePercent(override);

      const sharedFixed = hasLeadingShare
        ? calculateAmountFromShare(rule.fixedAmountCents, sharePercent)
        : override.fixedAmountCents != null
          ? override.fixedAmountCents
          : calculateAmountFromShare(rule.fixedAmountCents, sharePercent);

      return {
        ...rule,
        fixedAmountCents: sharedFixed ?? rule.fixedAmountCents,
        percentTenthsOfBasisPoint:
          override.percentTenthsOfBasisPoint !== undefined &&
          override.percentTenthsOfBasisPoint !== null
            ? override.percentTenthsOfBasisPoint
            : rule.percentTenthsOfBasisPoint,
        internalDescription: !hasLeadingShare && override.fixedAmountCents != null
          ? `${rule.internalDescription} [Ausnahme ${override.fixedAmountCents} ct]`.trim()
          : sharePercent !== 100
            ? `${rule.internalDescription} [${sharePercent}% vom Standard]`.trim()
            : rule.internalDescription,
      };
    });
}
