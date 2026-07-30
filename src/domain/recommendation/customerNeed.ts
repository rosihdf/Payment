import type { CardMix, PaymentUsage } from '../lead/lead';

export interface ContractPreferences {
  preferredTermMonths: number | null;
  maxAcceptedTermMonths: number | null;
  preferLowFixedCosts: boolean;
  preferLowVariableCosts: boolean;
  preferLowInitialCosts: boolean;
  preferPriceStability: boolean;
  preferFlexibility: boolean;
  specialTermRequested: boolean;
}

export interface CurrentSituationBaseline {
  monthlyFixedCostsCents: number | null;
  transactionCostsCents: number | null;
  hardwareCostsCents: number | null;
  contractTermMonths: number | null;
  monthlyTotalCostsCents: number | null;
}

export interface CardMixNeed {
  girocardPercent: number | null;
  debitPercent: number | null;
  creditPercent: number | null;
  otherPercent: number | null;
  sumKnownPercent: number | null;
  isComplete: boolean;
  isPlausible: boolean;
}

export interface CustomerNeed {
  leadId: string | null;
  offerId: string | null;
  salesRepresentativeId: string;
  evaluationDate: string;

  industry: string;
  locationCount: number | null;
  terminalCount: number;
  paymentUsage: PaymentUsage;
  cardMix: CardMixNeed;

  monthlyCardVolumeCents: number | null;
  annualCardVolumeCents: number | null;
  monthlyTransactions: number | null;
  averageTransactionValueCents: number | null;

  contractPreferences: ContractPreferences;
  currentSituation: CurrentSituationBaseline | null;

  costBaselineId: string | null;
  costBaselineVersion: number | null;

  requiredAccessoryProductIds: string[];
}

export interface NeedCompletenessStatus {
  isComplete: boolean;
  missingFields: string[];
  warnings: string[];
}

export function normalizeCardMixNeed(cardMix: CardMix): CardMixNeed {
  const girocardPercent = cardMix.girocardPercent >= 0 ? cardMix.girocardPercent : null;
  const debitPercent = cardMix.debitPercent >= 0 ? cardMix.debitPercent : null;
  const creditPercent = cardMix.creditPercent >= 0 ? cardMix.creditPercent : null;
  const otherPercent = cardMix.otherPercent >= 0 ? cardMix.otherPercent : null;

  const parts = [girocardPercent, debitPercent, creditPercent, otherPercent].filter(
    (value): value is number => value !== null,
  );
  const sumKnownPercent = parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) : null;

  return {
    girocardPercent,
    debitPercent,
    creditPercent,
    otherPercent,
    sumKnownPercent,
    isComplete: parts.length === 4,
    isPlausible: sumKnownPercent === null || (sumKnownPercent >= 0 && sumKnownPercent <= 100),
  };
}

export function assessNeedCompleteness(need: CustomerNeed): NeedCompletenessStatus {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (need.terminalCount <= 0) {
    missingFields.push('terminalCount');
  }

  if (need.monthlyCardVolumeCents === null && need.annualCardVolumeCents === null) {
    missingFields.push('monthlyCardVolumeCents');
  }

  if (!need.paymentUsage.stationary && !need.paymentUsage.mobile && !need.paymentUsage.softPos) {
    missingFields.push('paymentUsage');
  }

  if (!need.cardMix.isPlausible) {
    warnings.push('cardMixSumImplausible');
  }

  if (!need.cardMix.isComplete) {
    warnings.push('cardMixIncomplete');
  }

  if (need.monthlyTransactions === null) {
    warnings.push('monthlyTransactionsMissing');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

export const DEFAULT_CONTRACT_PREFERENCES: ContractPreferences = {
  preferredTermMonths: null,
  maxAcceptedTermMonths: null,
  preferLowFixedCosts: false,
  preferLowVariableCosts: false,
  preferLowInitialCosts: false,
  preferPriceStability: false,
  preferFlexibility: false,
  specialTermRequested: false,
};
