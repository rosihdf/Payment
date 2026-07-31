export const SALES_DOCUMENT_SCHEMA_VERSION = 1;

export type SalesDocumentType =
  | 'offer_pdf'
  | 'signed_offer'
  | 'approval'
  | 'dispatch_confirmation'
  | 'acceptance'
  | 'activation'
  | 'other';

export const SALES_DOCUMENT_TYPE_LABELS: Record<SalesDocumentType, string> = {
  offer_pdf: 'Angebot',
  signed_offer: 'Unterzeichnetes Angebot',
  approval: 'Freigabe',
  dispatch_confirmation: 'Versandnachweis',
  acceptance: 'Annahme',
  activation: 'Aktivierung',
  other: 'Sonstiges',
};

/** Metadaten only: binary contents are intentionally never persisted locally. */
export interface SalesDocument {
  id: string;
  schemaVersion: number;
  offerId: string;
  offerVersionId: string | null;
  type: SalesDocumentType;
  fileName: string;
  mimeType: string;
  externalReference: string | null;
  checksum: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
}
