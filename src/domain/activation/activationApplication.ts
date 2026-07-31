export const CURRENT_ACTIVATION_APPLICATION_SCHEMA_VERSION = 1;

export type ActivationApplicationType = 'merchant_setup' | 'acquiring' | 'terminal_provisioning' | 'add_on' | 'other';

export const ACTIVATION_APPLICATION_TYPE_LABELS: Record<ActivationApplicationType, string> = {
  merchant_setup: 'Händlereinrichtung',
  acquiring: 'Acquiring-Antrag',
  terminal_provisioning: 'Terminal-Bereitstellung',
  add_on: 'Zusatzleistung',
  other: 'Sonstiges',
};

export type ActivationApplicationStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'inquiry'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export const ACTIVATION_APPLICATION_STATUS_LABELS: Record<ActivationApplicationStatus, string> = {
  draft: 'Entwurf',
  ready: 'Bereit',
  submitted: 'Eingereicht',
  inquiry: 'Rückfrage',
  in_review: 'In Prüfung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  cancelled: 'Storniert',
};

/** Manual, metadata-only application record — no external API calls. */
export interface ActivationApplication {
  id: string;
  schemaVersion: number;
  activationId: string;
  type: ActivationApplicationType;
  status: ActivationApplicationStatus;
  title: string;
  referenceNumber: string | null;
  submittedAt: string | null;
  submittedByUserId: string | null;
  decisionAt: string | null;
  decisionNote: string;
  inquiryNote: string;
  documentId: string | null;
  sourceKey: string | null;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
}
