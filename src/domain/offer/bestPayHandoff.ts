/**
 * BestPay-Handoff-Statusmodell – Phase 1B Block 1.
 * Keine API-Anbindung in diesem Block.
 */
export type BestPayHandoffStatus =
  | 'handed_over'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'error';

export const BESTPAY_HANDOFF_STATUS_LABELS: Record<BestPayHandoffStatus, string> = {
  handed_over: 'Übergeben',
  submitted: 'Eingereicht',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  error: 'Fehler',
};

export interface BestPayHandoff {
  id: string;
  offerId: string;
  offerVersionId: string;
  acceptanceId: string | null;
  bestPayReference: string | null;
  status: BestPayHandoffStatus;
  note: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
}

export function isTerminalHandoffStatus(status: BestPayHandoffStatus): boolean {
  return status === 'accepted' || status === 'rejected' || status === 'error';
}
