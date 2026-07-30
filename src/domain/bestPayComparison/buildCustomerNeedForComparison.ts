import type { CustomerNeed } from '../recommendation/customerNeed';
import {
  DEFAULT_CONTRACT_PREFERENCES,
  normalizeCardMixNeed,
} from '../recommendation/customerNeed';
import type { CustomerCostBaseline } from '../billingImport/customerCostBaseline';
import { applyCostBaselineToNeed } from '../recommendation/buildCustomerNeedFromLead';
import type { BestPayManualInput } from './bestPayComparisonSession';

export function buildCustomerNeedFromManualInput(
  input: BestPayManualInput,
  options: {
    salesRepresentativeId: string;
    leadId?: string | null;
    offerId?: string | null;
    evaluationDate?: string;
  },
): CustomerNeed {
  const monthlyCardVolumeCents = input.monthlyCardVolumeCents;
  const annualCardVolumeCents =
    input.annualCardVolumeCents ??
    (monthlyCardVolumeCents !== null ? monthlyCardVolumeCents * 12 : null);

  const need: CustomerNeed = {
    leadId: options.leadId ?? null,
    offerId: options.offerId ?? null,
    salesRepresentativeId: options.salesRepresentativeId,
    evaluationDate: options.evaluationDate ?? new Date().toISOString().slice(0, 10),
    industry: input.industry,
    locationCount: null,
    terminalCount: Math.max(1, input.terminalCount),
    paymentUsage: { ...input.paymentUsage },
    cardMix: normalizeCardMixNeed({
      girocardPercent: input.girocardPercent ?? -1,
      debitPercent: input.debitPercent ?? -1,
      creditPercent: input.creditPercent ?? -1,
      otherPercent: input.otherPercent ?? -1,
    }),
    monthlyCardVolumeCents,
    annualCardVolumeCents,
    monthlyTransactions: input.monthlyTransactions,
    averageTransactionValueCents: input.averageTransactionValueCents,
    contractPreferences: {
      ...DEFAULT_CONTRACT_PREFERENCES,
      preferredTermMonths: input.preferredTermMonths,
    },
    currentSituation: {
      monthlyFixedCostsCents: input.monthlyFixedCostsCents,
      transactionCostsCents: input.monthlyTransactionCostsCents,
      hardwareCostsCents: input.monthlyTerminalCostsCents,
      contractTermMonths: input.preferredTermMonths,
      monthlyTotalCostsCents: input.monthlyTotalCostsCents,
    },
    costBaselineId: null,
    costBaselineVersion: null,
    requiredAccessoryProductIds: [],
  };

  return need;
}

export function buildCustomerNeedForComparison(input: {
  manualInput: BestPayManualInput;
  baseline: CustomerCostBaseline | null;
  salesRepresentativeId: string;
  leadId: string | null;
}): CustomerNeed {
  let need = buildCustomerNeedFromManualInput(input.manualInput, {
    salesRepresentativeId: input.salesRepresentativeId,
    leadId: input.leadId,
  });

  if (input.baseline && input.baseline.status === 'confirmed') {
    need = applyCostBaselineToNeed(need, input.baseline);
  }

  return need;
}
