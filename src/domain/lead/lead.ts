export type LeadStatus =
  | 'new'
  | 'in_progress'
  | 'contacted'
  | 'offer'
  | 'won'
  | 'lost';

export type LeadInterest = 'low' | 'medium' | 'high';

export type SyncState = 'local' | 'pending' | 'synced' | 'error';

export interface PaymentUsage {
  stationary: boolean;
  mobile: boolean;
  ecommerce: boolean;
  softPos: boolean;
}

export interface CardMix {
  girocardPercent: number;
  debitPercent: number;
  creditPercent: number;
  otherPercent: number;
}

export interface Lead {
  id: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  phone: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
  industry: string;
  currentProvider: string;
  monthlyCardTurnoverCents: number | null;
  monthlyTransactions: number | null;
  averageTransactionValueCents: number | null;
  currentTerminalCount: number | null;
  currentTerminalModels: string;
  paymentUsage: PaymentUsage;
  cardMix: CardMix;
  currentContractEndDate: string | null;
  currentNoticePeriod: string;
  requiredTerminalCount: number;
  status: LeadStatus;
  interest: LeadInterest;
  notes: string;
  nextFollowUpAt: string | null;
  assignedSalesUserId: string;
  createdByUserId: string;
  syncState: SyncState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  phone: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
  industry: string;
  currentProvider: string;
  monthlyCardTurnoverCents: number | null;
  monthlyTransactions: number | null;
  averageTransactionValueCents: number | null;
  currentTerminalCount: number | null;
  currentTerminalModels: string;
  paymentUsage: PaymentUsage;
  cardMix: CardMix;
  currentContractEndDate: string | null;
  currentNoticePeriod: string;
  requiredTerminalCount: number;
  interest: LeadInterest;
  notes: string;
  nextFollowUpAt: string | null;
}

export interface EditLeadInput extends CreateLeadInput {
  status: LeadStatus;
}

export type LeadFormMode = 'create' | 'edit';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Neu',
  in_progress: 'In Bearbeitung',
  contacted: 'Kontaktiert',
  offer: 'Angebot',
  won: 'Gewonnen',
  lost: 'Verloren',
};

export const LEAD_INTEREST_LABELS: Record<LeadInterest, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  local: 'Lokal',
  pending: 'Ausstehend',
  synced: 'Synchronisiert',
  error: 'Fehler',
};

export const LEAD_INTEREST_OPTIONS: LeadInterest[] = ['low', 'medium', 'high'];

export const LEAD_STATUS_OPTIONS: LeadStatus[] = [
  'new',
  'in_progress',
  'contacted',
  'offer',
  'won',
  'lost',
];

export const PAYMENT_USAGE_LABELS: Record<keyof PaymentUsage, string> = {
  stationary: 'Stationär',
  mobile: 'Mobil',
  ecommerce: 'E-Commerce',
  softPos: 'SoftPOS',
};
