import { describe, expect, it } from 'vitest';
import type {
  BestPayComparisonConditions,
  CurrentPaymentConditions,
} from '../domain/calculator/comparison';
import { DEFAULT_CURRENT_PAYMENT_CONDITIONS } from '../domain/calculator/comparisonDefaults';
import { mapTariffToBestPayComparisonConditions } from '../domain/calculator/comparisonMapping';
import { getDemoTariffs } from '../services/demoDataService';
import { calculatePaymentComparison } from '../services/paymentComparisonService';

const EXCEL_CURRENT: CurrentPaymentConditions = {
  ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
};

const EXCEL_BEST_PAY: BestPayComparisonConditions = {
  tariffId: 'excel-reference',
  tariffName: 'Excel Referenz',
  productCode: 'EXCEL-REFERENCE',
  monthlyAccountBaseFeeCents: 0,
  monthlyTerminalRentalCents: 995,
  monthlyServiceFeePerTerminalCents: 0,
  transactionFeeTenthsOfCent: 59,
  girocardClearingFeeTenthsOfCent: 19,
  girocardRateTenthsOfBasisPoint: 400,
  creditCardRateTenthsOfBasisPoint: 790,
  debitCardRateTenthsOfBasisPoint: 790,
};

function getClassicConditions(): BestPayComparisonConditions {
  const classic = getDemoTariffs().find((tariff) => tariff.id === 'tariff_bestpay_a920_classic');
  if (!classic) {
    throw new Error('Classic tariff missing');
  }

  return mapTariffToBestPayComparisonConditions(classic);
}

function getFlatConditions(): BestPayComparisonConditions {
  const flat = getDemoTariffs().find((tariff) => tariff.id === 'tariff_bestpay_a920_flat');
  if (!flat) {
    throw new Error('Flat tariff missing');
  }

  return mapTariffToBestPayComparisonConditions(flat);
}

describe('paymentComparisonService', () => {
  it('matches the Excel reference case exactly', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, EXCEL_BEST_PAY);

    expect(result.current.totalMonthlyCostsCents).toBe(17_435);
    expect(result.bestPay.totalMonthlyCostsCents).toBe(14_950);
    expect(result.monthlySavingsCents).toBe(2_485);
    expect(result.annualSavingsCents).toBe(29_820);
    expect(result.contractDurationSavingsCents).toBe(149_100);
    expect(result.totalMonthlyCardVolumeCents).toBe(2_000_000);
    expect(result.totalMonthlyTransactionCount).toBe(500);
    expect(result.averageReceiptCents).toBe(4_000);
    expect(result.currentEffectiveRateTenthsOfBasisPoint).toBe(872);
    expect(result.bestPayEffectiveRateTenthsOfBasisPoint).toBe(748);
    expect(result.isSaving).toBe(true);
  });

  it('matches A920 Classic reference case exactly', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, getClassicConditions());

    expect(result.current.totalMonthlyCostsCents).toBe(17_435);
    expect(result.bestPay.totalMonthlyCostsCents).toBe(16_731);
    expect(result.monthlySavingsCents).toBe(704);
    expect(result.annualSavingsCents).toBe(8_448);
    expect(result.contractDurationSavingsCents).toBe(42_240);
    expect(result.isSaving).toBe(true);
  });

  it('matches A920 Flat reference case exactly', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, getFlatConditions());

    expect(result.bestPay.totalMonthlyCostsCents).toBe(22_545);
    expect(result.monthlySavingsCents).toBe(-5_110);
    expect(result.annualSavingsCents).toBe(-61_320);
    expect(result.contractDurationSavingsCents).toBe(-306_600);
    expect(result.isSaving).toBe(false);
    expect(result.isEqual).toBe(false);
  });

  it('calculates multiple terminals with service per terminal', () => {
    const result = calculatePaymentComparison(
      { ...EXCEL_CURRENT, terminalCount: 3 },
      getClassicConditions(),
    );

    expect(result.bestPay.accountBaseFeeCents).toBe(0);
    expect(result.bestPay.terminalRentalCents).toBe(995 * 3);
    expect(result.bestPay.serviceFeeCents).toBe(795 * 3);
  });

  it('applies account base fee only once', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, {
      ...getClassicConditions(),
      monthlyAccountBaseFeeCents: 500,
    });

    expect(result.bestPay.accountBaseFeeCents).toBe(500);
  });

  it('handles zero transactions', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardTransactionCountMonthly: 0,
        acquiringTransactionCountMonthly: 0,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.current.transactionCostsCents).toBe(0);
    expect(result.current.girocardClearingCostsCents).toBe(0);
    expect(result.totalMonthlyTransactionCount).toBe(0);
    expect(result.averageReceiptCents).toBeNull();
  });

  it('handles zero volume and null effective rate', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardVolumeMonthlyCents: 0,
        creditCardVolumeMonthlyCents: 0,
        debitCardVolumeMonthlyCents: 0,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.currentEffectiveRateTenthsOfBasisPoint).toBeNull();
    expect(result.bestPayEffectiveRateTenthsOfBasisPoint).toBeNull();
  });

  it('handles girocard-only volume', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        creditCardVolumeMonthlyCents: 0,
        debitCardVolumeMonthlyCents: 0,
      },
      {
        ...EXCEL_BEST_PAY,
        creditCardRateTenthsOfBasisPoint: 0,
        debitCardRateTenthsOfBasisPoint: 0,
      },
    );

    expect(result.current.creditCardPercentageCostsCents).toBe(0);
    expect(result.current.debitCardPercentageCostsCents).toBe(0);
  });

  it('handles credit-card-only volume', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardVolumeMonthlyCents: 0,
        debitCardVolumeMonthlyCents: 0,
        girocardTransactionCountMonthly: 0,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.current.girocardPercentageCostsCents).toBe(0);
    expect(result.current.creditCardPercentageCostsCents).toBeGreaterThan(0);
  });

  it('handles debit-card-only volume', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardVolumeMonthlyCents: 0,
        creditCardVolumeMonthlyCents: 0,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.current.debitCardPercentageCostsCents).toBeGreaterThan(0);
  });

  it('handles all fees at zero', () => {
    const zeroCurrent: CurrentPaymentConditions = {
      terminalCount: 1,
      contractDurationYears: 1,
      terminalRentalPerUnitCents: 0,
      transactionFeeTenthsOfCent: 0,
      girocardTransactionCountMonthly: 100,
      acquiringTransactionCountMonthly: 50,
      girocardClearingFeeTenthsOfCent: 0,
      girocardRateTenthsOfBasisPoint: 0,
      girocardVolumeMonthlyCents: 100_000,
      creditCardRateTenthsOfBasisPoint: 0,
      creditCardVolumeMonthlyCents: 0,
      debitCardRateTenthsOfBasisPoint: 0,
      debitCardVolumeMonthlyCents: 0,
    };

    const zeroBestPay: BestPayComparisonConditions = {
      ...EXCEL_BEST_PAY,
      monthlyTerminalRentalCents: 0,
      monthlyServiceFeePerTerminalCents: 0,
      transactionFeeTenthsOfCent: 0,
      girocardClearingFeeTenthsOfCent: 0,
      girocardRateTenthsOfBasisPoint: 0,
      creditCardRateTenthsOfBasisPoint: 0,
      debitCardRateTenthsOfBasisPoint: 0,
    };

    const result = calculatePaymentComparison(zeroCurrent, zeroBestPay);
    expect(result.current.totalMonthlyCostsCents).toBe(0);
    expect(result.bestPay.totalMonthlyCostsCents).toBe(0);
    expect(result.isEqual).toBe(true);
  });

  it('detects BestPay as cheaper', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, EXCEL_BEST_PAY);
    expect(result.isSaving).toBe(true);
    expect(result.monthlySavingsCents).toBeGreaterThan(0);
  });

  it('detects equal costs', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, {
      ...EXCEL_BEST_PAY,
      monthlyTerminalRentalCents: EXCEL_CURRENT.terminalRentalPerUnitCents,
      transactionFeeTenthsOfCent: EXCEL_CURRENT.transactionFeeTenthsOfCent,
      girocardClearingFeeTenthsOfCent: EXCEL_CURRENT.girocardClearingFeeTenthsOfCent,
      girocardRateTenthsOfBasisPoint: EXCEL_CURRENT.girocardRateTenthsOfBasisPoint,
      creditCardRateTenthsOfBasisPoint: EXCEL_CURRENT.creditCardRateTenthsOfBasisPoint,
      debitCardRateTenthsOfBasisPoint: EXCEL_CURRENT.debitCardRateTenthsOfBasisPoint,
    });

    expect(result.isEqual).toBe(true);
    expect(result.monthlySavingsCents).toBe(0);
  });

  it('detects BestPay as more expensive', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, {
      ...EXCEL_BEST_PAY,
      monthlyTerminalRentalCents: 5000,
      transactionFeeTenthsOfCent: 200,
      girocardRateTenthsOfBasisPoint: 5000,
      creditCardRateTenthsOfBasisPoint: 5000,
      debitCardRateTenthsOfBasisPoint: 5000,
    });

    expect(result.isSaving).toBe(false);
    expect(result.monthlySavingsCents).toBeLessThan(0);
  });

  it('allows negative savings', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, {
      ...EXCEL_BEST_PAY,
      monthlyTerminalRentalCents: 9999,
    });

    expect(result.monthlySavingsCents).toBeLessThan(0);
  });

  it('calculates contract duration savings', () => {
    const result = calculatePaymentComparison(
      { ...EXCEL_CURRENT, contractDurationYears: 3 },
      EXCEL_BEST_PAY,
    );

    expect(result.contractDurationSavingsCents).toBe(result.annualSavingsCents * 3);
  });

  it('rounds sub-cent transaction fees correctly', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardTransactionCountMonthly: 1,
        acquiringTransactionCountMonthly: 0,
        transactionFeeTenthsOfCent: 59,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.current.transactionCostsCents).toBe(6);
  });

  it('rounds sub-cent clearing correctly', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardTransactionCountMonthly: 350,
        acquiringTransactionCountMonthly: 0,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.bestPay.girocardClearingCostsCents).toBe(665);
  });

  it('calculates 0,249 % exactly for Classic girocard volume', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, getClassicConditions());
    expect(result.bestPay.girocardPercentageCostsCents).toBe(3_486);
  });

  it('does not use girocard fixed fee as clearing', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, getFlatConditions());
    expect(result.bestPay.girocardClearingCostsCents).toBe(0);
  });

  it('rounds percentage amounts to whole cents', () => {
    const result = calculatePaymentComparison(
      {
        ...EXCEL_CURRENT,
        girocardVolumeMonthlyCents: 123_456,
        girocardRateTenthsOfBasisPoint: 330,
        creditCardVolumeMonthlyCents: 0,
        debitCardVolumeMonthlyCents: 0,
      },
      EXCEL_BEST_PAY,
    );

    expect(result.current.girocardPercentageCostsCents).toBe(
      Math.round((123_456 * 330) / 100_000),
    );
  });

  it('never returns NaN or Infinity', () => {
    const result = calculatePaymentComparison(EXCEL_CURRENT, EXCEL_BEST_PAY);
    const values = JSON.stringify(result);

    expect(values.includes('NaN')).toBe(false);
    expect(values.includes('Infinity')).toBe(false);
  });
});
