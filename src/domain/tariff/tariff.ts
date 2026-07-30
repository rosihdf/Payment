export type TariffStatus = 'active' | 'inactive';

export type TerminalType = 'stationary' | 'mobile' | 'softpos' | 'ecommerce';

export type BillingInterval = 'monthly' | 'yearly' | 'one_time';

export interface CardRate {
  percentageBasisPoints: number;
  fixedFeeCents: number;
}

export interface TariffCardRates {
  girocard: CardRate;
  debit: CardRate;
  credit: CardRate;
  other: CardRate;
}

export interface Tariff {
  id: string;
  name: string;
  providerName: string;
  productCode: string;
  description: string;
  status: TariffStatus;
  supportedTerminalTypes: TerminalType[];
  monthlyBaseFeeCents: number;
  monthlyTerminalFeeCents: number;
  setupFeeCents: number;
  minimumMonthlyFeeCents: number | null;
  minimumContractMonths: number | null;
  noticePeriodMonths: number | null;
  includedTransactions: number | null;
  additionalTransactionFeeCents: number;
  cardRates: TariffCardRates;
  billingInterval: BillingInterval;
  validFrom: string | null;
  validUntil: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTariffInput {
  name: string;
  providerName: string;
  productCode: string;
  description: string;
  status: TariffStatus;
  supportedTerminalTypes: TerminalType[];
  monthlyBaseFeeCents: number;
  monthlyTerminalFeeCents: number;
  setupFeeCents: number;
  minimumMonthlyFeeCents: number | null;
  minimumContractMonths: number | null;
  noticePeriodMonths: number | null;
  includedTransactions: number | null;
  additionalTransactionFeeCents: number;
  cardRates: TariffCardRates;
  billingInterval: BillingInterval;
  validFrom: string | null;
  validUntil: string | null;
  notes: string;
}

export type TariffFormMode = 'create' | 'edit';

export const TARIFF_STATUS_LABELS: Record<TariffStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
};

export const TERMINAL_TYPE_LABELS: Record<TerminalType, string> = {
  stationary: 'Stationär',
  mobile: 'Mobil',
  softpos: 'SoftPOS',
  ecommerce: 'E-Commerce',
};

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: 'Monatlich',
  yearly: 'Jährlich',
  one_time: 'Einmalig',
};

export const TERMINAL_TYPE_OPTIONS: TerminalType[] = [
  'stationary',
  'mobile',
  'softpos',
  'ecommerce',
];

export const BILLING_INTERVAL_OPTIONS: BillingInterval[] = ['monthly', 'yearly', 'one_time'];

export const TARIFF_STATUS_OPTIONS: TariffStatus[] = ['active', 'inactive'];

export const CARD_RATE_KEYS = ['girocard', 'debit', 'credit', 'other'] as const;

export type CardRateKey = (typeof CARD_RATE_KEYS)[number];

export const CARD_RATE_LABELS: Record<CardRateKey, string> = {
  girocard: 'Girocard',
  debit: 'Debitkarten',
  credit: 'Kreditkarten',
  other: 'Sonstige',
};

export type TariffStatusFilter = 'all' | TariffStatus;

export type TerminalTypeFilter = 'all' | TerminalType;
