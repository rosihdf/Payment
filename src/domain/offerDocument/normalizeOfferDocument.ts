import { generateId, nowIso } from '../../utils/id';
import { isValidSha256HexHash } from './offerDocumentHash';
import type {
  OfferDocument,
  OfferDocumentSnapshot,
  OfferDocumentStatus,
} from './offerDocument';
import { CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION } from './offerDocument';

const DOCUMENT_STATUSES: OfferDocumentStatus[] = ['generated', 'superseded'];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asDocumentStatus(value: unknown): OfferDocumentStatus {
  if (typeof value === 'string' && DOCUMENT_STATUSES.includes(value as OfferDocumentStatus)) {
    return value as OfferDocumentStatus;
  }

  return 'generated';
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function copySnapshot(snapshot: OfferDocumentSnapshot): OfferDocumentSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as OfferDocumentSnapshot;
}

function normalizeSnapshot(value: unknown): OfferDocumentSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const senderRaw = (raw.sender && typeof raw.sender === 'object' ? raw.sender : {}) as Record<
    string,
    unknown
  >;

  const snapshot = copySnapshot({
    schemaVersion: asNonNegativeInteger(raw.schemaVersion, CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION),
    documentId: asString(raw.documentId) || generateId('offer_doc_snapshot'),
    documentNumber: asString(raw.documentNumber),
    documentVersion: Math.max(1, asNonNegativeInteger(raw.documentVersion, 1)),
    offerId: asString(raw.offerId),
    offerNumber: asString(raw.offerNumber),
    offerStatusAtGeneration:
      raw.offerStatusAtGeneration === 'completed' ||
      raw.offerStatusAtGeneration === 'cancelled' ||
      raw.offerStatusAtGeneration === 'draft'
        ? raw.offerStatusAtGeneration
        : 'draft',
    offerUpdatedAtAtGeneration: asString(raw.offerUpdatedAtAtGeneration) || nowIso(),
    generatedAt: asString(raw.generatedAt) || nowIso(),
    generatedByUserId: asString(raw.generatedByUserId),
    generatedByDisplayName: asString(raw.generatedByDisplayName),
    sender: {
      companyName: asString(senderRaw.companyName),
      legalForm: asString(senderRaw.legalForm),
      street: asString(senderRaw.street),
      postalCode: asString(senderRaw.postalCode),
      city: asString(senderRaw.city),
      phone: asString(senderRaw.phone),
      email: asString(senderRaw.email),
      website: asString(senderRaw.website),
      managingDirector: asString(senderRaw.managingDirector),
      registerCourt: asString(senderRaw.registerCourt),
      registerNumber: asString(senderRaw.registerNumber),
      vatId: asString(senderRaw.vatId),
      bankName: asString(senderRaw.bankName),
      iban: asString(senderRaw.iban),
      bic: asString(senderRaw.bic),
    },
    customer: {
      leadId: asString((raw.customer as Record<string, unknown> | undefined)?.leadId),
      companyName: asString((raw.customer as Record<string, unknown> | undefined)?.companyName),
      contactFirstName: asString(
        (raw.customer as Record<string, unknown> | undefined)?.contactFirstName,
      ),
      contactLastName: asString(
        (raw.customer as Record<string, unknown> | undefined)?.contactLastName,
      ),
      street: asString((raw.customer as Record<string, unknown> | undefined)?.street),
      postalCode: asString((raw.customer as Record<string, unknown> | undefined)?.postalCode),
      city: asString((raw.customer as Record<string, unknown> | undefined)?.city),
      email: asString((raw.customer as Record<string, unknown> | undefined)?.email),
      phone: asString((raw.customer as Record<string, unknown> | undefined)?.phone),
      taxNumber: asString((raw.customer as Record<string, unknown> | undefined)?.taxNumber),
      vatId: asString((raw.customer as Record<string, unknown> | undefined)?.vatId),
    },
    title: asString(raw.title),
    introductionText: asString(raw.introductionText),
    customerNotes: asString(raw.customerNotes),
    validUntil: asNullableString(raw.validUntil),
    tariff: raw.tariff ? (raw.tariff as OfferDocumentSnapshot['tariff']) : null,
    items: Array.isArray(raw.items) ? (raw.items as OfferDocumentSnapshot['items']) : [],
    totals: raw.totals
      ? (raw.totals as OfferDocumentSnapshot['totals'])
      : {
          monthlyItemsTotalCents: 0,
          oneTimeItemsTotalCents: 0,
          tariffMonthlyFixedTotalCents: 0,
          tariffSetupTotalCents: 0,
          monthlyTotalCents: 0,
          oneTimeTotalCents: 0,
          hasOnRequestItems: false,
          onRequestItemCount: 0,
        },
    cancellationState: raw.cancellationState
      ? (raw.cancellationState as OfferDocumentSnapshot['cancellationState'])
      : null,
    contentHash: asString(raw.contentHash),
  });

  if (!isValidSha256HexHash(snapshot.contentHash) && snapshot.contentHash !== '') {
    snapshot.contentHash = '';
  }

  return snapshot;
}

export function normalizeOfferDocument(value: unknown): OfferDocument {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const timestamp = nowIso();

  const document: OfferDocument = {
    id: asString(raw.id) || generateId('offer_doc'),
    offerId: asString(raw.offerId),
    offerNumber: asString(raw.offerNumber),
    documentNumber: asString(raw.documentNumber),
    version: Math.max(1, asNonNegativeInteger(raw.version, 1)),
    status: asDocumentStatus(raw.status),
    snapshot: normalizeSnapshot(raw.snapshot),
    createdAt: asString(raw.createdAt) || timestamp,
    updatedAt: asString(raw.updatedAt) || timestamp,
  };

  if (!document.snapshot.documentNumber) {
    document.snapshot.documentNumber = document.documentNumber;
  }

  return document;
}

export function normalizeOfferDocuments(values: unknown[]): OfferDocument[] {
  return values.map((value) => normalizeOfferDocument(value));
}

export function stripBinaryFieldsFromDocument(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const raw = value as Record<string, unknown>;
  const cleaned = { ...raw };
  delete cleaned.pdfData;
  delete cleaned.pdfBase64;
  delete cleaned.binaryData;
  delete cleaned.htmlContent;

  if (cleaned.snapshot && typeof cleaned.snapshot === 'object') {
    const snapshot = { ...(cleaned.snapshot as Record<string, unknown>) };
    delete snapshot.pdfData;
    delete snapshot.pdfBase64;
    cleaned.snapshot = snapshot;
  }

  return cleaned;
}
