import { normalizeOfferWorkflowEvents } from '../../domain/offer/normalizeOfferWorkflowEvents';
import type { OfferWorkflowEvent } from '../../domain/offer/offerWorkflowEvents';
import { migrateOfferWorkflowStorageIfNeeded } from '../../services/offerWorkflowStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import type { OfferWorkflowEventRepository } from '../interfaces/OfferWorkflowEventRepository';

const keyFor = (event: OfferWorkflowEvent): string => ({
  approval: STORAGE_KEYS.offerApprovals,
  dispatch: STORAGE_KEYS.offerDispatches,
  acceptance: STORAGE_KEYS.offerAcceptances,
  decline: STORAGE_KEYS.offerDeclines,
  activation: STORAGE_KEYS.offerActivations,
})[event.type];

export class LocalOfferWorkflowEventRepository implements OfferWorkflowEventRepository {
  private readAll(): OfferWorkflowEvent[] {
    migrateOfferWorkflowStorageIfNeeded();
    return [
      STORAGE_KEYS.offerApprovals, STORAGE_KEYS.offerDispatches, STORAGE_KEYS.offerAcceptances,
      STORAGE_KEYS.offerDeclines, STORAGE_KEYS.offerActivations,
    ].flatMap((key) => normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(key) ?? []));
  }
  async getAll(): Promise<OfferWorkflowEvent[]> { return this.readAll(); }
  async getByOfferId(offerId: string): Promise<OfferWorkflowEvent[]> {
    return this.readAll().filter((entry) => entry.offerId === offerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async create(event: OfferWorkflowEvent): Promise<OfferWorkflowEvent> {
    migrateOfferWorkflowStorageIfNeeded();
    const key = keyFor(event);
    const values = normalizeOfferWorkflowEvents(readStorageItem<unknown[]>(key) ?? []);
    if (values.some((entry) => entry.id === event.id)) return event;
    writeStorageItem(key, [...values, event]);
    return event;
  }
}
