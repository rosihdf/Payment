/**
 * Kundenstatus je Angebotsversion – ergänzt den internen Workflow, ersetzt ihn nicht.
 * Phase 1B Block 1: Vorbereitung digitaler Vertriebsprozess.
 */
export type OfferCustomerStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'with_customer'
  | 'inquiry'
  | 'change_requested'
  | 'accepted'
  | 'declined'
  | 'handed_to_bestpay'
  | 'completed';

export const OFFER_CUSTOMER_STATUS_LABELS: Record<OfferCustomerStatus, string> = {
  draft: 'Entwurf',
  in_review: 'In Prüfung',
  approved: 'Freigegeben',
  with_customer: 'Beim Kunden',
  inquiry: 'Rückfrage',
  change_requested: 'Änderung angefordert',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  handed_to_bestpay: 'An BestPay übergeben',
  completed: 'Abgeschlossen',
};

/** Reihenfolge für Historie / Fortschrittsanzeige (keine harte State-Machine). */
export const OFFER_CUSTOMER_STATUS_ORDER: OfferCustomerStatus[] = [
  'draft',
  'in_review',
  'approved',
  'with_customer',
  'inquiry',
  'change_requested',
  'accepted',
  'declined',
  'handed_to_bestpay',
  'completed',
];

export function isTerminalCustomerStatus(status: OfferCustomerStatus): boolean {
  return status === 'declined' || status === 'completed';
}
