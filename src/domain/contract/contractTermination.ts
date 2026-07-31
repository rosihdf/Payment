export const CURRENT_CONTRACT_TERMINATION_SCHEMA_VERSION = 1;

export type ContractTerminationReason =
  | 'price'
  | 'competitor'
  | 'service'
  | 'hardware'
  | 'business_closure'
  | 'provider_switch'
  | 'no_usage'
  | 'contract_change'
  | 'other';

export const CONTRACT_TERMINATION_REASON_LABELS: Record<ContractTerminationReason, string> = {
  price: 'Preis',
  competitor: 'Wettbewerber',
  service: 'Service',
  hardware: 'Hardware',
  business_closure: 'Geschäftsaufgabe',
  provider_switch: 'Anbieterwechsel',
  no_usage: 'Keine Nutzung',
  contract_change: 'Vertragsänderung',
  other: 'Sonstiges',
};

export type ContractTerminationStatus =
  | 'recorded'
  | 'review_required'
  | 'winback'
  | 'confirmed'
  | 'withdrawn'
  | 'completed'
  | 'rejected';

export const CONTRACT_TERMINATION_STATUS_LABELS: Record<ContractTerminationStatus, string> = {
  recorded: 'Erfasst',
  review_required: 'Prüfung erforderlich',
  winback: 'Rückgewinnung',
  confirmed: 'Bestätigt',
  withdrawn: 'Zurückgezogen',
  completed: 'Beendet',
  rejected: 'Abgelehnt',
};

export type ContractTerminationChannel =
  | 'email'
  | 'phone'
  | 'letter'
  | 'portal'
  | 'in_person'
  | 'other';

export type ContractTerminationParty = 'customer' | 'internal';

export type WinbackStatus = 'none' | 'open' | 'won' | 'lost';

export interface ContractTermination {
  id: string;
  schemaVersion: number;
  contractId: string;
  contractVersionId: string | null;
  status: ContractTerminationStatus;
  receivedAt: string;
  requestedEndDate: string | null;
  effectiveEndDate: string | null;
  reason: ContractTerminationReason;
  otherReasonText: string | null;
  channel: ContractTerminationChannel;
  party: ContractTerminationParty;
  documentedByUserId: string;
  documentedAt: string;
  winbackPossible: boolean;
  winbackStatus: WinbackStatus;
  confirmedAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  comment: string;
  evidenceDocumentId: string | null;
  noticePeriodClear: boolean;
  reviewNote: string | null;
}
