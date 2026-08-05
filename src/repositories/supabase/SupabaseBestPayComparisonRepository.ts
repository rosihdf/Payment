import type { BestPayComparisonSession } from '../../domain/bestPayComparison/bestPayComparisonSession';
import { getSupabaseClient } from '../../lib/supabaseClient';
import type { BestPayComparisonRepository } from '../interfaces/BestPayComparisonRepository';
import {
  normalizeBestPayComparisonSession,
} from '../../services/bestPayComparisonStorageMigration';
import {
  rowData,
  sbDelete,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

const SESSIONS_TABLE = 'best_pay_comparison_sessions';
const ACTIVE_SESSIONS_TABLE = 'user_active_sessions';

function sessionToRow(session: BestPayComparisonSession): Record<string, unknown> {
  return {
    id: session.id,
    created_by_user_id: session.createdByUserId,
    lead_id: session.leadId,
    offer_id: session.offerId,
    data: session,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

function rowToSession(row: JsonTableRow): BestPayComparisonSession {
  const normalized = normalizeBestPayComparisonSession(
    rowData(row, {
      id: row.id,
      createdByUserId: row.created_by_user_id,
      leadId: row.lead_id,
      offerId: row.offer_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
  if (!normalized) {
    throw new Error(`BestPayComparisonSession konnte nicht normalisiert werden: ${row.id}`);
  }
  // Spalten-FKs sind maßgeblich – data-JSON darf eine gesetzte Zuordnung nicht mit null überschreiben.
  const columnLeadId = typeof row.lead_id === 'string' && row.lead_id.trim() ? row.lead_id : null;
  const columnOfferId = typeof row.offer_id === 'string' && row.offer_id.trim() ? row.offer_id : null;
  if (columnLeadId) {
    normalized.leadId = columnLeadId;
  }
  if (columnOfferId) {
    normalized.offerId = columnOfferId;
  }
  return normalized;
}

export class SupabaseBestPayComparisonRepository implements BestPayComparisonRepository {
  async getAll(): Promise<BestPayComparisonSession[]> {
    const rows = await sbSelectAll(SESSIONS_TABLE);
    return rows
      .map((row) => rowToSession(row))
      .filter((entry): entry is BestPayComparisonSession => entry !== null);
  }

  async getById(id: string): Promise<BestPayComparisonSession | null> {
    const row = await sbSelectById(SESSIONS_TABLE, id);
    return row ? rowToSession(row) : null;
  }

  async save(session: BestPayComparisonSession): Promise<BestPayComparisonSession> {
    const existing = await this.getById(session.id);
    // Verhindert Race: späterer Persist eines älteren Snapshots darf Bindungen/Ergebnisse nicht löschen.
    const nextSession = existing
      ? {
          ...session,
          leadId: session.leadId ?? existing.leadId,
          customerLabel: session.customerLabel ?? existing.customerLabel,
          leadDisplayName: session.leadDisplayName ?? existing.leadDisplayName,
          offerId: session.offerId ?? existing.offerId,
          offerNumber: session.offerNumber ?? existing.offerNumber,
          offerTitle: session.offerTitle ?? existing.offerTitle,
          result: session.result ?? existing.result,
          selectedCandidateId: session.selectedCandidateId ?? existing.selectedCandidateId,
          wizard: {
            ...session.wizard,
            selectedScenarioId:
              session.wizard.selectedScenarioId ?? existing.wizard.selectedScenarioId,
            scenarios: session.wizard.scenarios.map((entry) => {
              const prior = existing.wizard.scenarios.find((item) => item.id === entry.id);
              if (!prior) {
                return entry;
              }
              return {
                ...entry,
                result: entry.result ?? prior.result,
                selectedCandidateId: entry.selectedCandidateId ?? prior.selectedCandidateId,
                approval: entry.approval ?? prior.approval,
              };
            }),
          },
        }
      : session;
    const rowPayload = sessionToRow(nextSession);
    try {
      const row = existing
        ? await sbUpdate(SESSIONS_TABLE, nextSession.id, rowPayload)
        : await sbInsert(SESSIONS_TABLE, rowPayload);
      return rowToSession(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /duplicate key|unique constraint|best_pay_one_active_advice_draft_per_lead/i.test(message)
      ) {
        throw new Error('ACTIVE_ADVICE_DRAFT_CONFLICT');
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await sbDelete(SESSIONS_TABLE, id);
  }

  async getActiveSessionId(userId: string): Promise<string | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(ACTIVE_SESSIONS_TABLE)
      .select('comparison_session_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      throw new Error(`Aktive Vergleichssitzung laden fehlgeschlagen: ${error.message}`);
    }
    return (data?.comparison_session_id as string | null | undefined) ?? null;
  }

  async setActiveSessionId(userId: string, sessionId: string | null): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from(ACTIVE_SESSIONS_TABLE).upsert(
      {
        user_id: userId,
        comparison_session_id: sessionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(`Aktive Vergleichssitzung speichern fehlgeschlagen: ${error.message}`);
    }
  }
}
