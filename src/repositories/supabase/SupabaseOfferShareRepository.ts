import { normalizeOfferShares } from '../../domain/offer/normalizeOfferShare';
import type { OfferShare } from '../../domain/offer/offerShare';
import type { OfferShareRepository } from '../interfaces/OfferShareRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_share_links';

function shareToRow(share: OfferShare): Record<string, unknown> {
  return {
    id: share.id,
    offer_id: share.offerId,
    offer_version_id: share.offerVersionId,
    token_hash: share.tokenHash,
    data: share,
    created_at: share.createdAt,
    updated_at: share.createdAt,
  };
}

function rowToShare(row: JsonTableRow): OfferShare {
  const normalized = normalizeOfferShares([
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      offerVersionId: row.offer_version_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
    }),
  ])[0];
  if (!normalized) {
    throw new Error(`OfferShare konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseOfferShareRepository implements OfferShareRepository {
  async getAll(): Promise<OfferShare[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferShares(rows.map((row) => rowToShare(row)));
  }

  async getById(id: string): Promise<OfferShare | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToShare(row) : null;
  }

  async getByOfferId(offerId: string): Promise<OfferShare[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferShares(rows.map((row) => rowToShare(row)));
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferShare[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_version_id', offerVersionId);
    return normalizeOfferShares(rows.map((row) => rowToShare(row)));
  }

  async getByTokenHash(tokenHash: string): Promise<OfferShare | null> {
    const shares = await this.getAll();
    return shares.find((entry) => entry.tokenHash === tokenHash) ?? null;
  }

  async create(share: OfferShare): Promise<OfferShare> {
    const existing = await this.getById(share.id);
    if (existing) {
      throw new Error(`OfferShare already exists: ${share.id}`);
    }
    const row = await sbInsert(TABLE, shareToRow(share));
    return rowToShare(row);
  }

  async update(share: OfferShare): Promise<OfferShare> {
    const existing = await this.getById(share.id);
    if (!existing) {
      throw new Error(`OfferShare not found: ${share.id}`);
    }
    const row = await sbUpdate(TABLE, share.id, shareToRow(share));
    return rowToShare(row);
  }
}
