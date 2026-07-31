import { generateId, nowIso } from '../../utils/id';
import type { SalesDocument, SalesDocumentType } from './salesDocument';

const TYPES: SalesDocumentType[] = [
  'offer_pdf', 'signed_offer', 'approval', 'dispatch_confirmation', 'acceptance', 'activation', 'other',
];
const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value.trim() : fallback;
const nullable = (value: unknown): string | null => text(value) || null;

export function normalizeSalesDocument(value: unknown): SalesDocument | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const type = TYPES.includes(raw.type as SalesDocumentType) ? raw.type as SalesDocumentType : 'other';
  return {
    id: text(raw.id) || generateId('sales_document'),
    schemaVersion: Number(raw.schemaVersion) || 1,
    offerId: text(raw.offerId),
    offerVersionId: nullable(raw.offerVersionId),
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
