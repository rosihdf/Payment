export type BillingImportSessionStatus =
  | 'created'
  | 'uploading'
  | 'extracting'
  | 'review_required'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'superseded';

export interface BillingImportSession {
  id: string;
  leadId: string | null;
  offerId: string | null;
  salesRepresentativeId: string;
  status: BillingImportSessionStatus;
  fileCount: number;
  documentCount: number;
  periodCount: number;
  inputFingerprint: string;
  engineVersion: string;
  internalNote: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  activeBaselineId: string | null;
}

export const BILLING_IMPORT_ENGINE_VERSION = '1.0.0';
