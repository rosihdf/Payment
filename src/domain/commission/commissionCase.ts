export type CommissionCaseStatus =
  | 'expected'
  | 'reserved'
  | 'released'
  | 'settled'
  | 'partially_paid'
  | 'paid'
  | 'cancelled'
  | 'clawed_back'
  | 'corrected';

export interface CommissionCase {
  id: string;
  commissionCalculationId: string;
  offerId: string;
  salesRepresentativeId: string;
  status: CommissionCaseStatus;
  expectedAmountCents: number;
  approvedAmountCents: number;
  settledAmountCents: number;
  paidAmountCents: number;
  clawedBackAmountCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export type CommissionEventType =
  | 'preview_created'
  | 'preview_recalculated'
  | 'preview_stale'
  | 'calculation_frozen'
  | 'assignment_created'
  | 'plan_version_published'
  | 'reduction_proposed'
  | 'reduction_approved'
  | 'reduction_rejected'
  | 'correction_added'
  | 'case_expected_created';

export interface CommissionEvent {
  id: string;
  commissionCaseId: string | null;
  commissionCalculationId: string | null;
  eventType: CommissionEventType;
  previousStatus: string | null;
  newStatus: string | null;
  amountCents: number | null;
  currency: string | null;
  reason: string;
  triggeredByUserId: string;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
}
