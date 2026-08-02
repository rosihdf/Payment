import { normalizeOfferCustomerQuestions } from '../../domain/offer/normalizeOfferCustomerQuestion';
import type { OfferCustomerQuestion } from '../../domain/offer/offerCustomerQuestion';
import { migrateSalesProcessStorageIfNeeded } from '../../services/salesProcessStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { OfferCustomerQuestionRepository } from '../interfaces/OfferCustomerQuestionRepository';

export class LocalOfferCustomerQuestionRepository implements OfferCustomerQuestionRepository {
  private readAll(): OfferCustomerQuestion[] {
    migrateSalesProcessStorageIfNeeded();
    return normalizeOfferCustomerQuestions(
      readStorageItem<unknown[]>(STORAGE_KEYS.offerCustomerQuestions) ?? [],
    );
  }

  private writeAll(values: OfferCustomerQuestion[]): void {
    migrateSalesProcessStorageIfNeeded();
    writeStorageItem(STORAGE_KEYS.offerCustomerQuestions, values);
  }

  async getAll(): Promise<OfferCustomerQuestion[]> {
    return this.readAll();
  }

  async getById(id: string): Promise<OfferCustomerQuestion | null> {
    return this.readAll().find((entry) => entry.id === id) ?? null;
  }

  async getByOfferId(offerId: string): Promise<OfferCustomerQuestion[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId);
  }

  async getByOfferVersionId(offerVersionId: string): Promise<OfferCustomerQuestion[]> {
    return this.readAll().filter((entry) => entry.offerVersionId === offerVersionId);
  }

  async create(question: OfferCustomerQuestion): Promise<OfferCustomerQuestion> {
    const all = this.readAll();
    if (all.some((entry) => entry.id === question.id)) {
      throw new Error(`OfferCustomerQuestion already exists: ${question.id}`);
    }
    all.push(question);
    this.writeAll(all);
    return question;
  }

  async update(question: OfferCustomerQuestion): Promise<OfferCustomerQuestion> {
    const all = this.readAll();
    const index = all.findIndex((entry) => entry.id === question.id);
    if (index < 0) {
      throw new Error(`OfferCustomerQuestion not found: ${question.id}`);
    }
    all[index] = question;
    this.writeAll(all);
    return question;
  }
}
