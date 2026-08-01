import { normalizeSalesDocument, normalizeSalesDocuments } from '../../domain/salesDocument/normalizeSalesDocument';
import type { SalesDocument } from '../../domain/salesDocument/salesDocument';
import type { SalesDocumentRepository } from '../interfaces/SalesDocumentRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectWhere,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'sales_documents';

function documentToRow(document: SalesDocument): Record<string, unknown> {
  return {
    id: document.id,
    offer_id: document.offerId,
    contract_id: document.contractId,
    activation_id: document.activationId,
    created_by_user_id: document.createdByUserId,
    data: document,
    created_at: document.createdAt,
  };
}

function rowToDocument(row: JsonTableRow): SalesDocument {
  const normalized = normalizeSalesDocument(
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      contractId: row.contract_id,
      activationId: row.activation_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }),
  );
  if (!normalized) {
    throw new Error(`SalesDocument konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseSalesDocumentRepository implements SalesDocumentRepository {
  async getAll(): Promise<SalesDocument[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeSalesDocuments(rows.map((row) => rowToDocument(row)));
  }

  async getByOfferId(offerId: string): Promise<SalesDocument[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeSalesDocuments(rows.map((row) => rowToDocument(row))).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async create(document: SalesDocument): Promise<SalesDocument> {
    const all = await this.getAll();
    if (all.some((entry) => entry.id === document.id)) {
      return document;
    }
    const row = await sbInsert(TABLE, documentToRow(document));
    return rowToDocument(row);
  }
}
