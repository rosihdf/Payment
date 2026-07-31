import type { ContractStatus } from './contractStatus';

export const CURRENT_CONTRACT_SCHEMA_VERSION = 1;

export interface Contract {
  id: string;
  schemaVersion: number;
  contractNumber: string;
  /** Idempotency key, typically offer:{offerId}:version:{versionId} */
  sourceKey: string;
  leadId: string | null;
  sourceOfferId: string | null;
  acceptedOfferVersionId: string | null;
  currentVersionId: string | null;
  status: ContractStatus;
  ownerUserId: string;
  startDate: string | null;
  termMonths: number | null;
  endDate: string | null;
  noticePeriodMonths: number | null;
  earliestTerminationDate: string | null;
  autoRenewal: boolean;
  renewalMonths: number | null;
  activationOfferId: string | null;
  commissionCaseId: string | null;
  expectedCommissionCents: number | null;
  hardwareCount: number;
  tariffName: string | null;
  customerCompanyName: string;
  nextDeadlineAt: string | null;
  nextDeadlineLabel: string | null;
  plannedChangeAt: string | null;
  terminationId: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  updatedAt: string;
  updatedByUserId: string;
}

export interface ContractListItem extends Contract {
  nextTaskTitle: string | null;
  warningLabels: string[];
}

export interface ContractMetrics {
  activeCount: number;
  activationCount: number;
  expiringIn90Days: number;
  openTerminations: number;
  plannedChanges: number;
  renewalsDue: number;
  suspendedCount: number;
  withoutNextTask: number;
  acceptedOffersWithoutContract: number;
}
