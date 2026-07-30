import { describe, expect, it } from 'vitest';
import { normalizeTariff } from '../domain/tariff/normalizeTariff';
import { getDemoTariffs } from '../services/demoDataService';
import { percentageOfCentsFromTenthsOfBasisPoint } from '../utils/percentageAmount';

describe('Tariff normalization', () => {
  it('loads legacy demo tariff without crashing', () => {
    const normalized = normalizeTariff({ id: 'tariff_legacy', name: 'Legacy Tarif', active: true });

    expect(normalized.id).toBe('tariff_legacy');
    expect(normalized.name).toBe('Legacy Tarif');
    expect(normalized.status).toBe('active');
  });

  it('applies defaults for missing fields', () => {
    const normalized = normalizeTariff({ id: 'tariff_min', name: 'Minimal' });

    expect(normalized.providerName).toBe('BestPay');
    expect(normalized.status).toBe('active');
    expect(normalized.supportedTerminalTypes).toEqual([]);
    expect(normalized.cardRates.girocard).toEqual({
      percentageTenthsOfBasisPoint: 0,
      fixedFeeTenthsOfCent: 0,
    });
    expect(normalized.minimumContractMonths).toBeNull();
    expect(normalized.noticePeriodMonths).toBeNull();
    expect(normalized.includedTransactions).toBeNull();
  });

  it('preserves existing values', () => {
    const normalized = normalizeTariff({
      id: 'tariff_full',
      name: 'Vollständig',
      providerName: 'BestPay',
      productCode: 'BP-FULL',
      status: 'inactive',
      supportedTerminalTypes: ['mobile'],
      monthlyAccountBaseFeeCents: 1490,
      cardRates: {
        girocard: { percentageTenthsOfBasisPoint: 220, fixedFeeTenthsOfCent: 80 },
      },
    });

    expect(normalized.productCode).toBe('BP-FULL');
    expect(normalized.status).toBe('inactive');
    expect(normalized.supportedTerminalTypes).toEqual(['mobile']);
    expect(normalized.monthlyAccountBaseFeeCents).toBe(1490);
    expect(normalized.cardRates.girocard.percentageTenthsOfBasisPoint).toBe(220);
  });

  it('migrates legacy basis points to tenths of basis point once', () => {
    const normalized = normalizeTariff({
      id: 'tariff_legacy_bp',
      name: 'Legacy BP',
      cardRates: {
        girocard: { percentageBasisPoints: 25, fixedFeeCents: 9 },
      },
    });

    expect(normalized.cardRates.girocard.percentageTenthsOfBasisPoint).toBe(250);
    expect(normalized.cardRates.girocard.fixedFeeTenthsOfCent).toBe(90);

    const reloaded = normalizeTariff(normalized);
    expect(reloaded.cardRates.girocard.percentageTenthsOfBasisPoint).toBe(250);
  });

  it('keeps 0,249 % exact', () => {
    const normalized = normalizeTariff({
      id: 'tariff_classic',
      name: 'Classic',
      cardRates: {
        girocard: { percentageTenthsOfBasisPoint: 249, fixedFeeTenthsOfCent: 0 },
      },
    });

    expect(normalized.cardRates.girocard.percentageTenthsOfBasisPoint).toBe(249);
    expect(
      percentageOfCentsFromTenthsOfBasisPoint(1_400_000, normalized.cardRates.girocard.percentageTenthsOfBasisPoint),
    ).toBe(3_486);
  });

  it('migrates monthly fee fields from legacy names', () => {
    const normalized = normalizeTariff({
      id: 'tariff_legacy_monthly',
      name: 'Legacy Monthly',
      monthlyBaseFeeCents: 100,
      monthlyTerminalFeeCents: 995,
      monthlyServiceFeePerTerminalCents: 795,
    });

    expect(normalized.monthlyAccountBaseFeeCents).toBe(100);
    expect(normalized.monthlyTerminalRentalCents).toBe(995);
    expect(normalized.monthlyServiceFeePerTerminalCents).toBe(795);
  });

  it('stores transaction and clearing in tenths of cent', () => {
    const normalized = normalizeTariff({
      id: 'tariff_fees',
      name: 'Fees',
      additionalTransactionFeeTenthsOfCent: 79,
      girocardClearingFeeTenthsOfCent: 19,
    });

    expect(normalized.additionalTransactionFeeTenthsOfCent).toBe(79);
    expect(normalized.girocardClearingFeeTenthsOfCent).toBe(19);
  });

  it('forces clearing fee to zero when included', () => {
    const normalized = normalizeTariff({
      id: 'tariff_flat',
      name: 'Flat',
      girocardClearingIncluded: true,
      girocardClearingFeeTenthsOfCent: 19,
    });

    expect(normalized.girocardClearingIncluded).toBe(true);
    expect(normalized.girocardClearingFeeTenthsOfCent).toBe(0);
  });

  it('fills missing card rates safely', () => {
    const normalized = normalizeTariff({
      id: 'tariff_partial',
      name: 'Teilweise',
      cardRates: {
        girocard: { percentageTenthsOfBasisPoint: 300, fixedFeeTenthsOfCent: 100 },
      },
    });

    expect(normalized.cardRates.debit).toEqual({
      percentageTenthsOfBasisPoint: 0,
      fixedFeeTenthsOfCent: 0,
    });
    expect(normalized.cardRates.girocard.percentageTenthsOfBasisPoint).toBe(300);
  });

  it('normalizes demo tariffs with A920 Classic and Flat', () => {
    const tariffs = getDemoTariffs();

    expect(tariffs).toHaveLength(2);
    expect(tariffs.some((tariff) => tariff.id === 'tariff_bestpay_a920_classic')).toBe(true);
    expect(tariffs.some((tariff) => tariff.id === 'tariff_bestpay_a920_flat')).toBe(true);
    expect(tariffs.every((tariff) => tariff.minimumContractMonths === null)).toBe(true);
    expect(tariffs.every((tariff) => tariff.noticePeriodMonths === null)).toBe(true);
    expect(tariffs.every((tariff) => tariff.includedTransactions === null)).toBe(true);
  });
});
