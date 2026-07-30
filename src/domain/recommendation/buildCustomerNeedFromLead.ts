import type { Lead } from '../lead/lead';
import type { Offer } from '../offer/offer';
import {
  assessNeedCompleteness,
  DEFAULT_CONTRACT_PREFERENCES,
  normalizeCardMixNeed,
  type CustomerNeed,
  type NeedCompletenessStatus,
} from './customerNeed';

export function buildCustomerNeedFromLead(
  lead: Lead,
  options: {
    offerId?: string | null;
    salesRepresentativeId: string;
    evaluationDate?: string;
    terminalCountOverride?: number;
  },
): CustomerNeed {
  const terminalCount =
    options.terminalCountOverride ??
    (lead.requiredTerminalCount > 0 ? lead.requiredTerminalCount : lead.currentTerminalCount ?? 1);

  const monthlyCardVolumeCents = lead.monthlyCardTurnoverCents;
  const annualCardVolumeCents =
    monthlyCardVolumeCents !== null ? monthlyCardVolumeCents * 12 : null;

  return {
    leadId: lead.id,
    offerId: options.offerId ?? null,
    salesRepresentativeId: options.salesRepresentativeId,
    evaluationDate: options.evaluationDate ?? new Date().toISOString().slice(0, 10),
    industry: lead.industry,
    locationCount: null,
    terminalCount: Math.max(1, terminalCount),
    paymentUsage: { ...lead.paymentUsage },
    cardMix: normalizeCardMixNeed(lead.cardMix),
    monthlyCardVolumeCents,
    annualCardVolumeCents,
    monthlyTransactions: lead.monthlyTransactions,
    averageTransactionValueCents: lead.averageTransactionValueCents,
    contractPreferences: { ...DEFAULT_CONTRACT_PREFERENCES },
    currentSituation: null,
    costBaselineId: null,
    costBaselineVersion: null,
    requiredAccessoryProductIds: [],
  };
}

export function buildCustomerNeedFromOffer(
  offer: Offer,
  lead: Lead | null,
  salesRepresentativeId: string,
): CustomerNeed {
  if (lead) {
    return {
      ...buildCustomerNeedFromLead(lead, {
        offerId: offer.id,
        salesRepresentativeId,
      }),
    };
  }

  return {
    leadId: offer.leadId || null,
    offerId: offer.id,
    salesRepresentativeId,
    evaluationDate: new Date().toISOString().slice(0, 10),
    industry: '',
    locationCount: null,
    terminalCount: 1,
    paymentUsage: {
      stationary: false,
      mobile: true,
      ecommerce: false,
      softPos: false,
    },
    cardMix: normalizeCardMixNeed({
      girocardPercent: -1,
      debitPercent: -1,
      creditPercent: -1,
      otherPercent: -1,
    }),
    monthlyCardVolumeCents: null,
    annualCardVolumeCents: null,
    monthlyTransactions: null,
    averageTransactionValueCents: null,
    contractPreferences: { ...DEFAULT_CONTRACT_PREFERENCES },
    currentSituation: null,
    costBaselineId: null,
    costBaselineVersion: null,
    requiredAccessoryProductIds: [],
  };
}

export function applyCostBaselineToNeed(
  need: CustomerNeed,
  baseline: import('../billingImport/customerCostBaseline').CustomerCostBaseline,
): CustomerNeed {
  const baselineFields = {
    monthlyCardVolumeCents: baseline.avgMonthlyCardVolumeCents ?? need.monthlyCardVolumeCents,
    monthlyTransactions: baseline.avgMonthlyTransactionCount ?? need.monthlyTransactions,
    averageTransactionValueCents: baseline.avgTicketCents ?? need.averageTransactionValueCents,
    annualCardVolumeCents:
      baseline.avgMonthlyCardVolumeCents !== null
        ? baseline.avgMonthlyCardVolumeCents * 12
        : need.annualCardVolumeCents,
  };

  return {
    ...need,
    ...baselineFields,
    currentSituation: {
      monthlyFixedCostsCents: baseline.avgMonthlyFixedCostsCents,
      transactionCostsCents: baseline.avgMonthlyTransactionCostsCents,
      hardwareCostsCents: baseline.avgMonthlyTerminalCostsCents,
      contractTermMonths: null,
      monthlyTotalCostsCents: baseline.avgMonthlyTotalCostsCents,
    },
    costBaselineId: baseline.id,
    costBaselineVersion: baseline.version,
  };
}

export function getNeedCompleteness(need: CustomerNeed): NeedCompletenessStatus {
  return assessNeedCompleteness(need);
}
