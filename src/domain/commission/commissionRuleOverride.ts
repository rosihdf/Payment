import {
  COMMISSION_SHARE_DEFAULT,
  calculateAmountFromShare,
  isValidCommissionSharePercent,
  type CommissionSharePercent,
} from './commissionShare';
import type { CommissionRule } from './commissionRule';

/**
 * Individuelle Vereinbarung je Standardregel.
 * Führend: sharePercent (0–100) vom aktuellen Standardbetrag.
 * Euro-Ausnahme (fixedAmountCents) nur, wenn kein Anteil gesetzt ist
 * und ein fachlich abweichender Absolutbetrag belegt ist.
 */
export interface CommissionRuleOverride {
  ruleId: string;
  /** Anteil am Standardbetrag in Prozent (0–100). */
  sharePercent?: CommissionSharePercent | null;
  /** Ausnahme: absoluter Betrag – nur ohne führenden sharePercent. */
  fixedAmountCents?: number | null;
  /** Für variable %-Regeln (nicht Standardbetrag). */
  percentTenthsOfBasisPoint?: number | null;
  disabled?: boolean;
}

export function hasRuleOverrides(overrides: CommissionRuleOverride[]): boolean {
  return overrides.some((override) => isIndividualOverride(override));
}

export function isIndividualOverride(override: CommissionRuleOverride): boolean {
  if (override.disabled === true) {
    return true;
  }
  if (
    override.sharePercent != null &&
    isValidCommissionSharePercent(override.sharePercent) &&
    override.sharePercent !== COMMISSION_SHARE_DEFAULT
  ) {
    return true;
  }
  // Euro-Ausnahme zählt nur ohne führenden Prozentwert.
  if (override.sharePercent == null && override.fixedAmountCents != null) {
    return true;
  }
  if (override.percentTenthsOfBasisPoint != null) {
    return true;
  }
  return false;
}

export function resolveSharePercent(override: CommissionRuleOverride | undefined): CommissionSharePercent {
  if (
    override?.sharePercent != null &&
    isValidCommissionSharePercent(override.sharePercent)
  ) {
    return override.sharePercent;
  }
  return COMMISSION_SHARE_DEFAULT;
}

/**
 * Normalisiert Overrides auf Prozent-Wahrheit:
 * - sharePercent gesetzt → Euro-Override entfernen
 * - Euro gleich Standard → 100 %
 * - Euro als ganzzahliger Anteil ausdrückbar → sharePercent, Euro entfernen
 * - sonst Euro-Ausnahme belassen (ohne sharePercent)
 */
export function normalizeOverrideToShareTruth(
  override: CommissionRuleOverride,
  rule: CommissionRule | undefined,
): CommissionRuleOverride {
  if (override.disabled === true) {
    return {
      ruleId: override.ruleId,
      sharePercent: null,
      fixedAmountCents: null,
      percentTenthsOfBasisPoint: override.percentTenthsOfBasisPoint ?? null,
      disabled: true,
    };
  }

  if (override.percentTenthsOfBasisPoint != null && override.sharePercent == null) {
    return {
      ruleId: override.ruleId,
      sharePercent: COMMISSION_SHARE_DEFAULT,
      fixedAmountCents: null,
      percentTenthsOfBasisPoint: override.percentTenthsOfBasisPoint,
    };
  }

  if (override.sharePercent != null && isValidCommissionSharePercent(override.sharePercent)) {
    return {
      ruleId: override.ruleId,
      sharePercent: override.sharePercent,
      fixedAmountCents: null,
      percentTenthsOfBasisPoint: null,
    };
  }

  if (override.fixedAmountCents != null && rule?.fixedAmountCents != null && rule.fixedAmountCents > 0) {
    if (override.fixedAmountCents === rule.fixedAmountCents) {
      return {
        ruleId: override.ruleId,
        sharePercent: COMMISSION_SHARE_DEFAULT,
        fixedAmountCents: null,
        percentTenthsOfBasisPoint: null,
      };
    }

    for (let share = 0; share <= 100; share += 1) {
      if (calculateAmountFromShare(rule.fixedAmountCents, share) === override.fixedAmountCents) {
        return {
          ruleId: override.ruleId,
          sharePercent: share,
          fixedAmountCents: null,
          percentTenthsOfBasisPoint: null,
        };
      }
    }

    // Nicht als ganzzahliger Anteil abbildbar → echte Euro-Ausnahme.
    return {
      ruleId: override.ruleId,
      sharePercent: null,
      fixedAmountCents: override.fixedAmountCents,
      percentTenthsOfBasisPoint: null,
    };
  }

  return {
    ruleId: override.ruleId,
    sharePercent: COMMISSION_SHARE_DEFAULT,
    fixedAmountCents: null,
    percentTenthsOfBasisPoint: null,
  };
}
