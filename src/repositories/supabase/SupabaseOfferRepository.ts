import type { Offer } from '../../domain/offer/offer';
import {
  toOfferListItem,
  type OfferListItem,
  type OfferListQuery,
} from '../../domain/offer/offerListItem';
import { normalizeOffer, normalizeOffers } from '../../domain/offer/normalizeOffer';
import { OfferConflictError } from '../errors/OfferConflictError';
import { OfferNotFoundError } from '../errors/OfferNotFoundError';
import type { OfferRepository } from '../interfaces/OfferRepository';
import {
  rowData,
  sbDelete,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offers';
const LIST_COLUMNS =
  'id, lead_id, offer_number, created_by_user_id, created_at, updated_at, data';

function offerToRow(offer: Offer): Record<string, unknown> {
  const normalized = normalizeOffer(offer);
  return {
    id: normalized.id,
    lead_id: normalized.leadId?.trim() ? normalized.leadId : null,
    created_by_user_id: normalized.createdByUserId,
    offer_number: normalized.offerNumber,
    data: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function rowToOffer(row: JsonTableRow): Offer {
  return normalizeOffer(
    rowData(row, {
      id: row.id,
      leadId: row.lead_id ? String(row.lead_id) : '',
      createdByUserId: row.created_by_user_id,
      offerNumber: row.offer_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function sbSelectOfferRows(leadId?: string): Promise<JsonTableRow[]> {
  if (leadId) {
    return sbSelectWhere(TABLE, 'lead_id', leadId, LIST_COLUMNS);
  }
  const client = (await import('../../lib/supabaseClient')).getSupabaseClient();
  const { data, error } = await client.from(TABLE).select(LIST_COLUMNS);
  if (error) {
    throw new Error(`${TABLE} laden fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as JsonTableRow[];
}

export class SupabaseOfferRepository implements OfferRepository {
  async getAll(): Promise<Offer[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOffers(rows.map((row) => rowToOffer(row)));
  }

  async listItems(query: OfferListQuery = {}): Promise<OfferListItem[]> {
    let rows = await sbSelectOfferRows(query.leadId);
    if (query.offset) {
      rows = rows.slice(query.offset);
    }
    if (query.limit) {
      rows = rows.slice(0, query.limit);
    }
    return rows.map((row) => toOfferListItem(rowToOffer(row)));
  }

  async getByLeadId(leadId: string): Promise<Offer[]> {
    const rows = await sbSelectOfferRows(leadId);
    return normalizeOffers(rows.map((row) => rowToOffer(row)));
  }

  async getById(id: string): Promise<Offer | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToOffer(row) : null;
  }

  async create(offer: Offer): Promise<Offer> {
    const normalizedOffer = normalizeOffer(offer);
    const existing = await this.getById(normalizedOffer.id);
    if (existing) {
      throw new OfferConflictError('duplicate_id', `Offer with id ${normalizedOffer.id} already exists`);
    }

    const duplicates = await sbSelectWhere(TABLE, 'offer_number', normalizedOffer.offerNumber, 'id');
    if (duplicates.length > 0) {
      throw new OfferConflictError(
        'duplicate_offer_number',
        `Offer number ${normalizedOffer.offerNumber} already exists`,
      );
    }

    const row = await sbInsert(TABLE, offerToRow(normalizedOffer));
    return rowToOffer(row);
  }

  async update(offer: Offer): Promise<Offer> {
    const existing = await this.getById(offer.id);
    if (!existing) {
      throw new OfferNotFoundError(offer.id);
    }

    const normalizedOffer = normalizeOffer(offer);
    const duplicates = await sbSelectWhere(TABLE, 'offer_number', normalizedOffer.offerNumber, 'id');
    if (duplicates.some((row) => row.id !== normalizedOffer.id)) {
      throw new OfferConflictError(
        'duplicate_offer_number',
        `Offer number ${normalizedOffer.offerNumber} already exists`,
      );
    }

    const row = await sbUpdate(TABLE, normalizedOffer.id, offerToRow(normalizedOffer));
    return rowToOffer(row);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new OfferNotFoundError(id);
    }
    await sbDelete(TABLE, id);
  }
}
