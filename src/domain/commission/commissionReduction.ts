export type CommissionReductionDecisionStatus =
  | 'none'
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'adjusted';

export interface CommissionReductionDecision {
  id: string;
  proposedReductionAmountCents: number;
  proposedReductionPercentTenths: number | null;
  originalCommissionAmountCents: number;
  remainingCommissionAmountCents: number;
  maxAllowedReductionAmountCents: number;
  status: CommissionReductionDecisionStatus;
  adminUserId: string | null;
  reason: string;
  decidedAt: string | null;
  pricingDeviationContext: Record<string, string | number | boolean | null>;
}

export const COMMISSION_MAX_REDUCTION_PERCENT_TENTHS = 5000;

export function maxAllowedReductionAmountCents(originalCommissionAmountCents: number): number {
  return Math.floor((originalCommissionAmountCents * COMMISSION_MAX_REDUCTION_PERCENT_TENTHS) / 10000);
}

export function remainingCommissionAfterReduction(
  originalCommissionAmountCents: number,
  reductionAmountCents: number,
): number {
  return Math.max(0, originalCommissionAmountCents - reductionAmountCents);
}
