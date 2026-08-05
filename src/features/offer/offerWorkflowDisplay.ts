import type { OfferWorkflowStatus } from '../../domain/offer/offerWorkflow';
import { OFFER_WORKFLOW_STATUS_LABELS } from '../../domain/offer/offerWorkflow';

/** Sichtbare Statusgruppe für den Vertrieb – nur Anzeige, keine Persistenz. */
export type OfferWorkflowDisplayGroup =
  | 'draft'
  | 'handed_to_customer'
  | 'customer_considering'
  | 'accepted'
  | 'declined';

export const OFFER_WORKFLOW_DISPLAY_GROUP_LABELS: Record<OfferWorkflowDisplayGroup, string> = {
  draft: 'Entwurf',
  handed_to_customer: 'an Kunden übergeben',
  customer_considering: 'Kunde überlegt',
  accepted: 'angenommen',
  declined: 'abgelehnt',
};

const STATUS_TO_GROUP: Record<OfferWorkflowStatus, OfferWorkflowDisplayGroup> = {
  draft: 'draft',
  approval_required: 'draft',
  in_approval: 'draft',
  changes_requested: 'draft',
  approved: 'draft',
  ready_to_send: 'handed_to_customer',
  sent: 'customer_considering',
  accepted: 'accepted',
  activation_pending: 'accepted',
  activated: 'accepted',
  released: 'accepted',
  accounted: 'accepted',
  paid: 'accepted',
  declined: 'declined',
  expired: 'declined',
  cancelled: 'declined',
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
    case 'approval_required':
    case 'in_approval':
    case 'changes_requested':
    case 'approved':
      return 'Status pflegen';
    case 'ready_to_send':
      return 'An Kunden übergeben';
    case 'sent':
      return 'Kunde überlegt dokumentieren';
    case 'accepted':
    case 'activation_pending':
    case 'activated':
    case 'released':
    case 'accounted':
    case 'paid':
      return null;
    case 'declined':
    case 'expired':
    case 'cancelled':
      return null;
    default:
      return null;
  }
}
