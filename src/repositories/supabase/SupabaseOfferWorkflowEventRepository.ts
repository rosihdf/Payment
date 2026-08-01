import {
  normalizeOfferWorkflowEvent,
  normalizeOfferWorkflowEvents,
} from '../../domain/offer/normalizeOfferWorkflowEvents';
import type { OfferWorkflowEvent } from '../../domain/offer/offerWorkflowEvents';
import type { OfferWorkflowEventRepository } from '../interfaces/OfferWorkflowEventRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectWhere,
  type JsonTableRow,
} from './supabaseTable';

const TABLE = 'offer_workflow_events';

function eventToRow(event: OfferWorkflowEvent): Record<string, unknown> {
  return {
    id: event.id,
    offer_id: event.offerId,
    event_type: event.type,
    created_by_user_id: event.createdByUserId,
    data: event,
    created_at: event.createdAt,
  };
}

function rowToEvent(row: JsonTableRow): OfferWorkflowEvent {
  const normalized = normalizeOfferWorkflowEvent(
    rowData(row, {
      id: row.id,
      offerId: row.offer_id,
      type: row.event_type,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }),
  );
  if (!normalized) {
    throw new Error(`OfferWorkflowEvent konnte nicht normalisiert werden: ${row.id}`);
  }
  return normalized;
}

export class SupabaseOfferWorkflowEventRepository implements OfferWorkflowEventRepository {
  async getAll(): Promise<OfferWorkflowEvent[]> {
    const rows = await sbSelectAll(TABLE);
    return normalizeOfferWorkflowEvents(rows.map((row) => rowToEvent(row)));
  }

  async getByOfferId(offerId: string): Promise<OfferWorkflowEvent[]> {
    const rows = await sbSelectWhere(TABLE, 'offer_id', offerId);
    return normalizeOfferWorkflowEvents(rows.map((row) => rowToEvent(row))).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  async create(event: OfferWorkflowEvent): Promise<OfferWorkflowEvent> {
    const row = await sbInsert(TABLE, eventToRow(event));
    return rowToEvent(row);
  }
}
