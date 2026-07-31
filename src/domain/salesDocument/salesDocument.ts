export const SALES_DOCUMENT_SCHEMA_VERSION = 1;

export type SalesDocumentType =
  | 'offer_pdf'
  | 'signed_offer'
  | 'approval'
  | 'dispatch_confirmation'
  | 'acceptance'
  | 'activation'
  | 'contract'
  | 'contract_amendment'
  | 'termination'
  | 'termination_confirmation'
  | 'renewal'
  | 'tariff_change'
  | 'hardware_change'
  | 'other';

export const SALES_DOCUMENT_TYPE_LABELS: Record<SalesDocumentType, string> = {
  offer_pdf: 'Angebot',
  signed_offer: 'Unterzeichnetes Angebot',
  approval: 'Freigabe',
  dispatch_confirmation: 'Versandnachweis',
  acceptance: 'Annahme',
  activation: 'Aktivierung',
  contract: 'Vertrag',
  contract_amendment: 'Vertragsnachtrag',
  termination: 'Kündigung',
  termination_confirmation: 'Kündigungsbestätigung',
  renewal: 'Verlängerung',
  tariff_change: 'Tarifwechsel',
  hardware_change: 'Hardwareänderung',
  other: 'Sonstiges',
};

/** Metadaten only: binary contents are intentionally never persisted locally. */
export interface SalesDocument {
  id: string;
  schemaVersion: number;
  offerId: string | null;
  offerVersionId: string | null;
  contractId: string | null;
  contractVersionId: string | null;
  terminationId: string | null;
  type: SalesDocumentType;
  fileName: string;
  mimeType: string;
  externalReference: string | null;
  checksum: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
}
