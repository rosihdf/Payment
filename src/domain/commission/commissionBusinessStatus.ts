import type { CommissionCaseStatus } from './commissionCase';

/** Fachliche Darstellung interner Provisionsfall-Stati. */
export const COMMISSION_BUSINESS_STATUS_LABELS: Record<CommissionCaseStatus, string> = {
  expected: 'Erwartet',
  reserved: 'Reserviert',
  released: 'Freigegeben',
  settled: 'Abgerechnet',
  partially_paid: 'Teilweise ausgezahlt',
  paid: 'Ausgezahlt',
  cancelled: 'Storniert',
  clawed_back: 'Rückgefordert',
  corrected: 'Korrigiert',
};

export function commissionBusinessStatusLabel(status: CommissionCaseStatus): string {
  return COMMISSION_BUSINESS_STATUS_LABELS[status] ?? status;
}

/** Erlaubte Admin-Übergänge im Workflow 1.0. */
export const COMMISSION_CASE_TRANSITIONS: Partial<
  Record<CommissionCaseStatus, CommissionCaseStatus[]>
> = {
  expected: ['reserved', 'cancelled'],
  reserved: ['released', 'cancelled'],
  released: ['settled', 'cancelled'],
  settled: ['partially_paid', 'paid', 'cancelled'],
  partially_paid: ['paid', 'cancelled'],
};

export function canTransitionCommissionCase(
  from: CommissionCaseStatus,
  to: CommissionCaseStatus,
): boolean {
  return COMMISSION_CASE_TRANSITIONS[from]?.includes(to) ?? false;
}
