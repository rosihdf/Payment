import {
  classifyCommissionContractTerm,
  type CommissionContractTermClass,
} from '../commission/commissionContractConfiguration';

export type { CommissionContractTermClass };

export { classifyCommissionContractTerm };

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

/** Lang/kurz gemäß PPT-Klassifikation (>=36 = long_term). */
export function ruleMatchesCommissionTermClass(
  termMonths: number | null,
  requiredClass: CommissionContractTermClass | null,
): boolean {
  if (requiredClass === null) {
    return true;
  }

  const actual = classifyCommissionContractTerm(termMonths);
  return actual === requiredClass;
}
