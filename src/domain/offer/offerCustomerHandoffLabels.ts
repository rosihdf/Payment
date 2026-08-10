import type { OfferWorkflowStatus } from './offerWorkflow';
import type { OfferPublicationReadiness } from './offerPublicationReadiness';

/** Einheitliches Kundenvorlagen-Label – ohne konkurrierendes Wording. */
export function getOfferCustomerTemplateStatusLabel(status: OfferWorkflowStatus): string {
  if (status === 'approved' || status === 'ready_to_send') {
    return 'Bereit zur Kundenvorlage';
  }
  if (status === 'sent') {
    return 'Beim Kunden';
  }
  if (status === 'accepted') {
    return 'Angenommen';
  }
  if (status === 'declined') {
    return 'Abgelehnt';
  }
  if (status === 'cancelled') {
    return 'Storniert';
  }
  if (status === 'changes_requested') {
    return 'Änderung erforderlich';
  }
  if (status === 'approval_required' || status === 'in_approval') {
    return 'Interne Freigabe ausstehend';
  }
  return 'Noch nicht bereit';
}

export interface OfferCustomerHandoffChecklistItem {
  id: string;
  label: string;
  satisfied: boolean;
}

export function buildOfferCustomerHandoffChecklist(
  readiness: OfferPublicationReadiness,
): OfferCustomerHandoffChecklistItem[] {
  return [
    {
      id: 'pricing',
      label: 'Konditionen aktuell',
      satisfied: readiness.pricingCurrent,
    },
    {
      id: 'recommendation',
      label: 'Empfehlung aktuell',
      satisfied: readiness.recommendationCurrent,
    },
    {
      id: 'approval',
      label: 'Freigabe vorhanden',
      satisfied: readiness.approvalSatisfied,
    },
    {
      id: 'counseling',
      label: 'Beratungsgrundsätze bestätigt',
      satisfied: readiness.counselingConfirmed,
    },
    {
      id: 'document',
      label: 'Finales Dokument vorhanden',
      satisfied: readiness.documentReady,
    },
  ];
}
