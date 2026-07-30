export type TariffStatus = 'active' | 'inactive';

export type TerminalType = 'stationary' | 'mobile' | 'softpos' | 'ecommerce';

export type BillingInterval = 'monthly' | 'yearly' | 'one_time';

/** 1 = 0,1 Basispunkt = 0,001 %; 249 = 0,249 % */
export type TenthsOfBasisPoint = number;

export interface CardRate {
  percentageTenthsOfBasisPoint: TenthsOfBasisPoint;
  fixedFeeTenthsOfCent: number;
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
  monthlyAccountBaseFeeCents: number;
  monthlyTerminalRentalCents: number;
  monthlyServiceFeePerTerminalCents: number;
  setupFeeCents: number;
  minimumMonthlyFeeCents: number | null;
  minimumContractMonths: number | null;
  noticePeriodMonths: number | null;
  includedTransactions: number | null;
  additionalTransactionFeeTenthsOfCent: number;
  girocardClearingFeeTenthsOfCent: number;
  girocardClearingIncluded: boolean;
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
  monthlyAccountBaseFeeCents: number;
  monthlyTerminalRentalCents: number;
  monthlyServiceFeePerTerminalCents: number;
  setupFeeCents: number;
  minimumMonthlyFeeCents: number | null;
  minimumContractMonths: number | null;
  noticePeriodMonths: number | null;
  includedTransactions: number | null;
  additionalTransactionFeeTenthsOfCent: number;
  girocardClearingFeeTenthsOfCent: number;
  girocardClearingIncluded: boolean;
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

export function monthlyFixedCostsForOneTerminalCents(tariff: Pick<
  Tariff,
  'monthlyAccountBaseFeeCents' | 'monthlyTerminalRentalCents' | 'monthlyServiceFeePerTerminalCents'
>): number {
  return (
    tariff.monthlyAccountBaseFeeCents +
    tariff.monthlyTerminalRentalCents +
    tariff.monthlyServiceFeePerTerminalCents
  );
}
