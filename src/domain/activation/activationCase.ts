import type { ActivationStatus } from './activationStatus';

export const CURRENT_ACTIVATION_CASE_SCHEMA_VERSION = 1;

export type ActivationPriority = 'normal' | 'high' | 'urgent';

export const ACTIVATION_PRIORITY_LABELS: Record<ActivationPriority, string> = {
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

export interface ActivationExternalReference {
  system: string;
  reference: string;
  note: string;
}

/** Operational fulfillment case that turns an agreed Contract into a live merchant. */
export interface ActivationCase {
  id: string;
  schemaVersion: number;
  activationNumber: string;
  contractId: string;
  contractVersionId: string;
  leadId: string | null;
  sourceOfferId: string | null;
  /** Idempotency key: contract:{contractId}:initial-activation */
  sourceKey: string;
  status: ActivationStatus;
  ownerUserId: string;
  priority: ActivationPriority;
  plannedStart: string | null;
  desiredGoLive: string | null;
  confirmedGoLive: string | null;
  currentStep: string;
  progressPercent: number;
  nextStep: string | null;
  nextDueAt: string | null;
  openBlockerCount: number;
  openMandatoryCount: number;
  externalReferences: ActivationExternalReference[];
  templateSnapshotId: string | null;
  templateSnapshotVersion: number;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  updatedAt: string;
  updatedByUserId: string;
  completedAt: string | null;
  handedOverAt: string | null;
  cancelledAt: string | null;
  /** Status the case was in before being blocked, to support returning from `blocked`. */
  blockedFromStatus: ActivationStatus | null;
}

export interface ActivationListItem extends ActivationCase {
  contractNumber: string;
  customerCompanyName: string;
  contactName: string;
  offerNumber: string;
  externalReferenceText: string;
  serialNumbers: string[];
  hardwareModels: string[];
  hasOpenTask: boolean;
  warningLabels: string[];
}

export interface ActivationMetrics {
  openCount: number;
  blockedCount: number;
  goLiveIn7Days: number;
  documentsOpenCount: number;
  providerReviewCount: number;
  hardwareOpenCount: number;
  setupOpenCount: number;
  testOpenCount: number;
  goLiveReadyCount: number;
  completionOpenCount: number;
  withoutNextTaskCount: number;
  liveCount: number;
  completedCount: number;
  overdueCount: number;
  averageProgressPercent: number;
}
