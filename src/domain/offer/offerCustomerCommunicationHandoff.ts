import { isFrozenCommercialSnapshot } from './offerCommercialSnapshot';
import type { Offer } from './offer';
import type { OfferDocument } from '../offerDocument/offerDocument';
import type { OfferShare } from './offerShare';
import type { OfferVersion } from './offerVersion';
import type { OfferWorkflowEvent } from './offerWorkflowEvents';
import {
  primaryPublicationBlockerMessage,
  type OfferPublicationReadiness,
} from './offerPublicationReadiness';

/** Geplanter Kanal für späteres Kommunikationscenter – noch ohne Versand. */
export type OfferCommunicationChannel = 'share_link' | 'documented_send' | 'public_portal';

export type OfferCustomerHandoffStage =
  | 'internal_preparation'
  | 'ready_for_handoff'
  | 'shared_with_customer'
  | 'document_sent'
  | 'customer_responded';

export interface OfferCustomerCommunicationHandoffCommercialContext {
  tariffName: string | null;
  terminalModel: string | null;
  deploymentMode: string | null;
  contractTermMonths: number | null;
  projectedMonthlyTotalCents: number | null;
}

export interface OfferCustomerCommunicationHandoff {
  offerId: string;
  offerNumber: string;
  offerVersionId: string | null;
  customerId: string | null;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  documentId: string | null;
  documentVersion: number | null;
  documentDisplayName: string | null;
  shareLinkId: string | null;
  shareUrl: string | null;
  validUntil: string | null;
  commercialContext: OfferCustomerCommunicationHandoffCommercialContext;
  stage: OfferCustomerHandoffStage;
  readiness: OfferPublicationReadiness;
  availableChannels: OfferCommunicationChannel[];
  canCreateShareLink: boolean;
  canRecordDocumentSent: boolean;
  canCreateFinalPdf: boolean;
  canPublicAcceptDecline: boolean;
  primaryBlockerMessage: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryChannel: string | null;
  lastDeliveryRecipient: string | null;
}

function deriveHandoffStage(
  offer: Offer,
  activeShare: OfferShare | null,
): OfferCustomerHandoffStage {
  if (['accepted', 'declined', 'expired', 'cancelled'].includes(offer.workflowStatus)) {
    return 'customer_responded';
  }
  if (offer.workflowStatus === 'sent') {
    return 'document_sent';
  }
  if (activeShare && activeShare.status === 'active') {
    return 'shared_with_customer';
  }
  if (['approved', 'ready_to_send'].includes(offer.workflowStatus)) {
    return 'ready_for_handoff';
  }
  return 'internal_preparation';
}

function resolveContactName(offer: Offer): string | null {
  const parts = [offer.customerSnapshot.contactFirstName, offer.customerSnapshot.contactLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return parts || null;
}

function resolveCommercialContext(offer: Offer): OfferCustomerCommunicationHandoffCommercialContext {
  const snapshot = offer.commercialSnapshot;
  if (!isFrozenCommercialSnapshot(snapshot)) {
    return {
      tariffName: offer.tariffSnapshot?.name ?? null,
      terminalModel: null,
      deploymentMode: null,
      contractTermMonths: offer.tariffSnapshot?.contractDurationMonths ?? null,
      projectedMonthlyTotalCents: null,
    };
  }
  return {
    tariffName: snapshot.identity.tariffName,
    terminalModel: snapshot.identity.terminalModel,
    deploymentMode: snapshot.identity.deploymentMode,
    contractTermMonths: snapshot.identity.contractTermMonths,
    projectedMonthlyTotalCents: snapshot.projection?.monthlyTotalCents ?? null,
  };
}

function resolveLastDelivery(events: OfferWorkflowEvent[]): {
  lastDeliveryAt: string | null;
  lastDeliveryChannel: string | null;
  lastDeliveryRecipient: string | null;
} {
  const dispatchEvents = events
    .filter((event): event is Extract<OfferWorkflowEvent, { type: 'dispatch' }> => event.type === 'dispatch')
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt));
  const latest = dispatchEvents[0];
  if (!latest) {
    return {
      lastDeliveryAt: null,
      lastDeliveryChannel: null,
      lastDeliveryRecipient: null,
    };
  }
  return {
    lastDeliveryAt: latest.sentAt,
    lastDeliveryChannel: latest.channel,
    lastDeliveryRecipient: latest.recipient || null,
  };
}

/**
 * Schnittstelle für Kundenübergabe und späteres Kommunikationscenter.
 * Enthält keine Versandlogik – nur erlaubte Kanäle und aktuelle fachliche Wahrheit.
 */
export function buildOfferCustomerCommunicationHandoff(input: {
  offer: Offer;
  readiness: OfferPublicationReadiness;
  version?: OfferVersion | null;
  document?: OfferDocument | null;
  activeShare?: OfferShare | null;
  shareUrl?: string | null;
  workflowEvents?: OfferWorkflowEvent[];
}): OfferCustomerCommunicationHandoff {
  const { offer, readiness } = input;
  const activeShare = input.activeShare ?? null;
  const stage = deriveHandoffStage(offer, activeShare);
  const availableChannels: OfferCommunicationChannel[] = [];
  const delivery = resolveLastDelivery(input.workflowEvents ?? []);

  if (readiness.shareAllowed) {
    availableChannels.push('share_link');
  }
  if (readiness.sendAllowed) {
    availableChannels.push('documented_send');
  }
  if (
    stage === 'shared_with_customer' ||
    stage === 'document_sent' ||
    (activeShare && activeShare.status === 'active')
  ) {
    availableChannels.push('public_portal');
  }

  const canPublicAcceptDecline = offer.workflowStatus === 'sent';

  const documentDisplayName = input.document
    ? `${input.document.documentNumber} (Version ${input.document.version})`
    : null;

  return {
    offerId: offer.id,
    offerNumber: offer.offerNumber,
    offerVersionId: readiness.offerVersionId,
    customerId: offer.leadId,
    companyName: offer.customerSnapshot.companyName,
    contactName: resolveContactName(offer),
    email: offer.customerSnapshot.email?.trim() || null,
    phone: offer.customerSnapshot.phone?.trim() || null,
    documentId: input.document?.id ?? readiness.documentId,
    documentVersion: input.document?.version ?? null,
    documentDisplayName,
    shareLinkId: activeShare?.id ?? null,
    shareUrl: input.shareUrl ?? null,
    validUntil: activeShare?.validUntil ?? offer.validUntil,
    commercialContext: resolveCommercialContext(offer),
    stage,
    readiness,
    availableChannels,
    canCreateShareLink: readiness.shareAllowed,
    canRecordDocumentSent: readiness.sendAllowed,
    canCreateFinalPdf: readiness.pdfCreateAllowed,
    canPublicAcceptDecline,
    primaryBlockerMessage: primaryPublicationBlockerMessage(readiness),
    lastDeliveryAt: delivery.lastDeliveryAt,
    lastDeliveryChannel: delivery.lastDeliveryChannel,
    lastDeliveryRecipient: delivery.lastDeliveryRecipient,
  };
}
