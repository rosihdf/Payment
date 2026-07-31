export const OFFER_WORKFLOW_EVENT_SCHEMA_VERSION = 1;

export interface OfferWorkflowEventBase {
  id: string;
  schemaVersion: number;
  offerId: string;
  offerVersionId: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  note: string;
}

export interface OfferApproval extends OfferWorkflowEventBase {
  type: 'approval';
  status: 'submitted' | 'started' | 'changes_requested' | 'approved';
  requestedByUserId: string;
  approvedByUserId: string | null;
}

export interface OfferDispatch extends OfferWorkflowEventBase {
  type: 'dispatch';
  channel: 'email' | 'portal' | 'manual';
  recipient: string;
  sentAt: string;
}

export interface OfferAcceptance extends OfferWorkflowEventBase {
  type: 'acceptance';
  acceptedAt: string;
  acceptedByName: string;
  acceptanceType: OfferAcceptanceType;
  otherText: string | null;
}

export type OfferAcceptanceType = 'signed_offer' | 'email_confirmation' | 'personal_confirmation' | 'digital_confirmation' | 'other';
export type OfferDeclineReason = 'price' | 'competitor' | 'contract_term' | 'hardware' | 'no_need' | 'no_response' | 'postponed' | 'other';

export interface OfferDecline extends OfferWorkflowEventBase {
  type: 'decline';
  declinedAt: string;
  reason: OfferDeclineReason;
  otherText: string | null;
}

export interface OfferActivationDeviation {
  field: string;
  expected: string;
  actual: string;
  reason: string;
}

export interface OfferActivationChecklist {
  offerVersionId: string;
  checks: Record<string, boolean>;
}

export interface OfferActivation extends OfferWorkflowEventBase {
  type: 'activation';
  status: 'prepared' | 'activated';
  checklist: OfferActivationChecklist;
  activatedAt: string | null;
  externalReference: string | null;
  deviations: OfferActivationDeviation[];
  activatedHardware: string[];
}

export type OfferWorkflowEvent =
  | OfferApproval
  | OfferDispatch
  | OfferAcceptance
  | OfferDecline
  | OfferActivation;
