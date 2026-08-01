/** Individuelle Regelanpassung auf Basis eines Provisionsmodells. */
export interface CommissionRuleOverride {
  ruleId: string;
  fixedAmountCents?: number | null;
  percentTenthsOfBasisPoint?: number | null;
  disabled?: boolean;
}

export function hasRuleOverrides(overrides: CommissionRuleOverride[]): boolean {
  return overrides.some(
    (override) =>
      override.disabled === true ||
      override.fixedAmountCents != null ||
      override.percentTenthsOfBasisPoint != null,
  );
}
