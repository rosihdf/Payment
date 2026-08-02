import { normalizeOfferChangeRequests } from '../../domain/offer/normalizeOfferChangeRequest';
import type { OfferChangeRequest } from '../../domain/offer/offerChangeRequest';
import type { OfferChangeRequestRepository } from '../interfaces/OfferChangeRequestRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_change_requests';

function requestToRow(request: OfferChangeRequest): Record<string, unknown> {
  return {
    id: request.id,
    offer_id: request.offerId,
    offer_version_id: request.offerVersionId,
    share_id: request.shareId,
    request_text: request.requestText,
    customer_name: request.customerName,
    customer_email: request.customerEmail,
    status: request.status,
    handled_by_user_id: request.handledByUserId,
    handled_at: request.handledAt,
    data: request,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
  };
}

function rowToRequest(row: JsonTableRow): OfferChangeRequest {
  const normalized = normalizeOfferChangeRequests([
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      offerVersionId: row.offer_version_id,
      shareId: row.share_id,
      requestText: row.request_text,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      status: row.status,
      handledByUserId: row.handled_by_user_id,
      handledAt: row.handled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  ])[0];
  if (!normalized) {
    throw new Error(`OfferChangeRequest konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseOfferChangeRequestRepository implements OfferChangeRequestRepository {
  async getAll(): Promise<OfferChangeRequest[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferChangeRequests(rows.map((row) => rowToRequest(row)));
  }

  async getById(id: string): Promise<OfferChangeRequest | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToRequest(row) : null;
  }

  async getByOfferId(offerId: string): Promise<OfferChangeRequest[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferChangeRequests(rows.map((row) => rowToRequest(row)));
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferChangeRequest[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_version_id', offerVersionId);
    return normalizeOfferChangeRequests(rows.map((row) => rowToRequest(row)));
  }

  async create(request: OfferChangeRequest): Promise<OfferChangeRequest> {
    const existing = await this.getById(request.id);
    if (existing) {
      throw new Error(`OfferChangeRequest already exists: ${request.id}`);
    }
    const row = await sbInsert(TABLE, requestToRow(request));
    return rowToRequest(row);
  }

  async update(request: OfferChangeRequest): Promise<OfferChangeRequest> {
    const existing = await this.getById(request.id);
    if (!existing) {
      throw new Error(`OfferChangeRequest not found: ${request.id}`);
    }
    const row = await sbUpdate(TABLE, request.id, requestToRow(request));
    return rowToRequest(row);
  }
}
