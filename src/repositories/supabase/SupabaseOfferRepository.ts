import type { Offer } from '../../domain/offer/offer';
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
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offers';

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

export class SupabaseOfferRepository implements OfferRepository {
  async getAll(): Promise<Offer[]> {
    const rows = await sbSelectAll(TABLE);
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

    const all = await this.getAll();
    if (all.some((item) => item.offerNumber === normalizedOffer.offerNumber)) {
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
    const all = await this.getAll();
    if (
      all.some(
        (item) => item.id !== normalizedOffer.id && item.offerNumber === normalizedOffer.offerNumber,
      )
    ) {
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
