import { describe, expect, it } from 'vitest';
import { mapTariffToBestPayComparisonConditions } from '../domain/calculator/comparisonMapping';
import { normalizeTariff } from '../domain/tariff/normalizeTariff';
import { getDemoTariffs } from '../services/demoDataService';

describe('paymentComparison tariff mapping', () => {
  it('maps A920 Classic tariff', () => {
    const tariff = getDemoTariffs().find((item) => item.id === 'tariff_bestpay_a920_classic')!;
    const mapped = mapTariffToBestPayComparisonConditions(tariff);

    expect(mapped.tariffId).toBe('tariff_bestpay_a920_classic');
    expect(mapped.tariffName).toBe('BestPay Mobile A920 Classic');
    expect(mapped.productCode).toBe('BP-A920-CLASSIC');
    expect(mapped.monthlyTerminalRentalCents).toBe(995);
    expect(mapped.monthlyServiceFeePerTerminalCents).toBe(795);
    expect(mapped.transactionFeeTenthsOfCent).toBe(79);
    expect(mapped.girocardClearingFeeTenthsOfCent).toBe(19);
    expect(mapped.girocardRateTenthsOfBasisPoint).toBe(249);
    expect(mapped.creditCardRateTenthsOfBasisPoint).toBe(1190);
    expect(mapped.debitCardRateTenthsOfBasisPoint).toBe(890);
  });

  it('maps A920 Flat tariff with included clearing', () => {
    const tariff = getDemoTariffs().find((item) => item.id === 'tariff_bestpay_a920_flat')!;
    const mapped = mapTariffToBestPayComparisonConditions(tariff);

    expect(mapped.monthlyTerminalRentalCents).toBe(0);
    expect(mapped.monthlyServiceFeePerTerminalCents).toBe(795);
    expect(mapped.transactionFeeTenthsOfCent).toBe(39);
    expect(mapped.girocardClearingFeeTenthsOfCent).toBe(0);
    expect(mapped.girocardRateTenthsOfBasisPoint).toBe(990);
  });

  it('uses zero defaults for missing optional values', () => {
    const mapped = mapTariffToBestPayComparisonConditions(
      normalizeTariff({
        id: 'tariff_min',
        name: 'Minimal',
        productCode: 'MIN',
        status: 'active',
      }),
    );

    expect(mapped.transactionFeeTenthsOfCent).toBe(0);
    expect(mapped.girocardClearingFeeTenthsOfCent).toBe(0);
    expect(mapped.creditCardRateTenthsOfBasisPoint).toBe(0);
  });

  it('maps legacy cent transaction fees to tenths of cent', () => {
    const mapped = mapTariffToBestPayComparisonConditions(
      normalizeTariff({
        id: 'tariff_legacy_fee',
        name: 'Legacy',
        productCode: 'LEG',
        additionalTransactionFeeCents: 8,
        cardRates: {
          girocard: { percentageBasisPoints: 25, fixedFeeCents: 0 },
        },
      }),
    );

    expect(mapped.transactionFeeTenthsOfCent).toBe(80);
  });

  it('does not map girocard fixed fee as clearing', () => {
    const mapped = mapTariffToBestPayComparisonConditions(
      normalizeTariff({
        id: 'tariff_legacy_clearing',
        name: 'Legacy',
        productCode: 'LEG2',
        cardRates: {
          girocard: { percentageBasisPoints: 25, fixedFeeCents: 9 },
        },
      }),
    );

    expect(mapped.girocardClearingFeeTenthsOfCent).toBe(0);
  });

  it('preserves explicit tenths of cent values', () => {
    const mapped = mapTariffToBestPayComparisonConditions(
      normalizeTariff({
        id: 'tariff_tenths',
        name: 'Tenths',
        productCode: 'TEN',
        additionalTransactionFeeCents: 8,
        additionalTransactionFeeTenthsOfCent: 59,
        girocardClearingFeeTenthsOfCent: 19,
      }),
    );

    expect(mapped.transactionFeeTenthsOfCent).toBe(59);
    expect(mapped.girocardClearingFeeTenthsOfCent).toBe(19);
  });
});
