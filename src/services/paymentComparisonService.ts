import type {
  BestPayComparisonConditions,
  ComparisonCostBreakdown,
  CurrentPaymentConditions,
  PaymentComparisonResult,
} from '../domain/calculator/comparison';
import {
  effectiveRateTenthsOfBasisPoint,
  percentageOfCentsFromTenthsOfBasisPoint,
} from '../utils/percentageAmount';
import { transactionCostsFromTenthsOfCent } from '../utils/tenthsOfCent';

function calculateCurrentBreakdown(
  current: CurrentPaymentConditions,
): ComparisonCostBreakdown {
  const terminalRentalCents = current.terminalCount * current.terminalRentalPerUnitCents;

  const totalTransactions =
    current.girocardTransactionCountMonthly + current.acquiringTransactionCountMonthly;

  const transactionCostsCents = transactionCostsFromTenthsOfCent(
    totalTransactions,
    current.transactionFeeTenthsOfCent,
  );

  const girocardClearingCostsCents = transactionCostsFromTenthsOfCent(
    current.girocardTransactionCountMonthly,
    current.girocardClearingFeeTenthsOfCent,
  );

  const girocardPercentageCostsCents = percentageOfCentsFromTenthsOfBasisPoint(
    current.girocardVolumeMonthlyCents,
    current.girocardRateTenthsOfBasisPoint,
  );

  const creditCardPercentageCostsCents = percentageOfCentsFromTenthsOfBasisPoint(
    current.creditCardVolumeMonthlyCents,
    current.creditCardRateTenthsOfBasisPoint,
  );

  const debitCardPercentageCostsCents = percentageOfCentsFromTenthsOfBasisPoint(
    current.debitCardVolumeMonthlyCents,
    current.debitCardRateTenthsOfBasisPoint,
  );

  const totalMonthlyCostsCents =
    terminalRentalCents +
    transactionCostsCents +
    girocardClearingCostsCents +
    girocardPercentageCostsCents +
    creditCardPercentageCostsCents +
    debitCardPercentageCostsCents;

  return {
    accountBaseFeeCents: 0,
    terminalRentalCents,
    serviceFeeCents: 0,
    transactionCostsCents,
    girocardClearingCostsCents,
    girocardPercentageCostsCents,
    creditCardPercentageCostsCents,
    debitCardPercentageCostsCents,
    totalMonthlyCostsCents,
  };
}

function calculateBestPayBreakdown(
  current: CurrentPaymentConditions,
  bestPay: BestPayComparisonConditions,
): ComparisonCostBreakdown {
  const accountBaseFeeCents = bestPay.monthlyAccountBaseFeeCents;
  const terminalRentalCents = current.terminalCount * bestPay.monthlyTerminalRentalCents;
  const serviceFeeCents = current.terminalCount * bestPay.monthlyServiceFeePerTerminalCents;

  const totalTransactions =
    current.girocardTransactionCountMonthly + current.acquiringTransactionCountMonthly;

  const transactionCostsCents = transactionCostsFromTenthsOfCent(
    totalTransactions,
    bestPay.transactionFeeTenthsOfCent,
  );

  const girocardClearingCostsCents = transactionCostsFromTenthsOfCent(
    current.girocardTransactionCountMonthly,
    bestPay.girocardClearingFeeTenthsOfCent,
  );

  const girocardPercentageCostsCents = percentageOfCentsFromTenthsOfBasisPoint(
    current.girocardVolumeMonthlyCents,
    bestPay.girocardRateTenthsOfBasisPoint,
  );

  const creditCardPercentageCostsCents = percentageOfCentsFromTenthsOfBasisPoint(
    current.creditCardVolumeMonthlyCents,
    bestPay.creditCardRateTenthsOfBasisPoint,
  );

  const debitCardPercentageCostsCents = percentageOfCentsFromTenthsOfBasisPoint(
    current.debitCardVolumeMonthlyCents,
    bestPay.debitCardRateTenthsOfBasisPoint,
  );

  const totalMonthlyCostsCents =
    accountBaseFeeCents +
    terminalRentalCents +
    serviceFeeCents +
    transactionCostsCents +
    girocardClearingCostsCents +
    girocardPercentageCostsCents +
    creditCardPercentageCostsCents +
    debitCardPercentageCostsCents;

  return {
    accountBaseFeeCents,
    terminalRentalCents,
    serviceFeeCents,
    transactionCostsCents,
    girocardClearingCostsCents,
    girocardPercentageCostsCents,
    creditCardPercentageCostsCents,
    debitCardPercentageCostsCents,
    totalMonthlyCostsCents,
  };
}

export function calculatePaymentComparison(
  current: CurrentPaymentConditions,
  bestPay: BestPayComparisonConditions,
): PaymentComparisonResult {
  const currentBreakdown = calculateCurrentBreakdown(current);
  const bestPayBreakdown = calculateBestPayBreakdown(current, bestPay);

  const monthlySavingsCents =
    currentBreakdown.totalMonthlyCostsCents - bestPayBreakdown.totalMonthlyCostsCents;
  const annualSavingsCents = monthlySavingsCents * 12;
  const contractDurationSavingsCents = annualSavingsCents * current.contractDurationYears;

  const totalMonthlyCardVolumeCents =
    current.girocardVolumeMonthlyCents +
    current.creditCardVolumeMonthlyCents +
    current.debitCardVolumeMonthlyCents;

  const totalMonthlyTransactionCount =
    current.girocardTransactionCountMonthly + current.acquiringTransactionCountMonthly;

  const averageReceiptCents =
    totalMonthlyTransactionCount > 0
      ? Math.round(totalMonthlyCardVolumeCents / totalMonthlyTransactionCount)
      : null;

  const currentEffectiveRate = effectiveRateTenthsOfBasisPoint(
    currentBreakdown.totalMonthlyCostsCents,
    totalMonthlyCardVolumeCents,
  );

  const bestPayEffectiveRate = effectiveRateTenthsOfBasisPoint(
    bestPayBreakdown.totalMonthlyCostsCents,
    totalMonthlyCardVolumeCents,
  );

  return {
    current: currentBreakdown,
    bestPay: bestPayBreakdown,
    monthlySavingsCents,
    annualSavingsCents,
    contractDurationSavingsCents,
    totalMonthlyCardVolumeCents,
    totalMonthlyTransactionCount,
    averageReceiptCents,
    currentEffectiveRateTenthsOfBasisPoint: currentEffectiveRate,
    bestPayEffectiveRateTenthsOfBasisPoint: bestPayEffectiveRate,
    isSaving: monthlySavingsCents > 0,
    isEqual: monthlySavingsCents === 0,
  };
}
