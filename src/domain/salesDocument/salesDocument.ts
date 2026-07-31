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
  | 'other'
  | 'activation_identification'
  | 'activation_merchant_application'
  | 'activation_acquiring_application'
  | 'activation_hardware_delivery'
  | 'activation_setup_confirmation'
  | 'activation_test_confirmation'
  | 'activation_completion';

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
  activation_identification: 'Legitimation (Aktivierung)',
  activation_merchant_application: 'Händlerantrag',
  activation_acquiring_application: 'Acquiring-Antrag',
  activation_hardware_delivery: 'Hardware-Lieferschein',
  activation_setup_confirmation: 'Einrichtungsbestätigung',
  activation_test_confirmation: 'Testzahlungsbestätigung',
  activation_completion: 'Abschlussdokumentation',
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
  activationId: string | null;
  type: SalesDocumentType;
  fileName: string;
  mimeType: string;
  externalReference: string | null;
  checksum: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
}
