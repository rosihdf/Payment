import type { CreateLeadInput } from '../../domain/lead/lead';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { LeadDraftRepository } from '../interfaces/LeadDraftRepository';

type DraftStore = Record<string, CreateLeadInput>;

export class LocalLeadDraftRepository implements LeadDraftRepository {
  private readStore(): DraftStore {
    return readStorageItem<DraftStore>(STORAGE_KEYS.leadDrafts) ?? {};
  }

  private writeStore(store: DraftStore): void {
    writeStorageItem(STORAGE_KEYS.leadDrafts, store);
  }

  async getByUserId(userId: string): Promise<CreateLeadInput | null> {
    const store = this.readStore();
    return store[userId] ?? null;
  }

  async save(userId: string, draft: CreateLeadInput): Promise<void> {
    const store = this.readStore();
    store[userId] = draft;
    this.writeStore(store);
  }

  async clear(userId: string): Promise<void> {
    const store = this.readStore();
    delete store[userId];
    this.writeStore(store);
  }
}
