import { normalizeOfferVersion, normalizeOfferVersions } from '../../domain/offer/normalizeOfferVersion';
import type { OfferVersion } from '../../domain/offer/offerVersion';
import type { OfferVersionRepository } from '../interfaces/OfferVersionRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_versions';

function versionToRow(version: OfferVersion): Record<string, unknown> {
  return {
    id: version.id,
    offer_id: version.offerId,
    lead_id: version.snapshot.leadId,
    version_number: version.versionNumber,
    created_by_user_id: version.createdByUserId,
    data: version,
    created_at: version.createdAt,
    updated_at: version.createdAt,
  };
}

function rowToVersion(row: JsonTableRow): OfferVersion {
  const normalized = normalizeOfferVersion(
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      versionNumber: row.version_number,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      snapshot: { leadId: row.lead_id },
    }),
  );
  if (!normalized) {
    throw new Error(`OfferVersion konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseOfferVersionRepository implements OfferVersionRepository {
  async getAll(): Promise<OfferVersion[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferVersions(rows.map((row) => rowToVersion(row)));
  }

  async getById(id: string): Promise<OfferVersion | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToVersion(row) : null;
  }

  async getByOfferId(offerId: string): Promise<OfferVersion[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferVersions(rows.map((row) => rowToVersion(row))).sort(
      (a, b) => a.versionNumber - b.versionNumber,
    );
  }

  async create(version: OfferVersion): Promise<OfferVersion> {
    const existing = await this.getById(version.id);
    if (existing) {
      throw new Error(`OfferVersion already exists: ${version.id}`);
    }
    const row = await sbInsert(TABLE, versionToRow(version));
    return rowToVersion(row);
  }

  async update(version: OfferVersion): Promise<OfferVersion> {
    const existing = await this.getById(version.id);
    if (!existing) {
      throw new Error(`OfferVersion not found: ${version.id}`);
    }
    // Snapshot ist unveränderlich – Updates dürfen nur Metadaten ändern.
    const next: OfferVersion = { ...version, snapshot: existing.snapshot };
    const row = await sbUpdate(TABLE, version.id, versionToRow(next));
    return rowToVersion(row);
  }
}
