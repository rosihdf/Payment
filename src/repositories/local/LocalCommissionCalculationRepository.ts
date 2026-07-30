import type { CommissionCalculationRecord } from '../../domain/commission/commissionCalculation';
import type { CommissionCase } from '../../domain/commission/commissionCase';
import type { CommissionEvent } from '../../domain/commission/commissionCase';
import { migrateCommissionCalculationStorageIfNeeded } from '../../services/commissionCalculationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';

export interface CommissionCalculationRepository {
  getCalculations(): Promise<CommissionCalculationRecord[]>;
  getCalculationsByOfferId(offerId: string): Promise<CommissionCalculationRecord[]>;
  getCalculationById(id: string): Promise<CommissionCalculationRecord | null>;
  createCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord>;
  updateCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord>;
  getCasesByOfferId(offerId: string): Promise<CommissionCase[]>;
  createCase(record: CommissionCase): Promise<CommissionCase>;
  createEvent(event: CommissionEvent): Promise<CommissionEvent>;
}

export class LocalCommissionCalculationRepository implements CommissionCalculationRepository {
  async getCalculations(): Promise<CommissionCalculationRecord[]> {
    migrateCommissionCalculationStorageIfNeeded();
    return readStorageItem<CommissionCalculationRecord[]>(STORAGE_KEYS.commissionCalculations) ?? [];
  }

  async getCalculationsByOfferId(offerId: string): Promise<CommissionCalculationRecord[]> {
    const records = await this.getCalculations();
    return records.filter((record) => record.offerId === offerId);
  }

  async getCalculationById(id: string): Promise<CommissionCalculationRecord | null> {
    const records = await this.getCalculations();
    return records.find((record) => record.id === id) ?? null;
  }

  async createCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord> {
    const records = await this.getCalculations();
    writeStorageItem(STORAGE_KEYS.commissionCalculations, [...records, record]);
    return { ...record };
  }

  async updateCalculation(record: CommissionCalculationRecord): Promise<CommissionCalculationRecord> {
    const records = await this.getCalculations();
    const index = records.findIndex((item) => item.id === record.id);
    if (index === -1) {
      throw new Error(`Commission calculation ${record.id} not found`);
    }
    const updated = [...records];
    updated[index] = record;
    writeStorageItem(STORAGE_KEYS.commissionCalculations, updated);
    return { ...record };
  }

  async getCasesByOfferId(offerId: string): Promise<CommissionCase[]> {
    migrateCommissionCalculationStorageIfNeeded();
    const cases = readStorageItem<CommissionCase[]>(STORAGE_KEYS.commissionCases) ?? [];
    return cases.filter((item) => item.offerId === offerId);
  }

  async createCase(record: CommissionCase): Promise<CommissionCase> {
    migrateCommissionCalculationStorageIfNeeded();
    const cases = readStorageItem<CommissionCase[]>(STORAGE_KEYS.commissionCases) ?? [];
    writeStorageItem(STORAGE_KEYS.commissionCases, [...cases, record]);
    return { ...record };
  }

  async createEvent(event: CommissionEvent): Promise<CommissionEvent> {
    migrateCommissionCalculationStorageIfNeeded();
    const events = readStorageItem<CommissionEvent[]>(STORAGE_KEYS.commissionEvents) ?? [];
    writeStorageItem(STORAGE_KEYS.commissionEvents, [...events, event]);
    return { ...event };
  }
}
