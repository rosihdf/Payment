import type { OfferContractModel } from '../offer/offerContractModel';
import type { OfferCustomerSnapshot, OfferItem, OfferTariffSnapshot, OfferTotals } from '../offer/offer';

export const CURRENT_CONTRACT_VERSION_SCHEMA_VERSION = 1;

export type ContractVersionStatus = 'draft' | 'planned' | 'active' | 'expired' | 'discarded';

export const CONTRACT_VERSION_STATUS_LABELS: Record<ContractVersionStatus, string> = {
  draft: 'Entwurf',
  planned: 'Geplant',
  active: 'Aktiv',
  expired: 'Abgelaufen',
  discarded: 'Verworfen',
};

export type ContractChangeReason =
  | 'initial'
  | 'tariff_change'
  | 'term_extension'
  | 'terminal_add'
  | 'terminal_remove'
  | 'terminal_model_change'
  | 'accessory_add'
  | 'accessory_remove'
  | 'fee_change'
  | 'contact_change'
  | 'address_change'
  | 'contract_model_change'
  | 'renewal'
  | 'other_amendment';

export const CONTRACT_CHANGE_REASON_LABELS: Record<ContractChangeReason, string> = {
  initial: 'Erstvertrag',
  tariff_change: 'Tarifwechsel',
  term_extension: 'Laufzeitverlängerung',
  terminal_add: 'Terminal hinzufügen',
  terminal_remove: 'Terminal entfernen',
  terminal_model_change: 'Terminalmodell wechseln',
  accessory_add: 'Zubehör hinzufügen',
  accessory_remove: 'Zubehör entfernen',
  fee_change: 'Gebührenänderung',
  contact_change: 'Ansprechpartner ändern',
  address_change: 'Vertragsanschrift ändern',
  contract_model_change: 'Vertragsmodell ändern',
  renewal: 'Verlängerung',
  other_amendment: 'Sonstiger Nachtrag',
};

export interface ContractHardwareLine {
  productId: string | null;
  productName: string;
  model: string;
  quantity: number;
  mobility: 'stationary' | 'mobile' | 'unknown';
  acquisition: 'purchase' | 'rental' | 'unknown';
  activationStatus: 'pending' | 'active' | 'returned' | 'unknown';
  serialNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  unitPriceCents: number | null;
}

export interface ContractFeeSnapshot {
  monthlyFeeCents: number | null;
  setupFeeCents: number | null;
  transactionFeeNote: string | null;
  clearingNote: string | null;
  discountNote: string | null;
}

export interface ContractVersionSnapshot {
  schemaVersion: number;
  customerSnapshot: OfferCustomerSnapshot;
  tariffSnapshot: OfferTariffSnapshot | null;
  contractModel: OfferContractModel;
  termMonths: number | null;
  startDate: string | null;
  endDate: string | null;
  noticePeriodMonths: number | null;
  autoRenewal: boolean;
  renewalMonths: number | null;
  terminalCount: number;
  terminalLines: OfferItem[];
  accessoryLines: OfferItem[];
  hardware: ContractHardwareLine[];
  fees: ContractFeeSnapshot;
  optionalItems: OfferItem[];
  totals: OfferTotals;
  priceBookVersion: string | null;
  commissionReferenceId: string | null;
  expectedCommissionCents: number | null;
  sourceOfferId: string | null;
  sourceOfferVersionId: string | null;
  sourceOfferNumber: string | null;
  activationNote: string | null;
}

export interface ContractVersion {
  id: string;
  schemaVersion: number;
  contractId: string;
  versionNumber: number;
  status: ContractVersionStatus;
  validFrom: string | null;
  validTo: string | null;
  changeReason: ContractChangeReason;
  changeNote: string;
  previousVersionId: string | null;
  sourceOfferVersionId: string | null;
  snapshot: ContractVersionSnapshot;
  approvalRequired: boolean;
  approvalReasons: string[];
  approvedAt: string | null;
  approvedByUserId: string | null;
  activatedAt: string | null;
  discardedAt: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
}

export interface ContractVersionDiffEntry {
  field: string;
  label: string;
  before: string;
  after: string;
  category: 'customer' | 'tariff' | 'term' | 'hardware' | 'fees' | 'model' | 'other';
  approvalRelevant: boolean;
}
