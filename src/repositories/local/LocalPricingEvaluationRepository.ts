import {
  normalizePricingEvaluationRecord,
  normalizePricingEvaluationRecords,
} from '../../domain/pricing/normalizePricingEvaluationRecord';
import type { PricingEvaluationRecord } from '../../domain/pricing/pricingEvaluationRecord';
import { migratePricingEvaluationStorageIfNeeded } from '../../services/pricingEvaluationStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { PricingEvaluationRepository } from '../interfaces/PricingEvaluationRepository';

export class LocalPricingEvaluationRepository implements PricingEvaluationRepository {
  async getAll(): Promise<PricingEvaluationRecord[]> {
    migratePricingEvaluationStorageIfNeeded();
    const rawRecords = readStorageItem<unknown[]>(STORAGE_KEYS.pricingEvaluations) ?? [];
    return normalizePricingEvaluationRecords(rawRecords);
  }

  async getByOfferId(offerId: string): Promise<PricingEvaluationRecord[]> {
    const records = await this.getAll();
    return records.filter((record) => record.offerId === offerId);
  }

  async getById(id: string): Promise<PricingEvaluationRecord | null> {
    const records = await this.getAll();
    return records.find((record) => record.id === id) ?? null;
  }

  async create(record: PricingEvaluationRecord): Promise<PricingEvaluationRecord> {
    const records = await this.getAll();
    const normalizedRecord = normalizePricingEvaluationRecord(record);
    writeStorageItem(STORAGE_KEYS.pricingEvaluations, [...records, normalizedRecord]);
    return { ...normalizedRecord };
  }

  async update(record: PricingEvaluationRecord): Promise<PricingEvaluationRecord> {
    const records = await this.getAll();
    const index = records.findIndex((item) => item.id === record.id);

    if (index === -1) {
      throw new Error(`Pricing evaluation ${record.id} not found`);
    }

    const normalizedRecord = normalizePricingEvaluationRecord(record);
    const updatedRecords = [...records];
    updatedRecords[index] = normalizedRecord;
    writeStorageItem(STORAGE_KEYS.pricingEvaluations, updatedRecords);
    return { ...normalizedRecord };
  }
}
