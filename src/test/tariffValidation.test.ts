import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_TARIFF_INPUT } from '../domain/tariff/defaults';
import { validateCreateTariffInput } from '../services/tariffValidation';
import { createValidTariffInput } from './helpers/tariffTestHelpers';

describe('Tariff validation', () => {
  it('requires mandatory fields', () => {
    const errors = validateCreateTariffInput(DEFAULT_CREATE_TARIFF_INPUT);

    expect(errors.name).toBeTruthy();
    expect(errors.productCode).toBeTruthy();
    expect(errors.supportedTerminalTypes).toBeTruthy();
  });

  it('requires at least one terminal type', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ supportedTerminalTypes: [] }),
    );

    expect(errors.supportedTerminalTypes).toBe('Bitte wählen Sie mindestens eine Einsatzart.');
  });

  it('rejects negative money values', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ monthlyTerminalRentalCents: -1 }),
    );

    expect(errors.monthlyTerminalRentalCents).toContain('negativ');
  });

  it('rejects negative tenths values', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ additionalTransactionFeeTenthsOfCent: -1 }),
    );

    expect(errors.additionalTransactionFeeTenthsOfCent).toContain('negativ');
  });

  it('rejects contradictory clearing included with positive fee', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({
        girocardClearingIncluded: true,
        girocardClearingFeeTenthsOfCent: 19,
      }),
    );

    expect(errors.girocardClearingFeeTenthsOfCent).toContain('inklusive');
  });

  it('rejects negative integers', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ includedTransactions: -5 }),
    );

    expect(errors.includedTransactions).toContain('nicht negative');
  });

  it('allows null contract fields', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({
        minimumContractMonths: null,
        noticePeriodMonths: null,
        includedTransactions: null,
      }),
    );

    expect(errors.minimumContractMonths).toBeUndefined();
    expect(errors.noticePeriodMonths).toBeUndefined();
    expect(errors.includedTransactions).toBeUndefined();
  });

  it('rejects invalid date range', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({
        validFrom: '2026-12-01',
        validUntil: '2026-01-01',
      }),
    );

    expect(errors.validUntil).toBe(
      'Das Gültigkeitsende darf nicht vor dem Gültigkeitsbeginn liegen.',
    );
  });

  it('accepts valid tariff input', () => {
    const errors = validateCreateTariffInput(createValidTariffInput());
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('accepts 0,249 % card rate', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({
        cardRates: {
          girocard: { percentageTenthsOfBasisPoint: 249, fixedFeeTenthsOfCent: 0 },
          debit: { percentageTenthsOfBasisPoint: 890, fixedFeeTenthsOfCent: 0 },
          credit: { percentageTenthsOfBasisPoint: 1190, fixedFeeTenthsOfCent: 0 },
          other: { percentageTenthsOfBasisPoint: 0, fixedFeeTenthsOfCent: 0 },
        },
      }),
    );

    expect(Object.keys(errors)).toHaveLength(0);
  });
});
