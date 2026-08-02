import { normalizeOfferCustomerAcceptances } from '../../domain/offer/normalizeOfferCustomerAcceptance';
import type { OfferCustomerAcceptance } from '../../domain/offer/offerCustomerAcceptance';
import type { OfferCustomerAcceptanceRepository } from '../interfaces/OfferCustomerAcceptanceRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_customer_acceptances';

function acceptanceToRow(acceptance: OfferCustomerAcceptance): Record<string, unknown> {
  return {
    id: acceptance.id,
    offer_id: acceptance.offerId,
    offer_version_id: acceptance.offerVersionId,
    data: acceptance,
    created_at: acceptance.createdAt,
    updated_at: acceptance.createdAt,
  };
}

function rowToAcceptance(row: JsonTableRow): OfferCustomerAcceptance {
  const normalized = normalizeOfferCustomerAcceptances([
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      offerVersionId: row.offer_version_id,
      createdAt: row.created_at,
    }),
  ])[0];
  if (!normalized) {
    throw new Error(`OfferCustomerAcceptance konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseOfferCustomerAcceptanceRepository implements OfferCustomerAcceptanceRepository {
  async getAll(): Promise<OfferCustomerAcceptance[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferCustomerAcceptances(rows.map((row) => rowToAcceptance(row)));
  }

  async getById(id: string): Promise<OfferCustomerAcceptance | null> {
    const row = await sbSelectById(TABLE, id);
    return row ? rowToAcceptance(row) : null;
  }

  async getByOfferId(offerId: string): Promise<OfferCustomerAcceptance[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferCustomerAcceptances(rows.map((row) => rowToAcceptance(row)));
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferCustomerAcceptance | null> {
    const acceptances = await this.getAll();
    return acceptances.find((entry) => entry.offerVersionId === offerVersionId) ?? null;
  }

  async create(acceptance: OfferCustomerAcceptance): Promise<OfferCustomerAcceptance> {
    const existing = await this.getById(acceptance.id);
    if (existing) {
      throw new Error(`OfferCustomerAcceptance already exists: ${acceptance.id}`);
    }
    const row = await sbInsert(TABLE, acceptanceToRow(acceptance));
    return rowToAcceptance(row);
  }
}
