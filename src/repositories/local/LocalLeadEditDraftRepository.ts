import type { LeadEditDraft } from '../interfaces/LeadEditDraftRepository';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { LeadEditDraftRepository } from '../interfaces/LeadEditDraftRepository';

type EditDraftStore = Record<string, LeadEditDraft>;

export class LocalLeadEditDraftRepository implements LeadEditDraftRepository {
  private readStore(): EditDraftStore {
    return readStorageItem<EditDraftStore>(STORAGE_KEYS.leadEditDrafts) ?? {};
  }

  private writeStore(store: EditDraftStore): void {
    writeStorageItem(STORAGE_KEYS.leadEditDrafts, store);
  }

  async getByLeadId(leadId: string): Promise<LeadEditDraft | null> {
    const store = this.readStore();
    return store[leadId] ?? null;
  }

  async save(leadId: string, draft: LeadEditDraft): Promise<void> {
    const store = this.readStore();
    store[leadId] = draft;
    this.writeStore(store);
  }

  async clear(leadId: string): Promise<void> {
    const store = this.readStore();
    delete store[leadId];
    this.writeStore(store);
  }
}
