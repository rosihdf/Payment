import { generateId, nowIso } from '../../utils/id';
import type { SalesDocument, SalesDocumentType } from './salesDocument';

const TYPES: SalesDocumentType[] = [
  'offer_pdf',
  'signed_offer',
  'approval',
  'dispatch_confirmation',
  'acceptance',
  'activation',
  'contract',
  'contract_amendment',
  'termination',
  'termination_confirmation',
  'renewal',
  'tariff_change',
  'hardware_change',
  'other',
  'activation_identification',
  'activation_merchant_application',
  'activation_acquiring_application',
  'activation_hardware_delivery',
  'activation_setup_confirmation',
  'activation_test_confirmation',
  'activation_completion',
];
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback);
const nullable = (value: unknown): string | null => text(value) || null;

export function normalizeSalesDocument(value: unknown): SalesDocument | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const type = TYPES.includes(raw.type as SalesDocumentType) ? (raw.type as SalesDocumentType) : 'other';
  const offerId = nullable(raw.offerId);
  const contractId = nullable(raw.contractId);
  const activationId = nullable(raw.activationId);
  if (!offerId && !contractId && !activationId) return null;
  return {
    id: text(raw.id) || generateId('sales_document'),
    schemaVersion: Number(raw.schemaVersion) || 1,
    offerId,
    offerVersionId: nullable(raw.offerVersionId),
    contractId,
    contractVersionId: nullable(raw.contractVersionId),
    terminationId: nullable(raw.terminationId),
    activationId,
    type,
    fileName: text(raw.fileName),
    mimeType: text(raw.mimeType),
    externalReference: nullable(raw.externalReference),
    checksum: nullable(raw.checksum),
    createdAt: text(raw.createdAt) || nowIso(),
    createdByUserId: text(raw.createdByUserId),
    createdByDisplayName: text(raw.createdByDisplayName),
  };
}

export function normalizeSalesDocuments(values: unknown[]): SalesDocument[] {
  return values.map(normalizeSalesDocument).filter((value): value is SalesDocument => value !== null);
}
