import type { CommissionCalculationRecord } from '../../domain/commission/commissionCalculation';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';
import type { CommissionCalculationRepository } from '../interfaces/CommissionCalculationRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

function calculationToRow(record: CommissionCalculationRecord): Record<string, unknown> {
  return {
    id: record.id,
    offer_id: record.offerId,
    sales_representative_id: record.result.salesRepresentativeId,
    data: record,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function rowToCalculation(row: JsonTableRow): CommissionCalculationRecord {
  return rowData<CommissionCalculationRecord>(row, {
    id: String(row.id),
    offerId: String(row.offer_id ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  } as CommissionCalculationRecord);
}

function rowToCase(row: JsonTableRow): CommissionCase {
  return rowData<CommissionCase>(row, {
    id: String(row.id),
    offerId: String(row.offer_id ?? ''),
    salesRepresentativeId: String(row.sales_representative_id ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  } as CommissionCase);
}

function caseToRow(record: CommissionCase): Record<string, unknown> {
  return {
    id: record.id,
    offer_id: record.offerId,
    sales_representative_id: record.salesRepresentativeId,
    data: record,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function eventToRow(event: CommissionEvent): Record<string, unknown> {
  return {
    id: event.id,
    case_id: event.commissionCaseId ?? '',
    data: event,
    created_at: event.occurredAt,
  };
}

function rowToEvent(row: JsonTableRow): CommissionEvent {
  return rowData<CommissionEvent>(row, {
    id: String(row.id),
    commissionCaseId: (row.case_id as string | null) ?? null,
    occurredAt: String(row.created_at ?? ''),
  } as CommissionEvent);
}

export class SupabaseCommissionCalculationRepository implements CommissionCalculationRepository {
  async getCalculations(): Promise<CommissionCalculationRecord[]> {
    const rows = await sbSelectAll('commission_calculations');
    return rows.map((row) => rowToCalculation(row));
  }

  async getCalculationsByOfferId(offerId: string): Promise<CommissionCalculationRecord[]> {
    const rows = await sbSelectWhere('commission_calculations', 'offer_id', offerId);
    return rows.map((row) => rowToCalculation(row));
  }

  async getCalculationById(id: string): Promise<CommissionCalculationRecord | null> {
    const row = await sbSelectById('commission_calculations', id);
    return row ? rowToCalculation(row) : null;
  }

  async createCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord> {
    const row = await sbInsert('commission_calculations', calculationToRow(record));
    return { ...rowToCalculation(row) };
  }

  async updateCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord> {
    const existing = await this.getCalculationById(record.id);
    if (!existing) {
      throw new Error(`Commission calculation ${record.id} not found`);
    }
    const row = await sbUpdate('commission_calculations', record.id, calculationToRow(record));
    return { ...rowToCalculation(row) };
  }

  async getAllCases(): Promise<CommissionCase[]> {
    const rows = await sbSelectAll('commission_cases');
    return rows.map((row) => rowToCase(row));
  }

  async getCasesByOfferId(offerId: string): Promise<CommissionCase[]> {
    const rows = await sbSelectWhere('commission_cases', 'offer_id', offerId);
    return rows.map((row) => rowToCase(row));
  }

  async createCase(record: CommissionCase): Promise<CommissionCase> {
    const row = await sbInsert('commission_cases', caseToRow(record));
    return { ...rowToCase(row) };
  }

  async createEvent(event: CommissionEvent): Promise<CommissionEvent> {
    const row = await sbInsert('commission_events', eventToRow(event));
    return { ...rowToEvent(row) };
  }
}
