import type { CardMix, CreateLeadInput, PaymentUsage } from './lead';

export const DEFAULT_PAYMENT_USAGE: PaymentUsage = {
  stationary: false,
  mobile: false,
  ecommerce: false,
  softPos: false,
};

export const DEFAULT_CARD_MIX: CardMix = {
  girocardPercent: 0,
  debitPercent: 0,
  creditPercent: 0,
  otherPercent: 0,
};

export const DEFAULT_CREATE_LEAD_INPUT: CreateLeadInput = {
  companyName: '',
  contactFirstName: '',
  contactLastName: '',
  phone: '',
  email: '',
  street: '',
  postalCode: '',
  city: '',
  industry: '',
  currentProvider: '',
  monthlyCardTurnoverCents: null,
  monthlyTransactions: null,
  averageTransactionValueCents: null,
  currentTerminalCount: null,
  currentTerminalModels: '',
  paymentUsage: { ...DEFAULT_PAYMENT_USAGE },
  cardMix: { ...DEFAULT_CARD_MIX },
  currentContractEndDate: null,
  currentNoticePeriod: '',
  requiredTerminalCount: 1,
  interest: 'medium',
  notes: '',
  nextFollowUpAt: null,
};
