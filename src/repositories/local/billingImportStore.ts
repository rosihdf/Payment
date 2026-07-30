import type { BillingCostLineItem } from '../../domain/billingImport/billingCostLineItem';
import type { BillingImportSession } from '../../domain/billingImport/billingImportSession';
import type { BillingSourceDocument } from '../../domain/billingImport/billingSourceDocument';
import type { ExtractedBillingField } from '../../domain/billingImport/extractedBillingField';
import type { BillingPeriodRecord } from '../../domain/billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../../domain/billingImport/customerCostBaseline';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';

export interface BillingImportStore {
  sessions: BillingImportSession[];
  documents: BillingSourceDocument[];
  fields: ExtractedBillingField[];
  periods: BillingPeriodRecord[];
  baselines: CustomerCostBaseline[];
  costLineItems: BillingCostLineItem[];
}

function emptyStore(): BillingImportStore {
  return { sessions: [], documents: [], fields: [], periods: [], baselines: [], costLineItems: [] };
}

export function readBillingImportStore(): BillingImportStore {
  return {
    sessions: readStorageItem<BillingImportSession[]>(STORAGE_KEYS.billingImportSessions) ?? [],
    documents: readStorageItem<BillingSourceDocument[]>(STORAGE_KEYS.billingSourceDocuments) ?? [],
    fields: readStorageItem<ExtractedBillingField[]>(STORAGE_KEYS.billingExtractedFields) ?? [],
    periods: readStorageItem<BillingPeriodRecord[]>(STORAGE_KEYS.billingPeriodRecords) ?? [],
    baselines: readStorageItem<CustomerCostBaseline[]>(STORAGE_KEYS.customerCostBaselines) ?? [],
    costLineItems: readStorageItem<BillingCostLineItem[]>(STORAGE_KEYS.billingCostLineItems) ?? [],
  };
}

export function writeBillingImportStore(store: BillingImportStore): void {
  writeStorageItem(STORAGE_KEYS.billingImportSessions, store.sessions);
  writeStorageItem(STORAGE_KEYS.billingSourceDocuments, store.documents);
  writeStorageItem(STORAGE_KEYS.billingExtractedFields, store.fields);
  writeStorageItem(STORAGE_KEYS.billingPeriodRecords, store.periods);
  writeStorageItem(STORAGE_KEYS.customerCostBaselines, store.baselines);
  writeStorageItem(STORAGE_KEYS.billingCostLineItems, store.costLineItems);
}

export function resetBillingImportStoreForTests(): void {
  writeBillingImportStore(emptyStore());
  localStorage.removeItem(STORAGE_KEYS.billingImportStorageVersion);
}
