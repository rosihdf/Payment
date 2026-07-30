import type { CurrentPaymentConditions } from './comparison';

export const DEFAULT_CURRENT_PAYMENT_CONDITIONS: CurrentPaymentConditions = {
  terminalCount: 1,
  contractDurationYears: 5,

  terminalRentalPerUnitCents: 1995,

  transactionFeeTenthsOfCent: 70,
  girocardTransactionCountMonthly: 350,
  acquiringTransactionCountMonthly: 150,

  girocardClearingFeeTenthsOfCent: 0,

  girocardRateTenthsOfBasisPoint: 300,
  girocardVolumeMonthlyCents: 1_400_000,

  creditCardRateTenthsOfBasisPoint: 1290,
  creditCardVolumeMonthlyCents: 500_000,

  debitCardRateTenthsOfBasisPoint: 1290,
  debitCardVolumeMonthlyCents: 100_000,
};
