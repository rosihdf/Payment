import type { OfferWorkflowStatus } from '../../domain/offer/offerWorkflow';
import { OFFER_WORKFLOW_STATUS_LABELS } from '../../domain/offer/offerWorkflow';

/** Sichtbare Statusgruppe – nur Anzeige, keine Persistenz. */
export type OfferWorkflowDisplayGroup =
  | 'draft'
  | 'internal_review'
  | 'ready_for_customer'
  | 'customer_review'
  | 'accepted'
  | 'closed';

export const OFFER_WORKFLOW_DISPLAY_GROUP_LABELS: Record<OfferWorkflowDisplayGroup, string> = {
  draft: 'Entwurf',
  internal_review: 'Interne Prüfung',
  ready_for_customer: 'Bereit zur Kundenvorlage',
  customer_review: 'Kunde prüft',
  accepted: 'Angenommen',
  closed: 'Abgelehnt oder beendet',
};

const STATUS_TO_GROUP: Record<OfferWorkflowStatus, OfferWorkflowDisplayGroup> = {
  draft: 'draft',
  approval_required: 'internal_review',
  in_approval: 'internal_review',
  changes_requested: 'internal_review',
  approved: 'ready_for_customer',
  ready_to_send: 'ready_for_customer',
  sent: 'customer_review',
  accepted: 'accepted',
  activation_pending: 'accepted',
  activated: 'accepted',
  released: 'accepted',
  accounted: 'accepted',
  paid: 'accepted',
  declined: 'closed',
  expired: 'closed',
  cancelled: 'closed',
};

export function getOfferWorkflowDisplayGroup(status: OfferWorkflowStatus): OfferWorkflowDisplayGroup {
  return STATUS_TO_GROUP[status];
}

export function getOfferWorkflowDisplayLabel(status: OfferWorkflowStatus): string {
  return OFFER_WORKFLOW_DISPLAY_GROUP_LABELS[getOfferWorkflowDisplayGroup(status)];
}

export function getOfferWorkflowTechnicalLabel(status: OfferWorkflowStatus): string {
  return OFFER_WORKFLOW_STATUS_LABELS[status];
}

export function getOfferWorkflowPrimaryActionLabel(status: OfferWorkflowStatus): string | null {
  switch (status) {
    case 'draft':
      return 'Freigabe anfordern';
    case 'approval_required':
    case 'in_approval':
      return 'Freigeben';
    case 'changes_requested':
      return 'Bearbeiten';
    case 'approved':
      return 'Versandbereit';
    case 'ready_to_send':
      return 'Als versendet dokumentieren';
    case 'sent':
      return 'Annahme dokumentieren';
    case 'accepted':
    case 'activation_pending':
    case 'activated':
    case 'released':
    case 'accounted':
    case 'paid':
      return 'Vertrag anlegen';
    default:
      return null;
  }
}
