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
  contractId: string | null;
  activationId: string | null;
  status: CommissionCaseStatus;
  expectedAmountCents: number;
  approvedAmountCents: number;
  reductionAmountCents: number;
  reductionReason: string | null;
  settledAmountCents: number;
  paidAmountCents: number;
  clawedBackAmountCents: number;
  accountingReference: string | null;
  paymentReference: string | null;
  dueDate: string | null;
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
  | 'assignment_changed'
  | 'override_changed'
  | 'plan_version_published'
  | 'reduction_proposed'
  | 'reduction_approved'
  | 'reduction_rejected'
  | 'correction_added'
  | 'case_expected_created'
  | 'commission_calculated'
  | 'commission_expected'
  | 'commission_reserved'
  | 'commission_released'
  | 'commission_bonus_created'
  | 'commission_bonus_changed'
  | 'commission_bonus_paid'
  | 'commission_reduced'
  | 'commission_accounted'
  | 'commission_paid'
  | 'commission_cancelled'
  | 'commission_assignment_changed'
  | 'commission_override_changed';

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
