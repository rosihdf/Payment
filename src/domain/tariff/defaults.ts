import type { CardRate, CreateTariffInput, TariffCardRates } from './tariff';

export const DEFAULT_CARD_RATE: CardRate = {
  percentageBasisPoints: 0,
  fixedFeeCents: 0,
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
  monthlyBaseFeeCents: 0,
  monthlyTerminalFeeCents: 0,
  setupFeeCents: 0,
  minimumMonthlyFeeCents: null,
  minimumContractMonths: null,
  noticePeriodMonths: null,
  includedTransactions: null,
  additionalTransactionFeeCents: 0,
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
