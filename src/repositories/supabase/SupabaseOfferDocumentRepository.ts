import type { OfferDocument } from '../../domain/offerDocument/offerDocument';
import {
  normalizeOfferDocument,
  normalizeOfferDocuments,
} from '../../domain/offerDocument/normalizeOfferDocument';
import { OfferDocumentConflictError } from '../errors/OfferDocumentConflictError';
import { OfferDocumentNotFoundError } from '../errors/OfferDocumentNotFoundError';
import type { OfferDocumentRepository } from '../interfaces/OfferDocumentRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_documents';

function documentToRow(document: OfferDocument): Record<string, unknown> {
  const normalized = normalizeOfferDocument(document);
  return {
    id: normalized.id,
    offer_id: normalized.offerId,
    created_by_user_id: normalized.snapshot.generatedByUserId,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToDocument(row: JsonTableRow): OfferDocument {
  return normalizeOfferDocument(
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export class SupabaseOfferDocumentRepository implements OfferDocumentRepository {
  async getAll(): Promise<OfferDocument[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferDocuments(rows.map((row) => rowToDocument(row)));
  }

  async getById(id: string): Promise<OfferDocument | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToDocument(row) : null;
  }

  async getByOfferId(offerId: string): Promise<OfferDocument[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferDocuments(rows.map((row) => rowToDocument(row))).sort(
      (left, right) => right.version - left.version,
    );
  }

  async create(document: OfferDocument): Promise<OfferDocument> {
    const normalizedDocument = normalizeOfferDocument(document);
    const documents = await this.getAll();

    if (documents.some((item) => item.id === normalizedDocument.id)) {
      throw new OfferDocumentConflictError(
        'duplicate_id',
        `Offer document with id ${normalizedDocument.id} already exists`,
      );
    }

    if (documents.some((item) => item.documentNumber === normalizedDocument.documentNumber)) {
      throw new OfferDocumentConflictError(
        'duplicate_document_number',
        `Offer document number ${normalizedDocument.documentNumber} already exists`,
      );
    }

    if (
      documents.some(
        (item) =>
          item.offerId === normalizedDocument.offerId && item.version === normalizedDocument.version,
      )
    ) {
      throw new OfferDocumentConflictError(
        'duplicate_version',
        `Offer document version ${normalizedDocument.version} already exists for offer`,
      );
    }

    const row = await sbInsert(TABLE, documentToRow(normalizedDocument));
    const created = rowToDocument(row);
    return { ...created, snapshot: { ...created.snapshot } };
  }

  async markSuperseded(id: string): Promise<OfferDocument> {
    const current = await this.getById(id);
    if (!current) {
      throw new OfferDocumentNotFoundError(id);
    }

    if (current.status === 'superseded') {
      return { ...current, snapshot: { ...current.snapshot } };
    }

    const updated: OfferDocument = {
      ...current,
      status: 'superseded',
      updatedAt: new Date().toISOString(),
    };

    const row = await sbUpdate(TABLE, id, documentToRow(updated));
    const result = rowToDocument(row);
    return { ...result, snapshot: { ...result.snapshot } };
  }
}
