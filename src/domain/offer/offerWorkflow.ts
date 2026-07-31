/** B03: erweiterter, service-geschützter Angebotsworkflow */
export type OfferWorkflowStatus =
  | 'draft'
  | 'approval_required'
  | 'in_approval'
  | 'changes_requested'
  | 'approved'
  | 'ready_to_send'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'activation_pending'
  | 'activated'
  | 'released'
  | 'accounted'
  | 'paid'
  | 'cancelled';

export const OFFER_WORKFLOW_STATUS_LABELS: Record<OfferWorkflowStatus, string> = {
  draft: 'Entwurf',
  approval_required: 'Freigabe erforderlich',
  in_approval: 'In Freigabe',
  changes_requested: 'Änderungen erforderlich',
  approved: 'Freigegeben',
  ready_to_send: 'Versandbereit',
  sent: 'Versendet',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  activation_pending: 'Aktivierung vorbereitet',
  activated: 'Aktiviert',
  released: 'Freigegeben (Provision)',
  accounted: 'Abgerechnet',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
};

export type OfferWorkflowTransition =
  | 'submit_for_approval'
  | 'start_approval'
  | 'request_changes'
  | 'approve'
  | 'mark_ready_to_send'
  | 'document_sent'
  | 'accept'
  | 'decline'
  | 'mark_expired'
  | 'prepare_activation'
  | 'activate'
  | 'mark_released'
  | 'mark_accounted'
  | 'mark_paid'
  | 'cancel'
  | 'return_to_draft';

const ALLOWED_TRANSITIONS: Record<
  OfferWorkflowStatus,
  Partial<Record<OfferWorkflowTransition, OfferWorkflowStatus>>
> = {
  draft: {
    submit_for_approval: 'approval_required',
    approve: 'approved',
    cancel: 'cancelled',
  },
  approval_required: {
    start_approval: 'in_approval',
    approve: 'approved',
    cancel: 'cancelled',
  },
  in_approval: {
    approve: 'approved',
    request_changes: 'changes_requested',
    cancel: 'cancelled',
  },
  changes_requested: {
    return_to_draft: 'draft',
    cancel: 'cancelled',
  },
  approved: {
    mark_ready_to_send: 'ready_to_send',
    cancel: 'cancelled',
  },
  ready_to_send: {
    document_sent: 'sent',
    cancel: 'cancelled',
  },
  sent: {
    accept: 'accepted',
    decline: 'declined',
    mark_expired: 'expired',
    cancel: 'cancelled',
  },
  accepted: {
    prepare_activation: 'activation_pending',
    cancel: 'cancelled',
  },
  declined: {},
  expired: {},
  activation_pending: {
    activate: 'activated',
    cancel: 'cancelled',
  },
  activated: {
    mark_released: 'released',
    cancel: 'cancelled',
  },
  released: {
    mark_accounted: 'accounted',
  },
  accounted: {
    mark_paid: 'paid',
  },
  paid: {},
  cancelled: {},
};

export function canTransitionWorkflowStatus(
  from: OfferWorkflowStatus,
  transition: OfferWorkflowTransition,
): boolean {
  return Boolean(ALLOWED_TRANSITIONS[from]?.[transition]);
}

export function applyWorkflowTransition(
  from: OfferWorkflowStatus,
  transition: OfferWorkflowTransition,
): OfferWorkflowStatus | null {
  return ALLOWED_TRANSITIONS[from]?.[transition] ?? null;
}

/** Versionen ab Versand/Annahme sind unveränderbar */
export function isImmutableWorkflowStatus(status: OfferWorkflowStatus): boolean {
  return [
    'sent',
    'accepted',
    'declined',
    'expired',
    'activation_pending',
    'activated',
    'released',
    'accounted',
    'paid',
    'cancelled',
  ].includes(status);
}

export function isEditableWorkflowStatus(status: OfferWorkflowStatus): boolean {
  return status === 'draft' || status === 'changes_requested';
}

export function mapLegacyOfferStatus(
  legacy: 'draft' | 'completed' | 'cancelled',
): OfferWorkflowStatus {
  switch (legacy) {
    case 'completed':
      return 'accepted';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'draft';
  }
}

export function syncLegacyOfferStatus(workflowStatus: OfferWorkflowStatus): 'draft' | 'completed' | 'cancelled' {
  if (workflowStatus === 'cancelled') {
    return 'cancelled';
  }
  if (
    workflowStatus === 'accepted' ||
    workflowStatus === 'activation_pending' ||
    workflowStatus === 'activated' ||
    workflowStatus === 'released' ||
    workflowStatus === 'accounted' ||
    workflowStatus === 'paid'
  ) {
    return 'completed';
  }
  return 'draft';
}

export type OfferWorkflowStatusFilter = 'all' | OfferWorkflowStatus;
