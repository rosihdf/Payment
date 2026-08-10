import { buildContractSourceKey } from '../contract/contractNumber';
import type { OfferWorkflowEvent, OfferAcceptance, OfferDecline } from './offerWorkflowEvents';
import {
  applyWorkflowTransition,
  syncLegacyOfferStatus,
  type OfferWorkflowStatus,
  type OfferWorkflowTransition,
} from './offerWorkflow';

export type OfferDeliveryChannel = 'manual' | 'share_link' | 'email' | 'whatsapp' | 'portal';

export type OfferLegacyStatus = 'draft' | 'completed' | 'cancelled';

export interface OfferWorkflowSnapshot {
  id: string;
  workflowStatus: OfferWorkflowStatus;
  status: OfferLegacyStatus;
  currentVersionId: string | null;
  leadId: string | null;
  createdByUserId: string;
  completedAt: string | null;
  completedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  updatedAt: string;
}

export interface OfferDeliveryInput {
  offerId: string;
  offerVersionId: string;
  documentId?: string | null;
  channel: OfferDeliveryChannel;
  recipient?: string;
  shareLinkId?: string | null;
  deliveredAt?: string;
}

export function mapDeliveryChannelToDispatch(
  channel: OfferDeliveryChannel,
): 'email' | 'portal' | 'manual' {
  if (channel === 'share_link' || channel === 'portal') {
    return 'portal';
  }
  if (channel === 'email') {
    return 'email';
  }
  return 'manual';
}

export function buildOfferDeliverySourceKey(input: {
  offerId: string;
  offerVersionId: string;
  channel: OfferDeliveryChannel;
  shareLinkId?: string | null;
}): string {
  if (input.shareLinkId) {
    return `offer_delivery:${input.offerId}:${input.offerVersionId}:${input.channel}:${input.shareLinkId}`;
  }
  return `offer_delivery:${input.offerId}:${input.offerVersionId}:${input.channel}`;
}

export function buildOfferSentActivitySourceKey(offerId: string, offerVersionId: string): string {
  return `offer_sent:${offerId}:${offerVersionId}`;
}

export function buildPublicAcceptanceActivitySourceKey(offerId: string, shareId: string): string {
  return `offer_customer_accept:${offerId}:${shareId}`;
}

export function buildPublicDeclineActivitySourceKey(offerId: string, shareId: string): string {
  return `offer_customer_decline:${offerId}:${shareId}`;
}

export function buildInternalAcceptanceActivitySourceKey(
  offerId: string,
  offerVersionId: string,
): string {
  return `offer_accepted:${offerId}:${offerVersionId}`;
}

export function buildInternalAcceptanceEventSourceKey(
  offerId: string,
  offerVersionId: string,
): string {
  return `offer_acceptance:${offerId}:${offerVersionId}`;
}

export function buildInternalDeclineEventSourceKey(
  offerId: string,
  offerVersionId: string,
): string {
  return `offer_decline:${offerId}:${offerVersionId}`;
}

export function buildPublicAcceptanceEventSourceKey(offerId: string, shareId: string): string {
  return `offer_public_acceptance:${offerId}:${shareId}`;
}

export function buildPublicDeclineEventSourceKey(offerId: string, shareId: string): string {
  return `offer_public_decline:${offerId}:${shareId}`;
}

export function buildContractSourceKeyForOfferVersion(
  offerId: string,
  offerVersionId: string,
): string {
  return buildContractSourceKey(offerId, offerVersionId);
}

export function canApplyWorkflowTransition(
  from: OfferWorkflowStatus,
  transition: OfferWorkflowTransition,
): boolean {
  return applyWorkflowTransition(from, transition) !== null;
}

export function buildOfferAfterWorkflowTransition(
  offer: OfferWorkflowSnapshot,
  transition: OfferWorkflowTransition,
  context: { userId: string; timestamp: string },
): OfferWorkflowSnapshot | null {
  const target = applyWorkflowTransition(offer.workflowStatus, transition);
  if (!target) {
    return null;
  }
  return {
    ...offer,
    workflowStatus: target,
    status: syncLegacyOfferStatus(target),
    updatedAt: context.timestamp,
    completedAt: target === 'accepted' ? context.timestamp : offer.completedAt,
    completedByUserId: target === 'accepted' ? context.userId : offer.completedByUserId,
    cancelledAt: target === 'cancelled' ? context.timestamp : offer.cancelledAt,
    cancelledByUserId: target === 'cancelled' ? context.userId : offer.cancelledByUserId,
  };
}

export function findDeliveryEventBySourceKey(
  events: OfferWorkflowEvent[],
  sourceKey: string,
): Extract<OfferWorkflowEvent, { type: 'dispatch' }> | null {
  const match = events.find(
    (event) => event.type === 'dispatch' && event.note === sourceKey,
  );
  return match?.type === 'dispatch' ? match : null;
}

export function findAcceptanceEventBySourceKey(
  events: OfferWorkflowEvent[],
  sourceKey: string,
): Extract<OfferWorkflowEvent, { type: 'acceptance' }> | null {
  const match = events.find(
    (event) => event.type === 'acceptance' && event.note === sourceKey,
  );
  return match?.type === 'acceptance' ? match : null;
}

export function findDeclineEventBySourceKey(
  events: OfferWorkflowEvent[],
  sourceKey: string,
): Extract<OfferWorkflowEvent, { type: 'decline' }> | null {
  const match = events.find(
    (event) => event.type === 'decline' && event.note === sourceKey,
  );
  return match?.type === 'decline' ? match : null;
}

export function canDeliverOffer(workflowStatus: OfferWorkflowStatus): boolean {
  return workflowStatus === 'ready_to_send';
}

export function isOfferAlreadySent(workflowStatus: OfferWorkflowStatus): boolean {
  return [
    'sent',
    'accepted',
    'declined',
    'activation_pending',
    'activated',
    'released',
    'accounted',
    'paid',
  ].includes(workflowStatus);
}

export function canPublicDecideOffer(workflowStatus: OfferWorkflowStatus): boolean {
  return workflowStatus === 'sent';
}

export function buildPublicAcceptanceEvent(input: {
  offerId: string;
  offerVersionId: string;
  shareId: string;
  acceptedByName: string;
  note: string;
  timestamp: string;
  createdByUserId: string;
  createdByDisplayName: string;
}): OfferAcceptance {
  return {
    id: buildPublicAcceptanceEventSourceKey(input.offerId, input.shareId),
    schemaVersion: 1,
    type: 'acceptance',
    offerId: input.offerId,
    offerVersionId: input.offerVersionId,
    createdAt: input.timestamp,
    createdByUserId: input.createdByUserId,
    createdByDisplayName: input.createdByDisplayName,
    note: buildPublicAcceptanceEventSourceKey(input.offerId, input.shareId),
    acceptedAt: input.timestamp,
    acceptedByName: input.acceptedByName,
    acceptanceType: 'digital_confirmation',
    otherText: input.note || null,
  };
}

export function buildPublicDeclineEvent(input: {
  offerId: string;
  offerVersionId: string;
  shareId: string;
  note: string;
  timestamp: string;
  createdByUserId: string;
  createdByDisplayName: string;
}): OfferDecline {
  return {
    id: buildPublicDeclineEventSourceKey(input.offerId, input.shareId),
    schemaVersion: 1,
    type: 'decline',
    offerId: input.offerId,
    offerVersionId: input.offerVersionId,
    createdAt: input.timestamp,
    createdByUserId: input.createdByUserId,
    createdByDisplayName: input.createdByDisplayName,
    note: buildPublicDeclineEventSourceKey(input.offerId, input.shareId),
    declinedAt: input.timestamp,
    reason: 'other',
    otherText: input.note || null,
  };
}
