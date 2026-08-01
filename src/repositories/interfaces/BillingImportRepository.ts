import type { BillingCostLineItem } from '../../domain/billingImport/billingCostLineItem';
import type { BillingImportSession } from '../../domain/billingImport/billingImportSession';
import type { BillingSourceDocument } from '../../domain/billingImport/billingSourceDocument';
import type { ExtractedBillingField } from '../../domain/billingImport/extractedBillingField';
import type { BillingPeriodRecord } from '../../domain/billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../../domain/billingImport/customerCostBaseline';

export interface BillingImportStoreData {
  sessions: BillingImportSession[];
  documents: BillingSourceDocument[];
  fields: ExtractedBillingField[];
  periods: BillingPeriodRecord[];
  baselines: CustomerCostBaseline[];
  costLineItems: BillingCostLineItem[];
}

export interface BillingImportRepository {
  readStore(): Promise<BillingImportStoreData>;
  writeStore(store: BillingImportStoreData): Promise<void>;
}
