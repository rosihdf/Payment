import type {
  OfferCustomerSnapshot,
  OfferItem,
  OfferStatus,
  OfferTariffSnapshot,
  OfferTotals,
} from '../offer/offer';

export type OfferDocumentType = 'preview' | 'final';

export type OfferDocumentStatus = 'generated' | 'superseded';

export const OFFER_DOCUMENT_STATUS_LABELS: Record<OfferDocumentStatus, string> = {
  generated: 'Aktuell',
  superseded: 'Frühere Version',
};

export interface OfferDocumentSenderSnapshot {
  companyName: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  managingDirector: string;
  registerCourt: string;
  registerNumber: string;
  vatId: string;
  bankName: string;
  iban: string;
  bic: string;
}

export interface OfferDocumentCancellationSnapshot {
  cancelledAt: string | null;
  cancellationReason: string;
}

export interface OfferDocumentSnapshot {
  schemaVersion: number;

  documentId: string;
  documentNumber: string;
  documentVersion: number;

  offerId: string;
  /** Gebundene Angebotsversion – PDF gehört zu genau dieser Version. */
  offerVersionId: string | null;
  offerNumber: string;
  offerStatusAtGeneration: OfferStatus;
  offerUpdatedAtAtGeneration: string;

  generatedAt: string;
  generatedByUserId: string;
  generatedByDisplayName: string;

  sender: OfferDocumentSenderSnapshot;
  customer: OfferCustomerSnapshot;

  title: string;
  introductionText: string;
  customerNotes: string;
  validUntil: string | null;

  tariff: OfferTariffSnapshot | null;
  items: OfferItem[];

  totals: OfferTotals;

  cancellationState: OfferDocumentCancellationSnapshot | null;

  contentHash: string;
}

export interface OfferDocument {
  id: string;

  offerId: string;
  /** Gebundene Angebotsversion; null nur für Legacy-Dokumente vor Phase 1B. */
  offerVersionId: string | null;
  offerNumber: string;

  documentNumber: string;
  version: number;

  status: OfferDocumentStatus;

  snapshot: OfferDocumentSnapshot;

  createdAt: string;
  updatedAt: string;
}

export interface OfferDocumentIntegrityResult {
  documentId: string;
  valid: boolean;
  expectedHash: string;
  actualHash: string;
  checkedAt: string;
}

export const CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION = 1;
