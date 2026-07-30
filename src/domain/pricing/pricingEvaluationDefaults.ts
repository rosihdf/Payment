import type { PricingEvaluationInput } from './pricingEvaluation';

export const DEFAULT_PRICING_EVALUATION_INPUT: PricingEvaluationInput = {
  evaluationDate: new Date().toISOString().slice(0, 10),
  salesRepresentativeId: '',
  leadId: null,
  offerId: null,
  currency: 'EUR',
  contractTypeId: null,
  productId: null,
  tariffId: null,
  hardwareProductIds: [],
  accessoryItems: [],
  contractTermId: null,
  requestedSpecialTermMonths: null,
  specialTermReason: '',
  quantity: 1,
  annualCardVolumeCents: null,
  monthlyCardVolumeCents: null,
  transactionCount: null,
  averageTicketCents: null,
  girocardSharePercent: null,
  creditCardSharePercent: null,
  industryId: null,
  requestedUnitPriceCents: null,
  requestedTotalPriceCents: null,
  manualPriceOverride: false,
  overrideReason: '',
};

export function normalizePricingEvaluationInput(value: Partial<PricingEvaluationInput>): PricingEvaluationInput {
  return {
    ...DEFAULT_PRICING_EVALUATION_INPUT,
    ...value,
    hardwareProductIds: [...(value.hardwareProductIds ?? [])],
    accessoryItems: (value.accessoryItems ?? []).map((item) => ({ ...item })),
    specialTermReason: value.specialTermReason?.trim() ?? '',
    overrideReason: value.overrideReason?.trim() ?? '',
  };
}
