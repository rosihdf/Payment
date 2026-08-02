/**
 * Freigabestatus je Angebotsversion – ergänzt bestehende Approval-Events, ersetzt sie nicht.
 */
export type OfferVersionApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'submitted'
  | 'in_review'
  | 'changes_requested'
  | 'approved';

export const OFFER_VERSION_APPROVAL_STATUS_LABELS: Record<OfferVersionApprovalStatus, string> = {
  not_required: 'Nicht erforderlich',
  pending: 'Ausstehend',
  submitted: 'Eingereicht',
  in_review: 'In Prüfung',
  changes_requested: 'Änderung angefordert',
  approved: 'Freigegeben',
};
