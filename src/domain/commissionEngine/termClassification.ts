export type TermDurationClass = 'below_36' | 'lte_36_inclusive' | 'above_36' | 'unknown';

export function classifyTermMonths(termMonths: number | null): TermDurationClass {
  if (termMonths === null || !Number.isInteger(termMonths) || termMonths < 1) {
    return 'unknown';
  }

  if (termMonths < 36) {
    return 'below_36';
  }

  if (termMonths === 36) {
    return 'lte_36_inclusive';
  }

  return 'above_36';
}

export function ruleMatchesTermMonths(
  termMonths: number | null,
  exactTermMonths: number | null,
  minTermMonthsExclusive: number | null,
  maxTermMonthsExclusive: number | null,
): boolean {
  if (termMonths === null) {
    return exactTermMonths === null && minTermMonthsExclusive === null && maxTermMonthsExclusive === null;
  }

  if (exactTermMonths !== null) {
    return termMonths === exactTermMonths;
  }

  if (minTermMonthsExclusive !== null && termMonths <= minTermMonthsExclusive) {
    return false;
  }

  if (maxTermMonthsExclusive !== null && termMonths >= maxTermMonthsExclusive) {
    return false;
  }

  return true;
}
