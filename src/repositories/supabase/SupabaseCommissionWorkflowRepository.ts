import type { CommissionAssignmentVersion } from '../../domain/commission/commissionAssignmentVersion';
import type { CommissionBonusPayment } from '../../domain/commission/commissionBonusPayment';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';
import type { CommissionPaymentRecord } from '../../domain/commission/commissionPaymentRecord';
import type { CommissionWorkflowRepository } from '../interfaces/CommissionWorkflowRepository';
import {
  rowData,
  sbInsert,
  sbSelectAll,
  sbSelectById,
  sbSelectWhere,
  sbUpdate,
  type JsonTableRow,
} from './supabaseTable';

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

function rowToEvent(row: JsonTableRow): CommissionEvent {
  return rowData<CommissionEvent>(row, {
    id: String(row.id),
    commissionCaseId: (row.case_id as string | null) ?? null,
    occurredAt: String(row.created_at ?? ''),
  } as CommissionEvent);
}

function rowToAssignmentVersion(row: JsonTableRow): CommissionAssignmentVersion {
  return rowData<CommissionAssignmentVersion>(row, {
    id: String(row.id),
    assignmentId: String(row.assignment_id ?? ''),
    createdAt: String(row.created_at ?? ''),
  } as CommissionAssignmentVersion);
}

function assignmentVersionToRow(version: CommissionAssignmentVersion): Record<string, unknown> {
  return {
    id: version.id,
    assignment_id: version.assignmentId,
    sales_representative_id: version.salesRepresentativeId,
    data: version,
    created_at: version.createdAt,
  };
}

function rowToBonus(row: JsonTableRow): CommissionBonusPayment {
  return rowData<CommissionBonusPayment>(row, {
    id: String(row.id),
    salesRepresentativeId: String(row.sales_representative_id ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  } as CommissionBonusPayment);
}

function bonusToRow(record: CommissionBonusPayment): Record<string, unknown> {
  return {
    id: record.id,
    sales_representative_id: record.salesRepresentativeId,
    data: record,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function rowToPayment(row: JsonTableRow): CommissionPaymentRecord {
  return rowData<CommissionPaymentRecord>(row, {
    id: String(row.id),
    commissionCaseId: String(row.case_id ?? ''),
    createdAt: String(row.created_at ?? ''),
  } as CommissionPaymentRecord);
}

function paymentToRow(record: CommissionPaymentRecord, repId: string): Record<string, unknown> {
  return {
    id: record.id,
    case_id: record.commissionCaseId,
    sales_representative_id: repId,
    data: record,
    created_at: record.createdAt,
  };
}

export class SupabaseCommissionWorkflowRepository implements CommissionWorkflowRepository {
  async getCaseById(id: string): Promise<CommissionCase | null> {
    const row = await sbSelectById('commission_cases', id);
    return row ? rowToCase(row) : null;
  }

  async updateCase(record: CommissionCase): Promise<CommissionCase> {
    const row = await sbUpdate('commission_cases', record.id, caseToRow(record));
    return rowToCase(row);
  }

  async getEvents(): Promise<CommissionEvent[]> {
    const rows = await sbSelectAll('commission_events');
    return rows.map((row) => rowToEvent(row));
  }

  async getEventsByCaseId(caseId: string): Promise<CommissionEvent[]> {
    const rows = await sbSelectWhere('commission_events', 'case_id', caseId);
    return rows.map((row) => rowToEvent(row));
  }

  async getAssignmentVersions(): Promise<CommissionAssignmentVersion[]> {
    const rows = await sbSelectAll('commission_assignment_versions');
    return rows.map((row) => rowToAssignmentVersion(row));
  }

  async getAssignmentVersionsByAssignmentId(
    assignmentId: string,
  ): Promise<CommissionAssignmentVersion[]> {
    const rows = await sbSelectWhere('commission_assignment_versions', 'assignment_id', assignmentId);
    return rows
      .map((row) => rowToAssignmentVersion(row))
      .sort((left, right) => right.versionNumber - left.versionNumber);
  }

  async createAssignmentVersion(
    version: CommissionAssignmentVersion,
  ): Promise<CommissionAssignmentVersion> {
    const row = await sbInsert('commission_assignment_versions', assignmentVersionToRow(version));
    return rowToAssignmentVersion(row);
  }

  async getBonusPayments(): Promise<CommissionBonusPayment[]> {
    const rows = await sbSelectAll('commission_bonus_payments');
    return rows.map((row) => rowToBonus(row));
  }

  async getBonusPaymentsByRepresentativeId(repId: string): Promise<CommissionBonusPayment[]> {
    const rows = await sbSelectWhere('commission_bonus_payments', 'sales_representative_id', repId);
    return rows.map((row) => rowToBonus(row));
  }

  async createBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment> {
    const row = await sbInsert('commission_bonus_payments', bonusToRow(record));
    return rowToBonus(row);
  }

  async updateBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment> {
    const row = await sbUpdate('commission_bonus_payments', record.id, bonusToRow(record));
    return rowToBonus(row);
  }

  async getPaymentHistory(): Promise<CommissionPaymentRecord[]> {
    const rows = await sbSelectAll('commission_payment_history');
    return rows.map((row) => rowToPayment(row));
  }

  async getPaymentHistoryByCaseId(caseId: string): Promise<CommissionPaymentRecord[]> {
    const rows = await sbSelectWhere('commission_payment_history', 'case_id', caseId);
    return rows.map((row) => rowToPayment(row));
  }

  async createPaymentRecord(record: CommissionPaymentRecord): Promise<CommissionPaymentRecord> {
    const caseRow = await sbSelectById('commission_cases', record.commissionCaseId);
    const repId = caseRow ? String(caseRow.sales_representative_id ?? '') : '';
    const row = await sbInsert('commission_payment_history', paymentToRow(record, repId));
    return rowToPayment(row);
  }
}
