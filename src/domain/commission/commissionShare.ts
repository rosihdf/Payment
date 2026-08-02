/** Anteil am Standardbetrag in ganzen Prozent (0–100). */
export type CommissionSharePercent = number;

export const COMMISSION_SHARE_MIN = 0;
export const COMMISSION_SHARE_MAX = 100;
export const COMMISSION_SHARE_DEFAULT = 100;

export function isValidCommissionSharePercent(value: unknown): value is CommissionSharePercent {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= COMMISSION_SHARE_MIN &&
    value <= COMMISSION_SHARE_MAX
  );
}

/** Eurobetrag aus Standardbetrag und %-Anteil (kaufmännisch gerundet). */
export function calculateAmountFromShare(
  standardAmountCents: number | null | undefined,
  sharePercent: CommissionSharePercent = COMMISSION_SHARE_DEFAULT,
): number | null {
  if (standardAmountCents == null || !Number.isFinite(standardAmountCents)) {
    return null;
  }
  if (!isValidCommissionSharePercent(sharePercent)) {
    return null;
  }
  return Math.round((standardAmountCents * sharePercent) / 100);
}

export function formatSharePercent(sharePercent: CommissionSharePercent): string {
  return `${sharePercent} %`;
}

export function formatEuroCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) {
    return '—';
  }
  return `${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}
