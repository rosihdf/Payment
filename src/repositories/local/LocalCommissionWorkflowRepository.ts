import type { CommissionAssignmentVersion } from '../../domain/commission/commissionAssignmentVersion';
import type { CommissionBonusPayment } from '../../domain/commission/commissionBonusPayment';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';
import type { CommissionPaymentRecord } from '../../domain/commission/commissionPaymentRecord';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { CommissionWorkflowRepository } from '../interfaces/CommissionWorkflowRepository';

export class LocalCommissionWorkflowRepository implements CommissionWorkflowRepository {
  async getCaseById(id: string): Promise<CommissionCase | null> {
    const cases = readStorageItem<CommissionCase[]>(STORAGE_KEYS.commissionCases) ?? [];
    return cases.find((item) => item.id === id) ?? null;
  }

  async updateCase(record: CommissionCase): Promise<CommissionCase> {
    const cases = readStorageItem<CommissionCase[]>(STORAGE_KEYS.commissionCases) ?? [];
    const index = cases.findIndex((item) => item.id === record.id);
    if (index === -1) {
      throw new Error(`Commission case ${record.id} not found`);
    }
    const updated = [...cases];
    updated[index] = record;
    writeStorageItem(STORAGE_KEYS.commissionCases, updated);
    return { ...record };
  }

  async getEvents(): Promise<CommissionEvent[]> {
    return readStorageItem<CommissionEvent[]>(STORAGE_KEYS.commissionEvents) ?? [];
  }

  async getEventsByCaseId(caseId: string): Promise<CommissionEvent[]> {
    const events = await this.getEvents();
    return events.filter((event) => event.commissionCaseId === caseId);
  }

  async getAssignmentVersions(): Promise<CommissionAssignmentVersion[]> {
    return readStorageItem<CommissionAssignmentVersion[]>(STORAGE_KEYS.commissionAssignmentVersions) ?? [];
  }

  async getAssignmentVersionsByAssignmentId(
    assignmentId: string,
  ): Promise<CommissionAssignmentVersion[]> {
    const versions = await this.getAssignmentVersions();
    return versions
      .filter((version) => version.assignmentId === assignmentId)
      .sort((left, right) => right.versionNumber - left.versionNumber);
  }

  async createAssignmentVersion(
    version: CommissionAssignmentVersion,
  ): Promise<CommissionAssignmentVersion> {
    const versions = await this.getAssignmentVersions();
    writeStorageItem(STORAGE_KEYS.commissionAssignmentVersions, [...versions, version]);
    return { ...version };
  }

  async getBonusPayments(): Promise<CommissionBonusPayment[]> {
    return readStorageItem<CommissionBonusPayment[]>(STORAGE_KEYS.commissionBonusPayments) ?? [];
  }

  async getBonusPaymentsByRepresentativeId(repId: string): Promise<CommissionBonusPayment[]> {
    const payments = await this.getBonusPayments();
    return payments.filter((payment) => payment.salesRepresentativeId === repId);
  }

  async createBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment> {
    const payments = await this.getBonusPayments();
    writeStorageItem(STORAGE_KEYS.commissionBonusPayments, [...payments, record]);
    return { ...record };
  }

  async updateBonusPayment(record: CommissionBonusPayment): Promise<CommissionBonusPayment> {
    const payments = await this.getBonusPayments();
    const index = payments.findIndex((item) => item.id === record.id);
    if (index === -1) {
      throw new Error(`Commission bonus payment ${record.id} not found`);
    }
    const updated = [...payments];
    updated[index] = record;
    writeStorageItem(STORAGE_KEYS.commissionBonusPayments, updated);
    return { ...record };
  }

  async getPaymentHistory(): Promise<CommissionPaymentRecord[]> {
    return readStorageItem<CommissionPaymentRecord[]>(STORAGE_KEYS.commissionPaymentHistory) ?? [];
  }

  async getPaymentHistoryByCaseId(caseId: string): Promise<CommissionPaymentRecord[]> {
    const history = await this.getPaymentHistory();
    return history.filter((record) => record.commissionCaseId === caseId);
  }

  async createPaymentRecord(record: CommissionPaymentRecord): Promise<CommissionPaymentRecord> {
    const history = await this.getPaymentHistory();
    writeStorageItem(STORAGE_KEYS.commissionPaymentHistory, [...history, record]);
    return { ...record };
  }
}
