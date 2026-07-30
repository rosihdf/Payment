import type { CardRate, CreateTariffInput, TariffCardRates } from './tariff';

export const DEFAULT_CARD_RATE: CardRate = {
  percentageTenthsOfBasisPoint: 0,
  fixedFeeTenthsOfCent: 0,
};

export const DEFAULT_CARD_RATES: TariffCardRates = {
  girocard: { ...DEFAULT_CARD_RATE },
  debit: { ...DEFAULT_CARD_RATE },
  credit: { ...DEFAULT_CARD_RATE },
  other: { ...DEFAULT_CARD_RATE },
};

export const DEFAULT_CREATE_TARIFF_INPUT: CreateTariffInput = {
  name: '',
  providerName: 'BestPay',
  productCode: '',
  description: '',
  status: 'active',
  supportedTerminalTypes: [],
  monthlyAccountBaseFeeCents: 0,
  monthlyTerminalRentalCents: 0,
  monthlyServiceFeePerTerminalCents: 0,
  setupFeeCents: 0,
  minimumMonthlyFeeCents: null,
  minimumContractMonths: null,
  noticePeriodMonths: null,
  includedTransactions: null,
  additionalTransactionFeeTenthsOfCent: 0,
  girocardClearingFeeTenthsOfCent: 0,
  girocardClearingIncluded: false,
  cardRates: {
    girocard: { ...DEFAULT_CARD_RATE },
    debit: { ...DEFAULT_CARD_RATE },
    credit: { ...DEFAULT_CARD_RATE },
    other: { ...DEFAULT_CARD_RATE },
  },
  billingInterval: 'monthly',
  validFrom: null,
  validUntil: null,
  notes: '',
};
