import type { CommissionCalculationRecord } from '../../domain/commission/commissionCalculation';
import type { CommissionCase, CommissionEvent } from '../../domain/commission/commissionCase';
import { migrateCommissionCalculationStorageIfNeeded } from '../../services/commissionCalculationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { CommissionCalculationRepository } from '../interfaces/CommissionCalculationRepository';

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

  async getAllCases(): Promise<CommissionCase[]> {
    migrateCommissionCalculationStorageIfNeeded();
    return readStorageItem<CommissionCase[]>(STORAGE_KEYS.commissionCases) ?? [];
  }

  async getCasesByOfferId(offerId: string): Promise<CommissionCase[]> {
    const cases = await this.getAllCases();
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
