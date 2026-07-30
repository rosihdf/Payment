import { describe, expect, it } from 'vitest';
import { normalizeTariff } from '../domain/tariff/normalizeTariff';
import { getDemoTariffs } from '../services/demoDataService';

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
      percentageBasisPoints: 0,
      fixedFeeCents: 0,
    });
  });

  it('preserves existing values', () => {
    const normalized = normalizeTariff({
      id: 'tariff_full',
      name: 'Vollständig',
      providerName: 'BestPay',
      productCode: 'BP-FULL',
      status: 'inactive',
      supportedTerminalTypes: ['mobile'],
      monthlyBaseFeeCents: 1490,
      cardRates: {
        girocard: { percentageBasisPoints: 22, fixedFeeCents: 8 },
      },
    });

    expect(normalized.productCode).toBe('BP-FULL');
    expect(normalized.status).toBe('inactive');
    expect(normalized.supportedTerminalTypes).toEqual(['mobile']);
    expect(normalized.monthlyBaseFeeCents).toBe(1490);
    expect(normalized.cardRates.girocard.percentageBasisPoints).toBe(22);
  });

  it('fills missing card rates safely', () => {
    const normalized = normalizeTariff({
      id: 'tariff_partial',
      name: 'Teilweise',
      cardRates: {
        girocard: { percentageBasisPoints: 30, fixedFeeCents: 10 },
      },
    });

    expect(normalized.cardRates.debit).toEqual({
      percentageBasisPoints: 0,
      fixedFeeCents: 0,
    });
    expect(normalized.cardRates.girocard.percentageBasisPoints).toBe(30);
  });

  it('normalizes demo tariffs with differentiated data', () => {
    const tariffs = getDemoTariffs();

    expect(tariffs).toHaveLength(3);
    expect(tariffs.some((tariff) => tariff.status === 'inactive')).toBe(true);
    expect(tariffs.some((tariff) => tariff.supportedTerminalTypes.includes('stationary'))).toBe(
      true,
    );
    expect(tariffs.some((tariff) => tariff.supportedTerminalTypes.includes('mobile'))).toBe(true);
    expect(
      tariffs.some((tariff) =>
        tariff.supportedTerminalTypes.some((type) => type === 'softpos' || type === 'ecommerce'),
      ),
    ).toBe(true);
  });
});
