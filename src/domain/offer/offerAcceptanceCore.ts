import { ACCEPTED_OFFER_WORKFLOW_STATUSES } from '../contract/buildContractFromAcceptedOffer';
import type { OfferWorkflowEvent } from './offerWorkflowEvents';
import {
  canTransitionWorkflowStatus,
  type OfferWorkflowStatus,
} from './offerWorkflow';
import { findAcceptanceEventBySourceKey } from './offerWorkflowTransitionCore';

export function resolveContractCreationWorkflowStatus(
  workflowStatus: OfferWorkflowStatus,
): OfferWorkflowStatus | null {
  if (ACCEPTED_OFFER_WORKFLOW_STATUSES.includes(workflowStatus)) {
    return workflowStatus;
  }
  if (canTransitionWorkflowStatus(workflowStatus, 'accept')) {
    return 'accepted';
  }
  return null;
}

export function isOfferAcceptanceDuplicate(input: {
  workflowStatus: OfferWorkflowStatus;
  events: OfferWorkflowEvent[];
  acceptanceEventSourceKey: string;
}): boolean {
  return (
    findAcceptanceEventBySourceKey(input.events, input.acceptanceEventSourceKey) !== null ||
    input.workflowStatus === 'accepted'
  );
}

export function isAcceptedOfferMissingContract(input: {
  workflowStatus: OfferWorkflowStatus;
  hasContract: boolean;
}): boolean {
  return input.workflowStatus === 'accepted' && !input.hasContract;
}
