export type TenthsOfCent = number;

export interface CurrentPaymentConditions {
  terminalCount: number;
  contractDurationYears: number;

  terminalRentalPerUnitCents: number;

  transactionFeeTenthsOfCent: TenthsOfCent;
  girocardTransactionCountMonthly: number;
  acquiringTransactionCountMonthly: number;

  girocardClearingFeeTenthsOfCent: TenthsOfCent;

  girocardRateTenthsOfBasisPoint: number;
  girocardVolumeMonthlyCents: number;

  creditCardRateTenthsOfBasisPoint: number;
  creditCardVolumeMonthlyCents: number;

  debitCardRateTenthsOfBasisPoint: number;
  debitCardVolumeMonthlyCents: number;
}

export interface BestPayComparisonConditions {
  tariffId: string;
  tariffName: string;
  productCode: string;

  monthlyAccountBaseFeeCents: number;
  monthlyTerminalRentalCents: number;
  monthlyServiceFeePerTerminalCents: number;

  transactionFeeTenthsOfCent: TenthsOfCent;
  girocardClearingFeeTenthsOfCent: TenthsOfCent;

  girocardRateTenthsOfBasisPoint: number;
  creditCardRateTenthsOfBasisPoint: number;
  debitCardRateTenthsOfBasisPoint: number;
}

export interface ComparisonCostBreakdown {
  accountBaseFeeCents: number;
  terminalRentalCents: number;
  serviceFeeCents: number;
  transactionCostsCents: number;
  girocardClearingCostsCents: number;
  girocardPercentageCostsCents: number;
  creditCardPercentageCostsCents: number;
  debitCardPercentageCostsCents: number;
  totalMonthlyCostsCents: number;
}

export interface PaymentComparisonResult {
  current: ComparisonCostBreakdown;
  bestPay: ComparisonCostBreakdown;

  monthlySavingsCents: number;
  annualSavingsCents: number;
  contractDurationSavingsCents: number;

  totalMonthlyCardVolumeCents: number;
  totalMonthlyTransactionCount: number;
  averageReceiptCents: number | null;

  currentEffectiveRateTenthsOfBasisPoint: number | null;
  bestPayEffectiveRateTenthsOfBasisPoint: number | null;

  isSaving: boolean;
  isEqual: boolean;
}
