import type { OfferWorkflowStatus } from '../../domain/offer/offerWorkflow';
import { OFFER_WORKFLOW_STATUS_LABELS } from '../../domain/offer/offerWorkflow';
import type { StatusBadgeVariant } from '../../v2/ui/StatusBadge';

/** Grobe fachliche Gruppe – nur für Filter und Badge-Farben, nicht für das sichtbare Label. */
export type OfferWorkflowDisplayGroup =
  | 'draft'
  | 'approval'
  | 'ready_to_send'
  | 'sent'
  | 'accepted'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'cancelled';

/** Fachliche Filter in der Angebotsübersicht. */
export type OfferPhaseFilter =
  | 'all'
  | 'draft_editing'
  | 'approval'
  | 'ready_to_send'
  | 'sent'
  | 'accepted'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'archived';

export const OFFER_PHASE_FILTER_LABELS: Record<OfferPhaseFilter, string> = {
  all: 'Alle',
  draft_editing: 'Entwurf / Bearbeitung',
  approval: 'Freigabe',
  ready_to_send: 'Bereit zur Kundenvorlage',
  sent: 'Beim Kunden',
  accepted: 'Angenommen',
  completed: 'Abgeschlossen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  cancelled: 'Storniert',
  archived: 'Archiv',
};

export const OFFER_PHASE_FILTER_OPTIONS: OfferPhaseFilter[] = [
  'all',
  'draft_editing',
  'approval',
  'ready_to_send',
  'sent',
  'accepted',
  'completed',
  'declined',
  'expired',
  'cancelled',
  'archived',
];

/** Primäres UI-Label je Workflow-Status – zentrale Wahrheit für Anzeige. */
export const OFFER_PRIMARY_STATUS_LABELS: Record<OfferWorkflowStatus, string> = {
  draft: 'Entwurf',
  approval_required: 'Freigabe erforderlich',
  in_approval: 'In Freigabe',
  changes_requested: 'Änderung nötig',
  approved: 'Bereit zur Kundenvorlage',
  ready_to_send: 'Bereit zur Kundenvorlage',
  sent: 'Beim Kunden',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  activation_pending: 'Aktivierung vorbereitet',
  activated: 'Aktiviert',
  released: 'Provision freigegeben',
  accounted: 'Abgerechnet',
  paid: 'Abgeschlossen',
  cancelled: 'Storniert',
};

const STATUS_TO_GROUP: Record<OfferWorkflowStatus, OfferWorkflowDisplayGroup> = {
  draft: 'draft',
  approval_required: 'approval',
  in_approval: 'approval',
  changes_requested: 'draft',
  approved: 'approval',
  ready_to_send: 'ready_to_send',
  sent: 'sent',
  accepted: 'accepted',
  activation_pending: 'accepted',
  activated: 'accepted',
  released: 'completed',
  accounted: 'completed',
  paid: 'completed',
  declined: 'declined',
  expired: 'expired',
  cancelled: 'cancelled',
};

const PHASE_TO_STATUSES: Record<Exclude<OfferPhaseFilter, 'all' | 'archived'>, OfferWorkflowStatus[]> = {
  draft_editing: ['draft', 'changes_requested'],
  approval: ['approval_required', 'in_approval', 'approved'],
  ready_to_send: ['ready_to_send'],
  sent: ['sent'],
  accepted: ['accepted', 'activation_pending', 'activated'],
  completed: ['released', 'accounted', 'paid'],
  declined: ['declined'],
  expired: ['expired'],
  cancelled: ['cancelled'],
};

const ARCHIVED_STATUSES: OfferWorkflowStatus[] = ['declined', 'expired', 'cancelled', 'paid'];

/** @deprecated Nur noch für CSS-Klassen – Label über getOfferPrimaryStatusLabel verwenden. */
export const OFFER_WORKFLOW_DISPLAY_GROUP_LABELS: Record<OfferWorkflowDisplayGroup, string> = {
  draft: 'Entwurf',
  approval: 'Freigabe',
  ready_to_send: 'Bereit zur Kundenvorlage',
  sent: 'Beim Kunden',
  accepted: 'Angenommen',
  completed: 'Abgeschlossen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  cancelled: 'Storniert',
};

export function getOfferWorkflowDisplayGroup(status: OfferWorkflowStatus): OfferWorkflowDisplayGroup {
  return STATUS_TO_GROUP[status];
}

export function getOfferPrimaryStatusLabel(status: OfferWorkflowStatus): string {
  return OFFER_PRIMARY_STATUS_LABELS[status];
}

/** Alias für bestehende Aufrufer – zeigt jetzt das primäre Statuslabel. */
export function getOfferWorkflowDisplayLabel(status: OfferWorkflowStatus): string {
  return getOfferPrimaryStatusLabel(status);
}

export function getOfferWorkflowTechnicalLabel(status: OfferWorkflowStatus): string {
  return OFFER_WORKFLOW_STATUS_LABELS[status];
}

export function getOfferPrimaryStatusBadgeVariant(status: OfferWorkflowStatus): StatusBadgeVariant {
  switch (getOfferWorkflowDisplayGroup(status)) {
    case 'draft':
      return 'info';
    case 'approval':
    case 'ready_to_send':
      return 'warning';
    case 'sent':
      return 'info';
    case 'accepted':
    case 'completed':
      return 'success';
    case 'declined':
    case 'expired':
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function matchesOfferPhaseFilter(
  status: OfferWorkflowStatus,
  phase: OfferPhaseFilter,
): boolean {
  if (phase === 'all') {
    return true;
  }
  if (phase === 'archived') {
    return ARCHIVED_STATUSES.includes(status);
  }
  return PHASE_TO_STATUSES[phase].includes(status);
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
      return 'Kundenvorlage öffnen';
    case 'sent':
      return 'Kundenrückmeldung dokumentieren';
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
