import { isFrozenCommercialSnapshot } from '../offer/offerCommercialSnapshot';
import type { Offer } from '../offer/offer';
import type { OfferPublicationReadiness } from '../offer/offerPublicationReadiness';
import type { OfferWorkflowStatus } from '../offer/offerWorkflow';

const FINAL_CREATE_WORKFLOW: OfferWorkflowStatus[] = ['approved', 'ready_to_send'];

const FINAL_REGENERATE_WORKFLOW: OfferWorkflowStatus[] = [
  'approved',
  'ready_to_send',
  'sent',
  'accepted',
  'activation_pending',
  'activated',
  'released',
  'accounted',
  'paid',
];

export function canCreateInitialFinalDocument(status: OfferWorkflowStatus): boolean {
  return FINAL_CREATE_WORKFLOW.includes(status);
}

export function canRegenerateFinalDocument(status: OfferWorkflowStatus): boolean {
  return FINAL_REGENERATE_WORKFLOW.includes(status);
}

export function isLegacyCompletedDocumentOffer(offer: Offer): boolean {
  return !isFrozenCommercialSnapshot(offer.commercialSnapshot) && offer.status === 'completed';
}

export function evaluateFinalDocumentGate(
  offer: Offer,
  readiness: OfferPublicationReadiness | null,
  mode: 'create' | 'regenerate',
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (offer.status === 'cancelled' || offer.workflowStatus === 'cancelled') {
    errors.status = 'Für stornierte Angebote kann kein finales PDF erzeugt werden.';
    return errors;
  }

  if (isLegacyCompletedDocumentOffer(offer)) {
    return errors;
  }

  const workflowAllowed =
    mode === 'create'
      ? canCreateInitialFinalDocument(offer.workflowStatus)
      : canRegenerateFinalDocument(offer.workflowStatus);

  if (!workflowAllowed) {
    errors.status =
      'Finales PDF ist erst nach Freigabe (approved / ready_to_send) oder im Versandworkflow möglich.';
    return errors;
  }

  if (
    canCreateInitialFinalDocument(offer.workflowStatus) &&
    !readiness?.publicationAllowed
  ) {
    errors.publication =
      readiness?.blockers[0] ??
      'Angebot ist noch nicht versandbereit (Freigabe, Pricing, Empfehlung oder Beratungsgrundsätze).';
  }

  return errors;
}
